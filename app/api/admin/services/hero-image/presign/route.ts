import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createPresignedUploadUrl,
  createServiceHeroImageKey,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;

    if (!serviceId || !IMAGE_TYPES.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 25 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Upload a JPG, PNG, WebP, or AVIF image under 25 MB." },
        { status: 400 },
      );
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found." }, { status: 404 });
    }

    const key = createServiceHeroImageKey(service.id, fileType);
    return NextResponse.json({
      success: true,
      upload: {
        key,
        uploadUrl: await createPresignedUploadUrl(key, fileType),
        publicUrl: getPublicAssetUrl(key),
        contentType: fileType,
      },
    });
  } catch (error) {
    console.error("Unable to prepare service hero upload:", error);
    return NextResponse.json({ success: false, error: "The service hero upload could not be prepared." }, { status: 500 });
  }
}
