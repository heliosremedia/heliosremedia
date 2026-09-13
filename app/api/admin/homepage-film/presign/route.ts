import { NextResponse } from "next/server";
import { createFeaturedFilmKey, createPresignedUploadUrl, getPublicAssetUrl } from "@/lib/r2-upload";
import { getAdminSession } from "@/lib/auth/session";
import { getSiteSettingsWriteTarget } from "@/lib/site-settings-ownership";
import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const POSTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ success: false, error: "Provide valid film upload information." }, { status: 400 });
    const body = input as Record<string, unknown>;
    const kind = body.kind === "video" || body.kind === "poster" ? body.kind : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    const allowed = kind === "video" ? VIDEO_TYPES : POSTER_TYPES;
    const max = kind === "video" ? 500 * 1024 * 1024 : 20 * 1024 * 1024;

    if (!kind || !allowed.has(fileType) || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > max) {
      return NextResponse.json({ success: false, error: kind === "video" ? "Upload an MP4 or WebM film under 500 MB." : "Upload a JPG, PNG, WebP, or AVIF poster under 20 MB." }, { status: 400 });
    }

    await getSiteSettingsWriteTarget(session.workspaceId);
    const key = createFeaturedFilmKey(session.workspaceId, kind, fileType);
    const uploadUrl = await withBrandUploadAsset({ workspaceId: session.workspaceId, actorId: session.userId, kind: "site-featured-film", key, byteSize: fileSize }, () => createPresignedUploadUrl(key, fileType));
    return NextResponse.json({ success: true, upload: { key, uploadUrl, publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch {
    console.error("Unable to prepare featured film upload", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The featured film upload could not be prepared." }, { status: 500 });
  }
}
