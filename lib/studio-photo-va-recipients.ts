import { createHmac, timingSafeEqual } from "node:crypto";

export const PHOTO_VA_RECIPIENTS_PATH = "/api/internal/photo-va-recipients";
const MAX_BODY_BYTES = 256;
export const MAX_PHOTO_VA_RECIPIENTS = 20;
const MAX_SKEW_SEC = 45;
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/;
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: responseHeaders });
export const validPhotoVaId = (id: unknown): id is string => typeof id === "string" && idPattern.test(id);
type ListedUser = { id: string; displayName: string };
export const validPhotoVaEmail = (email: string) => email.length <= 254 && emailPattern.test(email);
type ResolvedUser = ListedUser & { email: string };

async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (!request.body || (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES))) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let bytes = 0, text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function displayName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 120 || /[\u0000-\u001F\u007F-\u009F]/.test(name)) throw new Error("Invalid recipient display name");
  return name;
}

export async function studioPhotoVaRecipients(request: Request, {
  secret = process.env.PHOTO_VA_BRIDGE_SECRET,
  workspaceId = process.env.PHOTO_VA_WORKSPACE_ID,
  clock = Date.now,
  listUsers,
  resolveUser,
}: {
  secret?: string;
  workspaceId?: string;
  clock?: () => number;
  listUsers: (workspaceId: string) => Promise<ListedUser[]>;
  resolveUser: (workspaceId: string, id: string) => Promise<ResolvedUser | null>;
}) {
  const reject = () => reply(403, { code: "forbidden" });
  if (request.method !== "POST" || new URL(request.url).pathname !== PHOTO_VA_RECIPIENTS_PATH ||
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      !secret || secret.length < 43 || secret.length > 256 || !validPhotoVaId(workspaceId)) return reject();

  const ts = request.headers.get("x-helios-va-ts");
  const signature = request.headers.get("x-helios-va-signature");
  if (!ts || !/^\d{10}$/.test(ts) || !signature || !/^[a-f0-9]{64}$/.test(signature) ||
      Math.abs(Math.floor(clock() / 1000) - Number(ts)) > MAX_SKEW_SEC) return reject();

  let input: unknown;
  try {
    const rawBody = await readBody(request);
    if (rawBody === null) return reject();
    const expected = createHmac("sha256", secret)
      .update(PHOTO_VA_RECIPIENTS_PATH + "\n" + ts + "\n" + rawBody)
      .digest();
    if (!timingSafeEqual(Buffer.from(signature, "hex"), expected)) return reject();
    input = JSON.parse(rawBody);
  } catch {
    return reject();
  }

  if (!input || typeof input !== "object" || Array.isArray(input) || !("action" in input)) return reject();
  const list = input.action === "list" && Object.keys(input).length === 1;
  const id = input.action === "resolve" && Object.keys(input).length === 2 && "id" in input && validPhotoVaId(input.id) ? input.id : null;
  if (!list && !id) return reject();

  try {
    if (list) {
      const seen = new Set<string>();
      const rows = await listUsers(workspaceId);
      if (rows.length > MAX_PHOTO_VA_RECIPIENTS) return reply(503, { code: "directory_unavailable" });
      const recipients = rows.map(user => {
        if (!validPhotoVaId(user.id) || seen.has(user.id)) throw new Error("Invalid recipient list");
        seen.add(user.id);
        return { id: user.id, name: displayName(user.displayName) };
      });
      return reply(200, { recipients });
    }
    if (!id) return reply(200, { recipient: null });
    const user = await resolveUser(workspaceId, id);
    if (!user) return reply(200, { recipient: null });
    const email = user.email.trim().toLowerCase();
    if (user.id !== id || !validPhotoVaEmail(email)) return reply(200, { recipient: null });
    return reply(200, { recipient: { id, name: displayName(user.displayName), email } });
  } catch {
    return reply(503, { code: "directory_unavailable" });
  }
}
