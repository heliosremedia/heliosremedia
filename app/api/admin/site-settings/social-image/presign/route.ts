import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { createDefaultSocialImageKey, createPresignedUploadUrl, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const file = {
      name: typeof body.fileName === "string" ? body.fileName : "social-share.jpg",
      type: typeof body.fileType === "string" ? body.fileType : "",
      size: typeof body.fileSize === "number" ? body.fileSize : 0,
    };
    validateImageUpload(file);
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Choose an image under 10 MB." }, { status: 400 });
    }
    const key = createDefaultSocialImageKey(file.type);
    const upload = { key, uploadUrl: await createPresignedUploadUrl(key, file.type), publicUrl: getPublicAssetUrl(key), contentType: file.type };
    return NextResponse.json({ success: true, upload });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to prepare social image upload." }, { status: 400 });
  }
}
