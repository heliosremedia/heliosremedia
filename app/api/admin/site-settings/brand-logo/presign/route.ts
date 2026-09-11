import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";
import { getAdminSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

import {
  createBrandLogoKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const LOGO_TYPES = new Set(["image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!LOGO_TYPES.has(fileType)) {
      return NextResponse.json(
        { success: false, error: "Upload a transparent PNG, WebP, or AVIF logo." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Brand logos must be smaller than 10 MB." },
        { status: 400 },
      );
    }

    const key = createBrandLogoKey(session.workspaceId, fileType);
    const uploadUrl = await withBrandUploadAsset({ workspaceId: session.workspaceId, actorId: session.userId, kind: "site-brand", key, byteSize: fileSize }, () => createPresignedUploadUrl(key, fileType));

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
    console.error("Unable to prepare brand logo upload:", error);
    return NextResponse.json(
      { success: false, error: "The brand logo upload could not be prepared." },
      { status: 500 },
    );
  }
}
