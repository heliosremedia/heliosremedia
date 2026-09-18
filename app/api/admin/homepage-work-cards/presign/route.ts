import { NextResponse } from "next/server";

import { withCurationWrite } from "@/lib/homepage-curation-write";
import { workCardMediaPrefix } from "@/lib/work-card-media";
import { workCardAssetNamespace } from "@/lib/work-card-media-server";
import { getAdminSession } from "@/lib/auth/session";
import {
  createHomepageWorkCardKey,
  createPresignedUploadUrl,
  getPublicAssetUrl,
} from "@/lib/r2-upload";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const body = (await request.clone().json()) as Record<string, unknown>;
    const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
    const kind = body.kind === "image" || body.kind === "video" ? body.kind : null;
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : Number.NaN;
    const allowed = kind === "video" ? VIDEO_TYPES : IMAGE_TYPES;
    const maxSize = kind === "video" ? 500 * 1024 * 1024 : 25 * 1024 * 1024;

    if (!cardId || !kind || !allowed.has(fileType) || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > maxSize) {
      return NextResponse.json({
        success: false,
        error: kind === "video"
          ? "Upload an MP4 or WebM preview under 500 MB."
          : "Upload a JPG, PNG, WebP, or AVIF image under 25 MB.",
      }, { status: 400 });
    }

    return await withCurationWrite(session, "work-cards", request, async (prisma) => {
    const card = await prisma.homepageWorkCard.findFirst({ where: { id: cardId, service: { workspaceId: session.workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId: session.workspaceId } } }] }, select: { id: true, serviceId: true } });
    if (!card) return NextResponse.json({ success: false, error: "Homepage card not found." }, { status: 404 });

    const key = workCardMediaPrefix(session.workspaceId, card.id) + createHomepageWorkCardKey(card.id, kind, fileType).split('/').pop();
    const asset = await prisma.workspaceAsset.create({ data: { workspaceId: session.workspaceId, provider: 'R2', providerNamespace: workCardAssetNamespace(), providerKey: key, byteSize: BigInt(fileSize), provenance: { kind: 'WORK_CARD_UPLOAD', cardId: card.id, mediaKind: kind, serviceId: card.serviceId, actorId: session.userId } }, select: { id: true } });
    const uploadUrl = await createPresignedUploadUrl(key, fileType);
    const provisioned = await prisma.workspaceAsset.updateMany({ where: { id: asset.id, workspaceId: session.workspaceId, status: 'UPLOAD_PENDING' }, data: { status: 'UPLOAD_PROVISIONED' } });
    if (provisioned.count !== 1) throw new Error('INVALID_VALUE');
    return NextResponse.json({
      success: true,
      media: { protocol: 1, intent: 'prepare', workspaceId: session.workspaceId, cardId: card.id, serviceId: card.serviceId, kind, mediaId: key, assetId: asset.id, key, url: getPublicAssetUrl(key), verification: 'registered' },
      upload: {
        key,
        uploadUrl,
        publicUrl: getPublicAssetUrl(key),
        contentType: fileType,
      },
    });
    });
  } catch (error) {
    console.error("Unable to prepare homepage work-card upload:", error);
    return NextResponse.json({ success: false, error: "The homepage card upload could not be prepared." }, { status: 500 });
  }
}
