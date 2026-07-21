import { NextResponse } from "next/server";

import { createPresignedUploadUrl, createTeamMemberPortraitKey, getPublicAssetUrl } from "@/lib/r2-upload";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    if (!imageTypes.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 25 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Upload a JPG, PNG, WebP, or AVIF portrait under 25 MB." }, { status: 400 });
    }
    const key = createTeamMemberPortraitKey(fileType);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, fileType), publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch (error) {
    console.error("Unable to prepare team portrait upload:", error);
    return NextResponse.json({ success: false, error: "The team portrait upload could not be prepared." }, { status: 500 });
  }
}
