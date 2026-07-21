import { NextResponse } from "next/server";
import { createFaviconKey, createPresignedUploadUrl, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const file = { name: typeof body.fileName === "string" ? body.fileName : "favicon.png", type: typeof body.fileType === "string" ? body.fileType : "", size: typeof body.fileSize === "number" ? body.fileSize : 0 };
    validateImageUpload(file);
    if (file.type !== "image/png") return NextResponse.json({ success: false, error: "Use a square PNG so the favicon remains crisp and transparent." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ success: false, error: "Favicons must be smaller than 5 MB." }, { status: 400 });
    const key = createFaviconKey(file.type);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await createPresignedUploadUrl(key, file.type), publicUrl: getPublicAssetUrl(key), contentType: file.type } });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to prepare favicon upload." }, { status: 400 }); }
}
