import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function createPreviewToken() { return randomBytes(32).toString("base64url"); }
export function hashPreviewToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function validateProjectPreview(slug: string, token: string | undefined, workspaceId: string) {
  if (!workspaceId || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const preview = await prisma.projectPreviewLink.findFirst({ where: { tokenHash: hashPreviewToken(token), revokedAt: null, expiresAt: { gt: new Date() }, project: { slug, workspaceId } }, select: { id: true, projectId: true } });
  if (!preview) return null;
  const touched = await prisma.projectPreviewLink.updateMany({ where: { id: preview.id, project: { slug, workspaceId }, revokedAt: null, expiresAt: { gt: new Date() } }, data: { lastUsedAt: new Date() } });
  return touched.count === 1 ? preview : null;
}
