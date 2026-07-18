import { NextResponse } from "next/server";

import { createPresignedUploadUrl, createTrustedLogoKey, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType.trim() : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    if (!fileName || !fileType || !Number.isFinite(fileSize)) return NextResponse.json({ success: false, error: "Valid logo information is required." }, { status: 400 });
    validateImageUpload({ name: fileName, type: fileType, size: fileSize });
    if (fileSize > 5 * 1024 * 1024) return NextResponse.json({ success: false, error: "Logo files must be smaller than 5 MB." }, { status: 400 });
    const key = createTrustedLogoKey(fileType);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, fileType), publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare this upload.";
    const validation = message === "Unsupported image type." || message === "Images must be smaller than 25 MB.";
    console.error("Unable to prepare trusted logo upload:", error);
    return NextResponse.json({ success: false, error: message }, { status: validation ? 400 : 500 });
  }
}
