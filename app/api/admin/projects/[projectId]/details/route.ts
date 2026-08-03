import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";

type ProjectDetailsRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ProjectDetailsBody = Record<string, unknown>;

const PROJECT_TEXT_LIMITS = {
  title: 120,
  slug: 140,
  shortDescription: 320,
  description: 6000,
  city: 120,
  state: 120,
  locationLabel: 180,
  projectType: 120,
  propertyType: 120,
  seoTitle: 70,
  seoDescription: 180,
} as const;

const DETAILS_TEXT_LIMITS = {
  listingAgent: 160,
  brokerage: 160,
  builder: 160,
  architect: 160,
  interiorDesigner: 160,
  lotSize: 120,
  neighborhood: 160,
  propertyAddress: 300,
  propertyWebsiteUrl: 500,
} as const;

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getText(body: ProjectDetailsBody, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalText(body: ProjectDetailsBody, field: string) {
  return getText(body, field) || null;
}

function validateTextLimits(
  body: ProjectDetailsBody,
  limits: Record<string, number>,
) {
  for (const [field, limit] of Object.entries(limits)) {
    if (getText(body, field).length > limit) {
      return `${field} must be ${limit} characters or fewer.`;
    }
  }

  return null;
}

function getOptionalNumber(
  body: ProjectDetailsBody,
  field: string,
  options: {
    integer?: boolean;
    maximum: number;
  },
) {
  const raw = body[field];

  if (raw === null || raw === undefined || raw === "") {
    return { value: null, error: null };
  }

  const value = typeof raw === "number" ? raw : Number(raw);

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > options.maximum ||
    (options.integer && !Number.isInteger(value))
  ) {
    return {
      value: null,
      error: `${field} must be a valid ${options.integer ? "whole " : ""}number.`,
    };
  }

  return { value, error: null };
}

function isValidWebsiteUrl(value: string | null) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function revalidateProjectPaths(
  projectId: string,
  previousSlug: string,
  nextSlug: string,
) {
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath("/portfolio");
  revalidatePath(`/portfolio/${previousSlug}`);

  if (nextSlug !== previousSlug) {
    revalidatePath(`/portfolio/${nextSlug}`);
  }
}

