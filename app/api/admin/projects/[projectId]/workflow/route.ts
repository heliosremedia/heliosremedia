import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { tryResolveExternalMedia } from "@/lib/external-media";
import { getAdminSession } from "@/lib/auth/session";
import { featuredWindow, type FeaturedDuration } from "@/lib/featured-project";
import { prisma } from "@/lib/prisma";

type ProjectWorkflowRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectWorkflowBody = {
  action?: unknown;
  serviceIds?: unknown;
  featured?: unknown;
  featuredDuration?: unknown;
};

function revalidateProjectPaths(projectId: string, slug: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/admin/services");
  revalidatePath("/portfolio");
  revalidatePath(`/portfolio/${slug}`);
}

export async function PATCH(
  request: Request,
  { params }: ProjectWorkflowRouteProps,
) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
    }
    const { projectId } = await params;
    const body = (await request.json()) as ProjectWorkflowBody;
    const action = typeof body.action === "string" ? body.action.trim() : "";

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "A project ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId: session.workspaceId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        featured: true,
        featuredStartedAt: true,
        featuredExpiresAt: true,
        heroMediaId: true,
        shortDescription: true,
        heroMedia: {
          select: {
            visibility: true,
          },
        },
        publishedAt: true,
        services: {
          select: {
            serviceId: true,
            service: {
              select: {
                active: true,
              },
            },
          },
        },
        media: {
          where: {
            visibility: "VISIBLE",
          },
          select: {
            sourceType: true,
            externalUrl: true,
          },
        },
        _count: {
          select: {
            media: {
              where: {
                visibility: "VISIBLE",
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (action === "assign-services") {
      if (!Array.isArray(body.serviceIds)) {
        return NextResponse.json(
          {
            success: false,
            error: "A service selection is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !body.serviceIds.every(
          (value) => typeof value === "string" && value.trim().length > 0,
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Every selected service ID must be valid.",
          },
          {
            status: 400,
          },
        );
      }

      const serviceIds = body.serviceIds.map((value) => value.trim());

      if (new Set(serviceIds).size !== serviceIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "The selected service list contains duplicates.",
          },
          {
            status: 400,
          },
        );
      }

      const services = await prisma.service.findMany({
        where: {
          workspaceId: session.workspaceId,
          archivedAt: null,
          id: {
            in: serviceIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (services.length !== serviceIds.length) {
        return NextResponse.json(
          {
            success: false,
            error: "One or more selected services are no longer available.",
          },
          {
            status: 409,
          },
        );
      }

      const existingAssignments = await prisma.projectService.findMany({ where: { projectId }, select: { serviceId: true } });
      const existingIds = new Set(existingAssignments.map((item) => item.serviceId));
      const inactiveNewSelection = await prisma.service.findFirst({
        where: { id: { in: serviceIds.filter((id) => !existingIds.has(id)) }, workspaceId: session.workspaceId, active: false },
        select: { id: true },
      });
      if (inactiveNewSelection) return NextResponse.json({ success: false, error: "Inactive services cannot be newly assigned." }, { status: 409 });

      await prisma.$transaction(async (transaction) => {
        await transaction.projectService.deleteMany({
          where: {
            projectId,
          },
        });

        if (serviceIds.length > 0) {
          await transaction.projectService.createMany({
            data: serviceIds.map((serviceId) => ({
              projectId,
              serviceId,
            })),
            skipDuplicates: true,
          });
        }
      });

      revalidateProjectPaths(project.id, project.slug);

      return NextResponse.json({
        success: true,
        serviceIds,
      });
    }

    if (action === "set-featured") {
      const durations = new Set<FeaturedDuration>(["NONE", "7_DAYS", "14_DAYS", "30_DAYS", "ALWAYS"]);
      const duration = typeof body.featuredDuration === "string" && durations.has(body.featuredDuration as FeaturedDuration)
        ? body.featuredDuration as FeaturedDuration
        : typeof body.featured === "boolean" ? (body.featured ? "ALWAYS" : "NONE") : null;
      if (!duration) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid featured setting is required.",
          },
          {
            status: 400,
          },
        );
      }

      if (duration !== "NONE" && project.status !== "PUBLISHED") {
        return NextResponse.json(
          {
            success: false,
            error: "Only published projects can be featured.",
          },
          {
            status: 409,
          },
        );
      }

      const updatedProject = await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          ...featuredWindow(duration),
        },
        select: {
          featured: true,
          featuredStartedAt: true,
          featuredExpiresAt: true,
          status: true,
          publishedAt: true,
        },
      });

      revalidateProjectPaths(project.id, project.slug);

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    }

    if (action === "publish") {
      const blockers: string[] = [];
      const hasPlayableVideo = project.media.some((media) => {
        if (!["VIDEO_EMBED", "UPLOADED_VIDEO"].includes(media.sourceType)) {
          return false;
        }

        const externalMedia = tryResolveExternalMedia(media.externalUrl);
        return Boolean(externalMedia?.embedUrl || externalMedia?.playbackUrl);
      });

      if (!project.shortDescription && !hasPlayableVideo) {
        blockers.push("Add a short project description.");
      }

      if (
        (!project.heroMediaId || project.heroMedia?.visibility !== "VISIBLE") &&
        !hasPlayableVideo
      ) {
        blockers.push("Select a visible hero image or add a playable video.");
      }

      if (project._count.media === 0) {
        blockers.push("Add at least one visible media asset.");
      }

      if (!project.services.some(({ service }) => service.active)) {
        blockers.push("Assign at least one active service.");
      }

      if (blockers.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Complete the publishing requirements before going live.",
            blockers,
          },
          {
            status: 409,
          },
        );
      }

      const updatedProject = await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          status: "PUBLISHED",
          publishedAt: project.publishedAt ?? new Date(),
          archivedAt: null,
        },
        select: {
          status: true,
          featured: true,
          publishedAt: true,
        },
      });

      revalidateProjectPaths(project.id, project.slug);

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    }

    if (action === "unpublish") {
      const updatedProject = await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          status: "DRAFT",
          publishedAt: null,
          archivedAt: null,
          featured: false,
        },
        select: {
          status: true,
          featured: true,
          publishedAt: true,
        },
      });

      revalidateProjectPaths(project.id, project.slug);

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    }

    if (action === "archive") {
      const updatedProject = await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          status: "ARCHIVED",
          publishedAt: null,
          archivedAt: new Date(),
          featured: false,
        },
        select: {
          status: true,
          featured: true,
          publishedAt: true,
        },
      });

      revalidateProjectPaths(project.id, project.slug);

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "The requested project workflow action is not supported.",
      },
      {
        status: 400,
      },
    );
  } catch (error) {
    console.error("Unable to update project workflow:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The project workflow could not be updated.",
      },
      {
        status: 500,
      },
    );
  }
}
