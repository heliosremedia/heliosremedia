import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { deleteContentImage, verifyContentImage } from "@/lib/content-image-storage";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth/session";

const select = {
  id: true,
  serviceId: true,
  titleOverride: true,
  destinationOverride: true,
  displayOrder: true,
  active: true,
  imageStorageKey: true,
  imageUrl: true,
  imageAlt: true,
  mediaMode: true,
  featuredMediaId: true,
  videoStorageKey: true,
  videoUrl: true,
  service: { select: { id: true, name: true, slug: true, active: true } },
  featuredMedia: { select: { id: true, caption: true, originalFilename: true, provider: true, externalId: true, externalUrl: true, sourceType: true, project: { select: { title: true } } } },
} as const;

function textValue(input: unknown, max: number) {
  const value = typeof input === "string" ? input.trim() : "";
  if (value.length > max) throw new Error("INVALID_VALUE");
  return value || null;
}

function destination(input: unknown, fallback: string) {
  const value = textValue(input, 1000);
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("INVALID_VALUE"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("INVALID_VALUE");
  return url.toString();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    const [service, count] = await Promise.all([
      prisma.service.findFirst({ where: { id: serviceId, workspaceId: session.workspaceId, active: true }, select: { id: true, slug: true } }),
      prisma.homepageWorkCard.count({ where: { service: { workspaceId: session.workspaceId } } }),
    ]);
    if (!service) return NextResponse.json({ success: false, error: "Select an active service." }, { status: 400 });
    if (count >= 5) return NextResponse.json({ success: false, error: "The homepage supports up to five work cards." }, { status: 409 });

    const card = await prisma.homepageWorkCard.create({
      data: { serviceId: service.id, displayOrder: count, destinationOverride: `/portfolio?service=${service.slug}` },
      select,
    });
    refresh();
    return NextResponse.json({ success: true, card }, { status: 201 });
  } catch (error) {
    console.error("Unable to add homepage work card:", error);
    return NextResponse.json({ success: false, error: "The homepage work card could not be added." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "reorder") {
      const ids = Array.isArray(body.cardIds) ? body.cardIds.filter((id): id is string => typeof id === "string") : [];
      const current = await prisma.homepageWorkCard.findMany({ where: { service: { workspaceId: session.workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId: session.workspaceId } } }] }, select: { id: true } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || current.some(({ id }) => !ids.includes(id))) {
        return NextResponse.json({ success: false, error: "Homepage cards changed before the order was saved." }, { status: 409 });
      }
      await prisma.$transaction(ids.map((id, displayOrder) => prisma.homepageWorkCard.updateMany({ where: { id, service: { workspaceId: session.workspaceId } }, data: { displayOrder } })));
      refresh();
      return NextResponse.json({ success: true, cardIds: ids });
    }

    const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
    const existing = await prisma.homepageWorkCard.findFirst({ where: { id: cardId, service: { workspaceId: session.workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId: session.workspaceId } } }] }, include: { service: { select: { slug: true } } } });
    if (!existing) return NextResponse.json({ success: false, error: "Homepage card not found." }, { status: 404 });

    const nextServiceId = typeof body.serviceId === "string" && body.serviceId.trim() ? body.serviceId.trim() : existing.serviceId;
    const nextService = await prisma.service.findFirst({ where: { id: nextServiceId, workspaceId: session.workspaceId, active: true }, select: { id: true, slug: true } });
    if (!nextService) return NextResponse.json({ success: false, error: "Select an active service for this card." }, { status: 400 });
    if (nextServiceId !== existing.serviceId) {
      const duplicate = await prisma.homepageWorkCard.findFirst({ where: { serviceId: nextServiceId, service: { workspaceId: session.workspaceId } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ success: false, error: "That service is already assigned to another homepage card." }, { status: 409 });
    }

    const mediaMode = ["IMAGE", "LIBRARY_VIDEO", "UPLOADED_VIDEO"].includes(String(body.mediaMode))
      ? String(body.mediaMode) as "IMAGE" | "LIBRARY_VIDEO" | "UPLOADED_VIDEO"
      : existing.mediaMode;
    const featuredMediaId = textValue(body.featuredMediaId, 200);
    const imageStorageKey = textValue(body.imageStorageKey, 1500);
    const videoStorageKey = textValue(body.videoStorageKey, 1500);
    if (imageStorageKey && !imageStorageKey.startsWith(`site/homepage/work-cards/${cardId}/`)) throw new Error("INVALID_VALUE");
    if (videoStorageKey && !videoStorageKey.startsWith(`site/homepage/work-cards/${cardId}/`)) throw new Error("INVALID_VALUE");

    if (mediaMode === "LIBRARY_VIDEO") {
      const media = featuredMediaId ? await prisma.media.findFirst({
        where: {
          id: featuredMediaId,
          visibility: "VISIBLE",
          sourceType: { in: ["UPLOADED_VIDEO", "VIDEO_EMBED"] },
          project: { workspaceId: session.workspaceId, status: "PUBLISHED" },
        },
        select: { id: true },
      }) : null;
      if (!media) return NextResponse.json({ success: false, error: "Choose a visible film from a published project." }, { status: 400 });
    }
    if (mediaMode === "UPLOADED_VIDEO" && !videoStorageKey) {
      return NextResponse.json({ success: false, error: "Upload a looping preview before selecting uploaded video." }, { status: 400 });
    }

    if (imageStorageKey !== existing.imageStorageKey) await verifyContentImage(imageStorageKey);
    if (videoStorageKey !== existing.videoStorageKey) await verifyContentImage(videoStorageKey);

    const changed = await prisma.homepageWorkCard.updateMany({
      where: { id: cardId, service: { workspaceId: session.workspaceId } },
      data: {
        titleOverride: textValue(body.titleOverride, 120),
        serviceId: nextService.id,
        destinationOverride: destination(body.destinationOverride, `/portfolio?service=${nextService.slug}`),
        imageStorageKey,
        imageUrl: textValue(body.imageUrl, 1500),
        imageAlt: textValue(body.imageAlt, 240),
        mediaMode,
        featuredMediaId: mediaMode === "LIBRARY_VIDEO" ? featuredMediaId : null,
        videoStorageKey,
        videoUrl: textValue(body.videoUrl, 1500),
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    });
    if (changed.count !== 1) return NextResponse.json({ success: false, error: "Homepage card not found." }, { status: 404 });
    const card = await prisma.homepageWorkCard.findFirstOrThrow({ where: { id: cardId, service: { workspaceId: session.workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId: session.workspaceId } } }] }, select });

    if (imageStorageKey !== existing.imageStorageKey) await deleteContentImage(existing.imageStorageKey);
    if (videoStorageKey !== existing.videoStorageKey) await deleteContentImage(existing.videoStorageKey);
    refresh();
    return NextResponse.json({ success: true, card });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VALUE") {
      return NextResponse.json({ success: false, error: "One or more homepage card values are invalid." }, { status: 400 });
    }
    console.error("Unable to update homepage work card:", error);
    return NextResponse.json({ success: false, error: "The homepage work card could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Editor access is required." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("cardId")?.trim();
    if (!id) return NextResponse.json({ success: false, error: "A card ID is required." }, { status: 400 });
    const card = await prisma.homepageWorkCard.findFirst({ where: { id, service: { workspaceId: session.workspaceId }, OR: [{ featuredMediaId: null }, { featuredMedia: { project: { workspaceId: session.workspaceId } } }] }, select: { id: true, imageStorageKey: true, videoStorageKey: true } });
    if (!card) return NextResponse.json({ success: false, error: "Homepage card not found." }, { status: 404 });
    const deleted = await prisma.homepageWorkCard.deleteMany({ where: { id: card.id, service: { workspaceId: session.workspaceId } } });
    if (deleted.count !== 1) return NextResponse.json({ success: false, error: "Homepage card changed before deletion." }, { status: 409 });
    await Promise.all([deleteContentImage(card.imageStorageKey), deleteContentImage(card.videoStorageKey)]);
    refresh();
    return NextResponse.json({ success: true, deletedCardId: card.id });
  } catch (error) {
    console.error("Unable to remove homepage work card:", error);
    return NextResponse.json({ success: false, error: "The homepage work card could not be removed." }, { status: 500 });
  }
}
