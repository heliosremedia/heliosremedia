import { saveProjectPrivateStatus, ProjectPrivateStatusError } from "@/lib/project-private-status";
import { saveProjectServices, ProjectServiceSelectionError } from "@/lib/project-service-selection";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { saveProjectPublishing, ProjectPublishingError } from "@/lib/project-publishing";
import { getAdminSession } from "@/lib/auth/session";
import { type FeaturedDuration } from "@/lib/featured-project";

type ProjectWorkflowRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectWorkflowBody = {
  action?: unknown;
  expectedUpdatedAt?: unknown;
  expectedStatus?: unknown;
  expectedServiceIds?: unknown;
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

    if (action === "assign-services") {
      const saved = await saveProjectServices(session, projectId, body.expectedUpdatedAt, body.expectedServiceIds, body.serviceIds);
      revalidateProjectPaths(saved.project.id, saved.project.slug);
      return NextResponse.json({ success: true, serviceIds: saved.serviceIds, updatedAt: saved.project.updatedAt.toISOString() });
    }

    if (action === "unpublish" || action === "archive") {
      const project = await saveProjectPrivateStatus(session, projectId, action, body.expectedUpdatedAt, body.expectedStatus);
      revalidateProjectPaths(project.id, project.slug);
      return NextResponse.json({ success: true, project, updatedAt: project.updatedAt.toISOString() });
    }

    if (action === "publish" || action === "set-featured") {
      const durations = new Set<FeaturedDuration>(["NONE", "7_DAYS", "14_DAYS", "30_DAYS", "ALWAYS"]);
      const duration = typeof body.featuredDuration === "string" && durations.has(body.featuredDuration as FeaturedDuration)
        ? body.featuredDuration as FeaturedDuration
        : typeof body.featured === "boolean" ? (body.featured ? "ALWAYS" : "NONE") : null;
      if (action === "set-featured" && !duration) return NextResponse.json({ success: false, error: "A valid featured setting is required." }, { status: 400 });
      const project = await saveProjectPublishing(session, projectId, action, body.expectedUpdatedAt, body.expectedStatus, duration ?? "NONE");
      revalidateProjectPaths(project.id, project.slug);
      return NextResponse.json({ success: true, project, updatedAt: project.updatedAt.toISOString() });
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
    if (error instanceof ProjectPublishingError) return NextResponse.json({ success: false, error: error.message, blockers: error.blockers, reloadRequired: true }, { status: error.status });
    if (error instanceof ProjectServiceSelectionError || error instanceof ProjectPrivateStatusError) return NextResponse.json({ success: false, error: error.message, reloadRequired: error.status !== 400 }, { status: error.status });
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Current owner or administrator access is required.", reloadRequired: true }, { status: 403 });
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
