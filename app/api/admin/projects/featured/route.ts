import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const body = await request.json() as { projectIds?: unknown };
  const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter((id): id is string => typeof id === "string") : [];
  if (projectIds.length > 6 || new Set(projectIds).size !== projectIds.length) return NextResponse.json({ success: false, error: "Choose up to six unique featured projects." }, { status: 400 });
  const projects = await prisma.project.findMany({ where: { workspaceId: session.workspaceId, status: "PUBLISHED", id: { in: projectIds } }, select: { id: true, featured: true, featuredStartedAt: true, featuredExpiresAt: true } });
  if (projects.length !== projectIds.length) return NextResponse.json({ success: false, error: "Only published projects from this workspace can be featured." }, { status: 400 });
  const existing = new Map(projects.map((project) => [project.id, project]));
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.project.updateMany({ where: { workspaceId: session.workspaceId, featured: true, id: { notIn: projectIds } }, data: { featured: false, featuredStartedAt: null, featuredExpiresAt: null } });
    for (const id of projectIds) {
      const project = existing.get(id)!;
      await transaction.project.update({ where: { id }, data: { featured: true, featuredStartedAt: project.featured ? project.featuredStartedAt : now, featuredExpiresAt: project.featured ? project.featuredExpiresAt : null } });
    }
    await transaction.auditEvent.create({ data: { actorId: session.userId, actorEmail: session.email, action: "FEATURED_PROJECTS_FINALIZED", entityType: "Project", entityId: session.workspaceId, summary: `Finalized ${projectIds.length} featured projects.`, metadata: { projectIds } } });
  });
  revalidatePath("/portfolio"); revalidatePath("/admin/projects");
  return NextResponse.json({ success: true, projectIds });
}
