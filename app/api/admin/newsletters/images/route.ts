import { NextResponse } from "next/server";
import { getMediaCollection } from "@/lib/media-collections";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";

export async function GET(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const params = new URL(request.url).searchParams;
  const search = (params.get("search") || "").trim().slice(0, 100);
  const source = (params.get("source") || "ALL").toUpperCase();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.heliosremedia.com").replace(/\/+$/, "");

  const [media, posts, generated] = await Promise.all([
    source === "ALL" || source === "PORTFOLIO"
      ? prisma.media.findMany({
          where: {
            visibility: "VISIBLE",
            OR: [
              { mimeType: { startsWith: "image/" } },
              { storageKey: { not: null }, mimeType: null },
            ],
            ...(search ? {
              AND: [{
                OR: [
                  { originalFilename: { contains: search, mode: "insensitive" } },
                  { altText: { contains: search, mode: "insensitive" } },
                  { project: { title: { contains: search, mode: "insensitive" } } },
                ],
              }],
            } : {}),
          },
          take: 60,
          orderBy: { createdAt: "desc" },
          include: { project: { select: { title: true, slug: true } } },
        }) : [],
    source === "ALL" || source === "BLOG"
      ? prisma.blogPost.findMany({
          where: {
            OR: [{ featuredImageUrl: { not: null } }, { featuredImageStorageKey: { not: null } }],
            ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
          },
          take: 40,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, title: true, slug: true, featuredImageUrl: true,
            featuredImageStorageKey: true, featuredImageAlt: true,
          },
        }) : [],
    source === "ALL" || source === "AI"
      ? prisma.newsletterImageAsset.findMany({
          where: search ? {
            OR: [
              { prompt: { contains: search, mode: "insensitive" } },
              { altText: { contains: search, mode: "insensitive" } },
            ],
          } : undefined,
          take: 60,
          orderBy: { createdAt: "desc" },
        }) : [],
  ]);

  const items = [
    ...generated.map(item => ({
      id: `ai:${item.id}`, assetId: item.id, source: "AI", url: item.publicUrl,
      thumbnailUrl: item.publicUrl, label: item.altText, altText: item.altText,
      attribution: item.attribution, width: item.width, height: item.height,
    })),
    ...media.flatMap(item => {
      const url = item.storageKey ? getPublicAssetUrl(item.storageKey) : item.externalUrl;
      if (!url?.startsWith("https://")) return [];
      return [{
        id: `media:${item.id}`, assetId: item.id, source: "PORTFOLIO", url,
        thumbnailUrl: url, label: item.project.title,
        altText: item.altText || `${item.project.title} ${getMediaCollection(item.mediaCategory).label}`,
        attribution: `Helios portfolio · ${item.project.title}`,
        destinationUrl: `${siteUrl}/portfolio/${item.project.slug}`,
        width: item.width, height: item.height,
      }];
    }),
    ...posts.flatMap(item => {
      const url = item.featuredImageStorageKey
        ? getPublicAssetUrl(item.featuredImageStorageKey) : item.featuredImageUrl;
      if (!url?.startsWith("https://")) return [];
      return [{
        id: `blog:${item.id}`, assetId: item.id, source: "BLOG", url,
        thumbnailUrl: url, label: item.title,
        altText: item.featuredImageAlt || item.title,
        attribution: `Helios Blog · ${item.title}`,
        destinationUrl: `${siteUrl}/blog/${item.slug}`,
      }];
    }),
  ];
  return NextResponse.json({ success: true, items });
}
