import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body.seoTitle !== "string" || typeof body.seoDescription !== "string" || body.seoTitle.length > 70 || body.seoDescription.length > 180) {
    return NextResponse.json({ success: false, error: "Use at most 70 characters for the title and 180 for the description." }, { status: 400 });
  }
  const { projectId } = await params;
  try {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { slug: true } });
    if (!project) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    const updated = await prisma.project.updateMany({ where: { id: projectId, workspaceId: session.workspaceId }, data: { seoTitle: body.seoTitle.trim() || null, seoDescription: body.seoDescription.trim() || null } });
    if (!updated.count) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/portfolio/${project.slug}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "SEO settings could not be saved. Try again." }, { status: 500 });
  }
}
