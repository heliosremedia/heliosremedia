import { NextResponse } from "next/server";

import {
  createPresignedUploadUrl,
  createTestimonialImageKey,
  getPublicAssetUrl,
  validateImageUpload,
} from "@/lib/r2-upload";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType.trim() : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!fileName || !fileType || !Number.isFinite(fileSize)) {
      return NextResponse.json({ success: false, error: "Valid image information is required." }, { status: 400 });
    }

    validateImageUpload({ name: fileName, type: fileType, size: fileSize });
    const key = createTestimonialImageKey(fileType);
    const uploadUrl = await createPresignedUploadUrl(key, fileType);

    return NextResponse.json({
      success: true,
      upload: { key, uploadUrl, publicUrl: getPublicAssetUrl(key), contentType: fileType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare this upload.";
    const validation = message === "Unsupported image type." || message === "Images must be smaller than 25 MB.";
    console.error("Unable to prepare testimonial photo upload:", error);
    return NextResponse.json({ success: false, error: message }, { status: validation ? 400 : 500 });
  }
}
