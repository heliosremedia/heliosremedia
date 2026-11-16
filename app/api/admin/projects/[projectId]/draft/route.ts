import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ projectId: string }> };
const allowed = (role: string) => ["OWNER", "ADMIN"].includes(role);

export async function GET(_request: Request, { params }: Context) {
  const session = await getAdminSession();
  if (!session || !allowed(session.role)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { title: true, status: true, updatedAt: true, _count: { select: { media: true, socialCampaigns: true, socialCampaignProjects: true } } } });
  if (!project) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  if (project.status !== "DRAFT") return NextResponse.json({ success: false, error: "Only drafts can be deleted. This project is no longer a draft." }, { status: 409 });
  if (project._count.socialCampaigns || project._count.socialCampaignProjects) return NextResponse.json({ success: false, error: "This draft is used by a social campaign. Remove that connection before deleting it." }, { status: 409 });
  return NextResponse.json({ success: true, title: project.title, updatedAt: project.updatedAt.toISOString(), mediaCount: project._count.media }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getAdminSession();
  if (!session || !allowed(session.role)) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  const { projectId } = await params;
  let body: { title?: unknown; updatedAt?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 }); }
  if (typeof body.title !== "string" || typeof body.updatedAt !== "string" || !Number.isFinite(Date.parse(body.updatedAt))) return NextResponse.json({ success: false, error: "Confirm the current draft title before deleting." }, { status: 400 });
  const title = body.title;
  const updatedAt = new Date(body.updatedAt);
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      // The conditional DELETE is atomic: a concurrent publish/edit invalidates this confirmation.
      const result = await tx.project.deleteMany({ where: { id: projectId, workspaceId: session.workspaceId, status: "DRAFT", title, updatedAt, socialCampaigns: { none: {} }, socialCampaignProjects: { none: {} } } });
      if (result.count !== 1) return false;
      await tx.auditEvent.create({ data: { actorId: session.userId, actorEmail: session.email, action: "PROJECT_DRAFT_DELETED", entityType: "Project", entityId: projectId, summary: `Deleted draft project: ${title}`, metadata: { workspaceId: session.workspaceId, title, confirmedUpdatedAt: updatedAt.toISOString(), externalFilesDeleted: false } } });
      return true;
    });
    if (!deleted) return NextResponse.json({ success: false, error: "The draft changed, is no longer available, or is connected to a campaign. Refresh and review it before trying again." }, { status: 409 });
    revalidatePath("/admin/projects");
    revalidatePath("/admin");
    return NextResponse.json({ success: true });
  } catch (error) {
    // Related records may have been added after confirmation. Never cascade into campaigns.
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "P2003") return NextResponse.json({ success: false, error: "This draft has related records that prevent deletion. Refresh and review its connections." }, { status: 409 });
    console.error("Unable to delete project draft", error);
    return NextResponse.json({ success: false, error: "The draft could not be deleted. Please refresh before trying again." }, { status: 500 });
  }
}
