import { createHmac, timingSafeEqual } from "node:crypto";
export type PreviewPayload = { workspaceId: string; userId: string; expiresAt: number; requestId: string; subject: string; html: string; attachment: { filename: string; content: string; contentType: string } };
const mac = (body: string, secret: string) => {
  if (secret.length < 32) throw new Error("Preview signing is not configured.");
  return createHmac("sha256", secret).update(`monthly-internal-preview:${body}`).digest("base64url");
};
export function signPreview(payload: PreviewPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  if (body.length > 2_000_000) throw new Error("Preview is too large for an internal test.");
  return `${body}.${mac(body, secret)}`;
}
export function verifyPreview(token: string, secret: string, workspaceId: string, userId: string, now = Date.now()): PreviewPayload {
  if (token.length > 2_000_100) throw new Error("Invalid preview.");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid preview.");
  const expected = Buffer.from(mac(parts[0], secret)); const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("Preview changed. Generate it again.");
  const value = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as PreviewPayload;
  if (value.workspaceId !== workspaceId || value.userId !== userId || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) throw new Error("Preview expired or belongs to another session. Generate it again.");
  return value;
}
