import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { createPhotoComparisonImageKey, createPresignedUploadUrl, getPublicAssetUrl } from "@/lib/r2-upload";

const kinds = new Set(["detail", "standard", "editorial"]);
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const kind = typeof body.kind === "string" && kinds.has(body.kind) ? body.kind as "detail" | "standard" | "editorial" : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    if (!kind || !imageTypes.has(fileType) || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > 25 * 1024 * 1024) return NextResponse.json({ success: false, error: "Upload a JPG, PNG, WebP, or AVIF image under 25 MB." }, { status: 400 });
    const key = createPhotoComparisonImageKey(session.workspaceId, kind, fileType);
    const uploadUrl = await withBrandUploadAsset({ workspaceId: session.workspaceId, actorId: session.userId, kind: "photo-comparison", key, byteSize: fileSize }, () => createPresignedUploadUrl(key, fileType));
    return NextResponse.json({ success: true, upload: { key, uploadUrl, publicUrl: getPublicAssetUrl(key), contentType: fileType } });
  } catch (error) {
    console.error("Unable to prepare photo comparison upload:", error);
    return NextResponse.json({ success: false, error: "The image upload could not be prepared." }, { status: 500 });
  }
}
