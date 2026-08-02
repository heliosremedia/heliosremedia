import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as { projectIds?: unknown };
    const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    if (!projectIds.length || projectIds.length > 500 || new Set(projectIds).size !== projectIds.length) return NextResponse.json({ success: false, error: "The project order is invalid." }, { status: 400 });
    const workspaceProjects = await prisma.project.findMany({ where: { workspaceId: session.workspaceId }, select: { id: true } });
    if (workspaceProjects.length !== projectIds.length || workspaceProjects.some(({ id }) => !projectIds.includes(id))) return NextResponse.json({ success: false, error: "The project list changed. Refresh before ordering again." }, { status: 409 });
    await prisma.$transaction(projectIds.map((id, index) => prisma.project.updateMany({ where: { id, workspaceId: session.workspaceId }, data: { displayOrder: index } })));
    revalidatePath("/portfolio"); revalidatePath("/admin/projects"); revalidatePath("/");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to reorder projects:", error);
    return NextResponse.json({ success: false, error: "The project order could not be saved." }, { status: 500 });
  }
}
