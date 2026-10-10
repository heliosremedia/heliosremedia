import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { readProjectOrderReview } from "@/lib/project-order-review";

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Current editor access is required.", reloadRequired: true }, { status: 403 });
    const body = await request.json() as { projectIds?: unknown; expectedRevision?: unknown };
    if (!Array.isArray(body.projectIds) || !body.projectIds.every(id => typeof id === "string" && id.length > 0)) return NextResponse.json({ success: false, error: "The project order is invalid." }, { status: 400 });
    const projectIds: string[] = body.projectIds;
    if (!projectIds.length || projectIds.length > 500 || new Set(projectIds).size !== projectIds.length) return NextResponse.json({ success: false, error: "The project order is invalid." }, { status: 400 });
    const revision = await prisma.$transaction(async tx => {
      await requireLockedWorkspaceEditor(tx, session);
      await tx.$queryRaw`SELECT id FROM "Project" WHERE "workspaceId"=${session.workspaceId} ORDER BY id FOR UPDATE`;
      const review = await readProjectOrderReview(tx, session.workspaceId);
      if (typeof body.expectedRevision !== "string" || body.expectedRevision !== review.revision || review.projects.length !== projectIds.length || review.projects.some(project => !projectIds.includes(project.id))) throw new Error("PROJECT_ORDER_CHANGED");
      const rows = new Map(review.projects.map(project => [project.id, project]));
      const now = Date.now();
      for (const [index, id] of projectIds.entries()) {
        const changed = await tx.project.updateMany({ where: { id, workspaceId: session.workspaceId }, data: { displayOrder: index, updatedAt: new Date(Math.max(now, rows.get(id)!.updatedAt.getTime() + 1)) } });
        if (changed.count !== 1) throw new Error("PROJECT_ORDER_CHANGED");
      }
      return (await readProjectOrderReview(tx, session.workspaceId)).revision;
    });
    revalidatePath("/portfolio"); revalidatePath("/admin/projects"); revalidatePath("/");
    return NextResponse.json({ success: true, projectIds, workspaceId: session.workspaceId, revision });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Current editor access is required.", reloadRequired: true }, { status: 403 });
    if (error instanceof Error && error.message === "PROJECT_ORDER_CHANGED") return NextResponse.json({ success: false, error: "The project list changed. Review its saved order before ordering again.", reloadRequired: true }, { status: 409 });
    console.error("Unable to reorder projects:", error);
    return NextResponse.json({ success: false, error: "The saved project order needs review.", reloadRequired: true }, { status: 500 });
  }
}
