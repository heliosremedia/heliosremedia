import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createPreviewToken, hashPreviewToken } from "@/lib/project-preview";
import { getWorkspacePreviewUrl } from "@/lib/project-preview-url";

type Context = { params: Promise<{ projectId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const { projectId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const days = typeof body.days === "number" ? Math.round(body.days) : 7;
    if (![1, 3, 7, 14, 30].includes(days)) return NextResponse.json({ success: false, error: "Choose a valid expiration period." }, { status: 400 });
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) || null : null;
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Project" WHERE "id"=${projectId} AND "workspaceId"=${session.workspaceId} FOR UPDATE`;
      if (!locked.length) return null;
      const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { slug: true, title: true } });
      if (!project) return null;
      const token = createPreviewToken();
      const url = await getWorkspacePreviewUrl(session.workspaceId, `/portfolio/${encodeURIComponent(project.slug)}?preview=${encodeURIComponent(token)}`);
      const preview = await tx.projectPreviewLink.create({ data: { projectId, tokenHash: hashPreviewToken(token), label, createdById: session.userId, expiresAt: new Date(Date.now() + days * 86400000) }, select: { id: true, label: true, expiresAt: true, createdAt: true, lastUsedAt: true, revokedAt: true } });
      return { title: project.title, preview: { ...preview, url } };
    });
    if (!result) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
    await recordAuditEvent({ workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email, action: "PROJECT_PREVIEW_CREATED", entityType: "Project", entityId: projectId, summary: `Preview link created for ${result.title}.` });
    revalidatePath(`/admin/projects/${projectId}`);
    return NextResponse.json({ success: true, preview: result.preview }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PREVIEW_DOMAIN_REQUIRED") return NextResponse.json({ success: false, error: "Configure an active public domain for this company before creating preview links." }, { status: 409 });
    console.error("Unable to create preview:", error);
    return NextResponse.json({ success: false, error: "The preview link could not be created." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const { projectId } = await params;
    const previewId = new URL(request.url).searchParams.get("previewId");
    if (!previewId) return NextResponse.json({ success: false, error: "Preview ID required." }, { status: 400 });
    const result = await prisma.projectPreviewLink.updateMany({ where: { id: previewId, projectId, project: { workspaceId: session.workspaceId }, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) return NextResponse.json({ success: false, error: "Active preview not found." }, { status: 404 });
    await recordAuditEvent({ workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email, action: "PROJECT_PREVIEW_REVOKED", entityType: "Project", entityId: projectId, summary: "Project preview link revoked." });
    revalidatePath(`/admin/projects/${projectId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to revoke preview:", error);
    return NextResponse.json({ success: false, error: "The preview link could not be revoked." }, { status: 500 });
  }
}
