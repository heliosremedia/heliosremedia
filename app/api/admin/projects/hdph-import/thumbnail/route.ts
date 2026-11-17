import sharp from "sharp";
import { getAdminSession } from "@/lib/auth/session";
import { projectHdphReader } from "@/lib/project-hdph-reader";
import { hdphId, hdphThumbnailUrl, hdphSafeImageUrl } from "@/lib/project-hdph-import";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return new Response(null, { status: 401, headers });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return new Response(null, { status: 403, headers });
  try {
    const params = new URL(request.url).searchParams;
    const photo = await projectHdphReader(session.workspaceId).photo(hdphId(params.get("siteId")), hdphId(params.get("mediaId")));
    const url = hdphSafeImageUrl(hdphThumbnailUrl(photo), process.env.HDPH_PROJECTS_IMAGE_HOSTS);
    const source = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    const maxBytes = 8 * 1024 * 1024;
    if (!source.ok || !source.headers.get("content-type")?.startsWith("image/") || Number(source.headers.get("content-length")) > maxBytes || !source.body) {
      await source.body?.cancel();
      return new Response(null, { status: 422, headers });
    }
    const reader = source.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); throw new Error("Thumbnail too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const image = await sharp(Buffer.concat(chunks), { limitInputPixels: 60_000_000 }).rotate().resize({ width: 400, height: 300, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    return new Response(new Uint8Array(image), { headers: { ...headers, "Content-Type": "image/jpeg" } });
  } catch {
    // Fail closed: no credentials, provider bodies or signed source URLs reach the browser.
    return new Response(null, { status: 422, headers });
  }
}
