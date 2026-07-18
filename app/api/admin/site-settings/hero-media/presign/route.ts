import { NextResponse } from "next/server";

import {
  createPresignedUploadUrl,
  createSiteHeroKey,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const POSTER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = body.kind === "video" || body.kind === "poster" ? body.kind : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!kind || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid hero media information is required." },
        { status: 400 },
      );
    }

    const allowedTypes = kind === "video" ? VIDEO_TYPES : POSTER_TYPES;
    const maxSize = kind === "video" ? 500 * 1024 * 1024 : 20 * 1024 * 1024;

    if (!allowedTypes.has(fileType)) {
      return NextResponse.json(
        {
          success: false,
          error:
            kind === "video"
              ? "Upload an MP4 or WebM hero video."
              : "Upload a JPG, PNG, WebP, or AVIF poster image.",
        },
        { status: 400 },
      );
    }

    if (fileSize > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error:
            kind === "video"
              ? "Hero videos must be smaller than 500 MB."
              : "Hero posters must be smaller than 20 MB.",
        },
        { status: 400 },
      );
    }

    const key = createSiteHeroKey(kind, fileType);
    const uploadUrl = await createPresignedUploadUrl(key, fileType);

    return NextResponse.json({
      success: true,
      upload: {
        key,
        uploadUrl,
        publicUrl: getPublicAssetUrl(key),
        contentType: fileType,
      },
    });
  } catch (error) {
    console.error("Unable to prepare homepage hero upload:", error);
    return NextResponse.json(
      { success: false, error: "The homepage hero upload could not be prepared." },
      { status: 500 },
    );
  }
}
