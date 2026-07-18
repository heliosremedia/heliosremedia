import { NextResponse } from "next/server";

import {
  createBrandMonogramKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const MONOGRAM_TYPES = new Set(["image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!MONOGRAM_TYPES.has(fileType)) {
      return NextResponse.json(
        { success: false, error: "Upload a transparent PNG, WebP, or AVIF monogram." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Brand monograms must be smaller than 5 MB." },
        { status: 400 },
      );
    }

    const key = createBrandMonogramKey(fileType);
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
    console.error("Unable to prepare brand monogram upload:", error);
    return NextResponse.json(
      { success: false, error: "The brand monogram upload could not be prepared." },
      { status: 500 },
    );
  }
}
