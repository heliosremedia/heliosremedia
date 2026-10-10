import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { requireLockedWorkspaceAdministrator } from "@/lib/workspace-write-access";
import { readFeaturedProjectReview } from "@/lib/project-featured-review";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  if (process.env.VERCEL_ENV === "preview") return NextResponse.json({ success: false, error: "Preview is read-only. Featured projects can be saved after production approval." }, { status: 409 });
  const body = await request.json() as { projectIds?: unknown; expectedRevision?: unknown };
  if (!Array.isArray(body.projectIds) || !body.projectIds.every(id => typeof id === "string" && id.length > 0)) return NextResponse.json({ success: false, error: "A valid project selection is required." }, { status: 400 });
  const projectIds: string[] = body.projectIds;
  if (projectIds.length > 6 || new Set(projectIds).size !== projectIds.length) return NextResponse.json({ success: false, error: "Choose up to six unique featured projects." }, { status: 400 });
  try {
    const revision = await prisma.$transaction(async (transaction) => {
      await requireLockedWorkspaceAdministrator(transaction, session);
      // Share the workspace fence with per-project placement and lifecycle changes.
      await transaction.$queryRaw`SELECT id FROM "Project" WHERE "workspaceId"=${session.workspaceId} ORDER BY id FOR UPDATE`;
      const review = await readFeaturedProjectReview(transaction, session.workspaceId);
      if (typeof body.expectedRevision !== "string" || body.expectedRevision !== review.revision) throw new Error("FEATURED_SELECTION_CHANGED");
      const projects = await transaction.project.findMany({ where: { workspaceId: session.workspaceId, status: "PUBLISHED", id: { in: projectIds } }, select: { id: true, featured: true, featuredStartedAt: true, featuredExpiresAt: true, updatedAt: true } });
      if (projects.length !== projectIds.length) throw new Error("FEATURED_SELECTION_CHANGED");
      const removed = await transaction.project.findMany({ where: { workspaceId: session.workspaceId, featured: true, id: { notIn: projectIds } }, select: { id: true, updatedAt: true } });
      const now = new Date();
      for (const project of removed) await transaction.project.update({ where: { id: project.id, workspaceId: session.workspaceId }, data: { featured: false, featuredStartedAt: null, featuredExpiresAt: null, updatedAt: new Date(Math.max(now.getTime(), project.updatedAt.getTime() + 1)) } });
      for (const project of projects) {
        await transaction.project.update({ where: { id: project.id, workspaceId: session.workspaceId }, data: { featured: true, featuredStartedAt: project.featured ? project.featuredStartedAt : now, featuredExpiresAt: project.featured ? project.featuredExpiresAt : null, updatedAt: new Date(Math.max(now.getTime(), project.updatedAt.getTime() + 1)) } });
      }
      await transaction.auditEvent.create({ data: { workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email, action: "FEATURED_PROJECTS_FINALIZED", entityType: "Project", entityId: session.workspaceId, summary: `Finalized ${projectIds.length} featured projects.`, metadata: { projectIds } } });
      return (await readFeaturedProjectReview(transaction, session.workspaceId)).revision;
    });
    revalidatePath("/portfolio"); revalidatePath("/admin/projects");
    return NextResponse.json({ success: true, projectIds, workspaceId: session.workspaceId, revision });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Current owner or administrator access is required.", reloadRequired: true }, { status: 403 });
    if (error instanceof Error && error.message === "FEATURED_SELECTION_CHANGED") return NextResponse.json({ success: false, error: "Featured projects changed. Review the saved list before replacing it.", reloadRequired: true }, { status: 409 });
    throw error;
  }
}
