import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";
import { NextResponse } from "next/server";

import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";
import {
  createNewsletterImageKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
  validateImageUpload,
} from "@/lib/r2-upload";

export async function POST(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();

  try {
    const body = await request.json() as Record<string, unknown>;
    const file = {
      name: typeof body.fileName === "string" ? body.fileName : "",
      type: typeof body.fileType === "string" ? body.fileType : "",
      size: typeof body.fileSize === "number" ? body.fileSize : Number.NaN,
    };
    validateImageUpload(file);
    const key = createNewsletterImageKey(session.workspaceId, file.type);

    return NextResponse.json({
      success: true,
      upload: {
        key,
        uploadUrl: await withBrandUploadAsset({
          workspaceId: session.workspaceId, actorId: session.userId, kind: "newsletter", key, byteSize: file.size,
        }, () => createPresignedUploadUrl(key, file.type)),
        publicUrl: getPublicAssetUrl(key),
        contentType: file.type,
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to prepare this image.";
    const status = message.startsWith("Unsupported") || message.includes("25 MB") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
