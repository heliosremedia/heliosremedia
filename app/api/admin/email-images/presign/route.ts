import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { createEmailCampaignImageKey, createPresignedUploadUrl, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const file = { name: typeof body.fileName === "string" ? body.fileName : "", type: typeof body.fileType === "string" ? body.fileType : "", size: typeof body.fileSize === "number" ? body.fileSize : Number.NaN };
    validateImageUpload(file);
    const key = createEmailCampaignImageKey(session.workspaceId, file.type);
    return NextResponse.json({ success: true, upload: { key, uploadUrl: await withBrandUploadAsset({ workspaceId: session.workspaceId, actorId: session.userId, sessionVersion: session.sessionVersion, kind: "email-campaign", key, byteSize: file.size }, () => createPresignedUploadUrl(key, file.type)), publicUrl: getPublicAssetUrl(key), contentType: file.type } });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Upload access is no longer available." }, { status: 403 });
    const error = cause instanceof Error ? cause.message : "Unable to prepare this image.";
    return NextResponse.json({ success: false, error }, { status: error.startsWith("Unsupported") || error.includes("25 MB") ? 400 : 500 });
  }
}
