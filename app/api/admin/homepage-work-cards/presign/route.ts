import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createHomepageWorkCardKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
    const kind = body.kind === "image" || body.kind === "video" ? body.kind : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    const allowed = kind === "video" ? VIDEO_TYPES : IMAGE_TYPES;
    const maxSize = kind === "video" ? 500 * 1024 * 1024 : 25 * 1024 * 1024;

    if (!cardId || !kind || !allowed.has(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxSize) {
      return NextResponse.json({
        success: false,
        error: kind === "video"
          ? "Upload an MP4 or WebM preview under 500 MB."
          : "Upload a JPG, PNG, WebP, or AVIF image under 25 MB.",
      }, { status: 400 });
    }

    const card = await prisma.homepageWorkCard.findUnique({ where: { id: cardId }, select: { id: true } });
    if (!card) return NextResponse.json({ success: false, error: "Homepage card not found." }, { status: 404 });

    const key = createHomepageWorkCardKey(card.id, kind, fileType);
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
    console.error("Unable to prepare homepage work-card upload:", error);
    return NextResponse.json({ success: false, error: "The homepage card upload could not be prepared." }, { status: 500 });
  }
}
