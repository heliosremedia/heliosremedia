import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventAdmin } from "@/lib/events/service";
import { eventError } from "@/lib/events/api";
import { safeEventImageUrl } from "@/lib/events/themes";

const PAGE_SIZE = 36;
/** The event picker only exposes this workspace's published photos and saved event images. */
export async function GET(request: Request) {
  try {
    const session = await eventAdmin();
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") || "").trim().slice(0, 100);
    const source = params.get("source") || "ALL";
    const page = Math.min(100, Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1));
    const projectId = (params.get("projectId") || "").slice(0, 100);
    const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
    const [media, events] = await Promise.all([
      source === "ALL" || source === "PORTFOLIO" ? prisma.media.findMany({
        where: { visibility: "VISIBLE", sourceType: "UPLOADED_IMAGE", mimeType: { in: ["image/jpeg", "image/png"] }, storageKey: { not: null }, project: { workspaceId: session.workspaceId, status: "PUBLISHED", archivedAt: null }, ...(projectId ? {projectId} : {}), ...(search ? { OR: [{ altText: { contains: search, mode: "insensitive" } }, { project: { title: { contains: search, mode: "insensitive" } } }] } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
        select: { id: true, storageKey: true, altText: true, width: true, height: true, project: { select: { title: true } } },
      }) : [],
      !projectId && (source === "ALL" || source === "UPLOAD") ? prisma.eventInvitationEvent.findMany({
        where: { workspaceId: session.workspaceId, imageUrl: { not: null }, ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { imageAlt: { contains: search, mode: "insensitive" } }] } : {}) },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
        select: { id: true, title: true, imageUrl: true, imageAlt: true },
      }) : [],
    ]);
    const seen = new Set<string>();
    const items = [
      ...media.slice(0, PAGE_SIZE).map(item => ({ id: `media:${item.id}`, source: "PORTFOLIO", url: item.storageKey && publicBase ? `${publicBase}/${item.storageKey}` : null, label: item.project.title, altText: item.altText || item.project.title, width: item.width, height: item.height })),
      ...events.slice(0, PAGE_SIZE).map(item => ({ id: `event:${item.id}`, source: "UPLOAD", url: item.imageUrl, label: item.title, altText: item.imageAlt || item.title })),
    ].flatMap(item => {
      const url = safeEventImageUrl(item.url, [publicBase]);
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [{ ...item, url, thumbnailUrl: url }];
    });
    return NextResponse.json({ success: true, items, page, hasMore: media.length > PAGE_SIZE || events.length > PAGE_SIZE }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return eventError(error); }
}
