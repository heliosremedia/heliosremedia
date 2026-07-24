import { NextResponse } from "next/server";
import { createBlogImageKey, createPresignedUploadUrl, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const file = {
      name: typeof body.fileName === "string" ? body.fileName : "",
      type: typeof body.fileType === "string" ? body.fileType : "",
      size: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
    };
    validateImageUpload(file);
    const key = createBlogImageKey(file.type);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, file.type), publicUrl: getPublicAssetUrl(key), contentType: file.type } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to prepare this image.";
    return NextResponse.json({ success: false, error: message }, { status: message.startsWith("Unsupported") || message.includes("25 MB") ? 400 : 500 });
  }
}
