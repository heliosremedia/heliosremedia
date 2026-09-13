import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { withBrandUploadAsset } from "@/lib/workspace-brand-assets";
import { createLocationFeatureImageKey, createPresignedUploadUrl, getPublicAssetUrl, validateImageUpload } from "@/lib/r2-upload";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  if (!["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
  try {
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_INPUT");
    const body = input as Record<string, unknown>;
    const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
    const file = { name: typeof body.fileName === "string" ? body.fileName : "location-image", type: typeof body.fileType === "string" ? body.fileType : "", size: typeof body.fileSize === "number" ? body.fileSize : 0 };
    const location = await prisma.locationPage.findFirst({ where: { id: locationId, workspaceId: session.workspaceId }, select: { id: true } });
    if (!location) return NextResponse.json({ success: false, error: "Location page not found." }, { status: 404 });
    validateImageUpload(file);
    const key = createLocationFeatureImageKey(session.workspaceId, location.id, file.type);
    const uploadUrl = await withBrandUploadAsset({ workspaceId: session.workspaceId, actorId: session.userId, kind: "locations", key, byteSize: file.size }, () => createPresignedUploadUrl(key, file.type));
    return NextResponse.json({ success: true, upload: { key, publicUrl: getPublicAssetUrl(key), uploadUrl, contentType: file.type } });
  } catch {
    console.error("Unable to prepare location image upload", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "Upload a JPG, PNG, WebP, or AVIF image smaller than 25 MB." }, { status: 400 });
  }
}