export async function PATCH(
  request: Request,
  { params }: ProjectDetailsRouteProps,
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { projectId } = await params;
    const body = (await request.json()) as ProjectDetailsBody;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "A project ID is required." },
        { status: 400 },
      );
    }

    const existingProject = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
      select: { id: true, slug: true },
    });

    if (!existingProject) {
      return NextResponse.json(
        { success: false, error: "Project not found." },
        { status: 404 },
      );
    }

    const projectLimitError = validateTextLimits(body, PROJECT_TEXT_LIMITS);
    const detailsLimitError = validateTextLimits(body, DETAILS_TEXT_LIMITS);

    if (projectLimitError || detailsLimitError) {
      return NextResponse.json(
        {
          success: false,
          error: projectLimitError || detailsLimitError,
        },
        { status: 400 },
      );
    }

    const title = getText(body, "title");
    const slug = slugify(getText(body, "slug") || title);

    if (!title) {
      return NextResponse.json(
        { success: false, error: "A project title is required." },
        { status: 400 },
      );
    }

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "A valid portfolio URL is required." },
        { status: 400 },
      );
    }

    const slugConflict = await prisma.project.findFirst({
      where: {
        slug,
        id: { not: projectId },
      },
      select: { id: true },
    });

    if (slugConflict) {
      return NextResponse.json(
        {
          success: false,
          error: "That portfolio URL is already used by another project.",
        },
        { status: 409 },
      );
    }

    const squareFeet = getOptionalNumber(body, "squareFeet", {
      integer: true,
      maximum: 100_000_000,
    });
    const bedrooms = getOptionalNumber(body, "bedrooms", { maximum: 100 });
    const bathrooms = getOptionalNumber(body, "bathrooms", { maximum: 100 });
    const numberError = squareFeet.error || bedrooms.error || bathrooms.error;

    if (numberError) {
      return NextResponse.json(
        { success: false, error: numberError },
        { status: 400 },
      );
    }

    const propertyWebsiteUrl = getOptionalText(body, "propertyWebsiteUrl");
    const rawAgents = Array.isArray(body.agents) ? body.agents : null;
    if (rawAgents && rawAgents.length > 20) return NextResponse.json({ success: false, error: "A project can include up to 20 agents." }, { status: 400 });
    const agents = rawAgents?.map((value, displayOrder) => {
      const agent = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return {
        clientId: typeof agent.clientId === "string" && agent.clientId ? agent.clientId : null,
        displayNameSnapshot: typeof agent.displayNameSnapshot === "string" ? agent.displayNameSnapshot.trim() : "",
        brokerageSnapshot: typeof agent.brokerageSnapshot === "string" ? agent.brokerageSnapshot.trim() || null : null,
        displayOrder,
      };
    }) ?? null;
    if (agents?.some((agent) => !agent.displayNameSnapshot || agent.displayNameSnapshot.length > 160 || (agent.brokerageSnapshot?.length || 0) > 160)) return NextResponse.json({ success: false, error: "Each agent needs a valid display name and brokerage." }, { status: 400 });
    const linkedClientIds = [...new Set(agents?.flatMap((agent) => agent.clientId ? [agent.clientId] : []) ?? [])];
    if (linkedClientIds.length) {
      const memberships = await prisma.communicationClientWorkspace.count({ where: { workspaceId: session.workspaceId, clientId: { in: linkedClientIds } } });
      if (memberships !== linkedClientIds.length) return NextResponse.json({ success: false, error: "One or more selected clients are not available in this workspace." }, { status: 400 });
    }

    if (!isValidWebsiteUrl(propertyWebsiteUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: "The property website must use a valid http or https URL.",
        },
        { status: 400 },
      );
    }

    const project = await prisma.$transaction(async (transaction) => {
      if (agents) {
        await transaction.projectAgent.deleteMany({ where: { projectId, workspaceId: session.workspaceId } });
        if (agents.length) await transaction.projectAgent.createMany({ data: agents.map((agent) => ({ ...agent, projectId, workspaceId: session.workspaceId })) });
      }
      await transaction.projectDetails.upsert({
        where: { projectId },
        create: {
          projectId,
          listingAgent: getOptionalText(body, "listingAgent"),
          brokerage: getOptionalText(body, "brokerage"),
          builder: getOptionalText(body, "builder"),
          architect: getOptionalText(body, "architect"),
          interiorDesigner: getOptionalText(body, "interiorDesigner"),
          squareFeet: squareFeet.value,
          bedrooms: bedrooms.value,
          bathrooms: bathrooms.value,
          lotSize: getOptionalText(body, "lotSize"),
          neighborhood: getOptionalText(body, "neighborhood"),
          propertyAddress: getOptionalText(body, "propertyAddress"),
          propertyWebsiteUrl,
        },
        update: {
          listingAgent: getOptionalText(body, "listingAgent"),
          brokerage: getOptionalText(body, "brokerage"),
          builder: getOptionalText(body, "builder"),
          architect: getOptionalText(body, "architect"),
          interiorDesigner: getOptionalText(body, "interiorDesigner"),
          squareFeet: squareFeet.value,
          bedrooms: bedrooms.value,
          bathrooms: bathrooms.value,
          lotSize: getOptionalText(body, "lotSize"),
          neighborhood: getOptionalText(body, "neighborhood"),
          propertyAddress: getOptionalText(body, "propertyAddress"),
          propertyWebsiteUrl,
        },
      });

      return transaction.project.update({
        where: { id: projectId },
        data: {
          title,
          slug,
          shortDescription: getOptionalText(body, "shortDescription"),
          description: getOptionalText(body, "description"),
          city: getOptionalText(body, "city"),
          state: getOptionalText(body, "state"),
          locationLabel: getOptionalText(body, "locationLabel"),
          projectType: getOptionalText(body, "projectType"),
          propertyType: getOptionalText(body, "propertyType"),
          seoTitle: getOptionalText(body, "seoTitle"),
          seoDescription: getOptionalText(body, "seoDescription"),
        },
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          city: true,
          state: true,
          locationLabel: true,
          projectType: true,
          propertyType: true,
        },
      });
    });

    revalidateProjectPaths(projectId, existingProject.slug, project.slug);

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("Unable to update project details:", error);

    return NextResponse.json(
      {
        success: false,
        error: "The project details could not be saved.",
      },
      { status: 500 },
    );
  }
}
