import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { parseCopyPackage } from "@/lib/project-copy-package";

type Context = { params: Promise<{ projectId: string }> };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const allowed = (role: string) => ["OWNER", "ADMIN", "EDITOR"].includes(role);
export async function GET(_request: Request, { params }: Context) {
  const session = await getAdminSession();
  if (!session || !allowed(session.role)) return reply({ error: "Editing access is required." },403);
  const { projectId } = await params;
  try {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
    if (!project) return reply({ error: "Project not found." },404);
    const item = await prisma.projectCopyPackage.findFirst({ where: { projectId, workspaceId: session.workspaceId } });
    return reply({ success: true, revision: item?.revision ?? 0, package: item ? { source: item.sourceDescription, draft: item.copy } : null });
  } catch { return reply({ error: "Saved copy is unavailable. Your editor text is unchanged." },503); }
}
export async function PUT(request: Request, { params }: Context) {
  const session = await getAdminSession();
  if (!session || !allowed(session.role)) return reply({ error: "Editing access is required." },403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Use the copy editor in Studio." },403);
  let input: ReturnType<typeof parseCopyPackage>; let revision: number;
  try {
    const raw = await request.text(); if (raw.length > 40000) return reply({ error: "Copy package is too large." },413);
    const body = JSON.parse(raw);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw Error();
    revision = body.revision; input = parseCopyPackage(body);
  } catch { return reply({ error: "Check the copy fields and reload saved copy before trying again." },400); }
  const { projectId } = await params;
  try {
    const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: session.workspaceId }, select: { id: true } });
    if (!project) return reply({ error: "Project not found." },404);
    if (revision === 0) {
      await prisma.projectCopyPackage.create({ data: { projectId, workspaceId: session.workspaceId, sourceDescription: input.source, copy: input.draft, revision: 1 } });
    } else {
      const result = await prisma.projectCopyPackage.updateMany({ where: { projectId, workspaceId: session.workspaceId, revision }, data: { sourceDescription: input.source, copy: input.draft, revision: { increment: 1 } } });
      if (result.count !== 1) return reply({ error: "Another session saved newer copy. Your local edits are safe. Load the saved version to compare before replacing it." },409);
    }
    return reply({ success: true, revision: revision + 1 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return reply({ error: "Another session created saved copy. Load the saved version before replacing it." },409);
    return reply({ error: "Copy could not be saved. Your editor text is unchanged." },503);
  }
}
