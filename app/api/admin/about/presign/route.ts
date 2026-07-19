import { NextResponse } from "next/server";

import { createAboutPageImageKey, createPresignedUploadUrl, getPublicAssetUrl } from "@/lib/r2-upload";

const kinds = new Set(["hero", "gallery-one", "gallery-two", "gallery-three"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = typeof body.kind === "string" && kinds.has(body.kind) ? body.kind as "hero" | "gallery-one" | "gallery-two" | "gallery-three" : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    if (!kind || !imageTypes.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 25 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Upload a JPG, PNG, WebP, or AVIF image under 25 MB." }, { status: 400 });
    }
    const key = createAboutPageImageKey(kind, fileType);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, fileType), publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch (error) {
    console.error("Unable to prepare About image upload:", error);
    return NextResponse.json({ success: false, error: "The About image upload could not be prepared." }, { status: 500 });
  }
}
