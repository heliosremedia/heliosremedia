import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function createPreviewToken() { return randomBytes(32).toString("base64url"); }
export function hashPreviewToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function validateProjectPreview(slug: string, token: string | undefined) {
  if (!token) return null;
  const preview = await prisma.projectPreviewLink.findFirst({ where: { tokenHash: hashPreviewToken(token), revokedAt: null, expiresAt: { gt: new Date() }, project: { slug } }, select: { id: true, projectId: true } });
  if (preview) await prisma.projectPreviewLink.update({ where: { id: preview.id }, data: { lastUsedAt: new Date() } });
  return preview;
}
