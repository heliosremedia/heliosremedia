import { NextResponse } from "next/server";
import { createFeaturedFilmKey, createPresignedUploadUrl, getPublicAssetUrl } from "@/lib/r2-upload";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const POSTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = body.kind === "video" || body.kind === "poster" ? body.kind : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    const allowed = kind === "video" ? VIDEO_TYPES : POSTER_TYPES;
    const max = kind === "video" ? 500 * 1024 * 1024 : 20 * 1024 * 1024;

    if (!kind || !allowed.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > max) {
      return NextResponse.json({ success: false, error: kind === "video" ? "Upload an MP4 or WebM film under 500 MB." : "Upload a JPG, PNG, WebP, or AVIF poster under 20 MB." }, { status: 400 });
    }

    const key = createFeaturedFilmKey(kind, fileType);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, fileType), publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch (error) {
    console.error("Unable to prepare featured film upload:", error);
    return NextResponse.json({ success: false, error: "The featured film upload could not be prepared." }, { status: 500 });
  }
}
