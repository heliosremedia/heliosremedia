import { NextResponse } from "next/server";

import {
  createHomepageSectionImageKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind =
      body.kind === "helios-standard" || body.kind === "primary-conversion"
        ? body.kind
        : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize =
      typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (
      !kind ||
      !IMAGE_TYPES.has(fileType) ||
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > 20 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Upload a JPG, PNG, WebP, or AVIF image smaller than 20 MB.",
        },
        { status: 400 },
      );
    }

    const key = createHomepageSectionImageKey(kind, fileType);
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
    console.error("Unable to prepare homepage section image:", error);
    return NextResponse.json(
      { success: false, error: "The homepage image upload could not be prepared." },
      { status: 500 },
    );
  }
}
