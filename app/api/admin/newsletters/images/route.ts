import { NextResponse } from "next/server";
import { getMediaCollection } from "@/lib/media-collections";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import {
  NEWSLETTER_PROJECT_PAGE_SIZE,
  orderProjectMedia,
  parseNewsletterGalleryQuery,
} from "@/lib/newsletters/gallery-projects";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";
import { safeNewsletterImageUrl } from "@/lib/newsletters/source-images";

export async function GET(request: Request) {
  try {
    return await getNewsletterImages(request);
  } catch (error) {
    console.error("Unable to load Newsletter Studio images:", error);
    return NextResponse.json(
      { success: false, error: "Newsletter Studio could not load the requested project media." },
      { status: 500 },
    );
  }
}

async function getNewsletterImages(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const params = new URL(request.url).searchParams;
  const { search, source, projectId, page } = parseNewsletterGalleryQuery(params);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.heliosrealestatemedia.com").replace(/\/+$/, "");

  if (params.get("mode") === "projects") {
    const projectSearch = (params.get("projectSearch") || "").trim().slice(0, 100);
    const projects = await prisma.project.findMany({
      where: {
        status: "PUBLISHED",
        archivedAt: null,
        media: {
          some: {
            visibility: "VISIBLE",
            OR: [
              { mimeType: { startsWith: "image/" } },
              { storageKey: { not: null }, mimeType: null },
            ],
          },
        },
        ...(projectSearch ? {
          OR: [
            { title: { contains: projectSearch, mode: "insensitive" } },
            { details: { propertyAddress: { contains: projectSearch, mode: "insensitive" } } },
          ],
        } : {}),
      },
      take: 50,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        publishedAt: true,
        details: { select: { propertyAddress: true } },
      },
    });
    return NextResponse.json({
      success: true,
      projects: projects.map(project => ({
        id: project.id,
        title: project.title,
        address: project.details?.propertyAddress || null,
      })),
    });
  }

  const selectedProject = projectId ? await prisma.project.findFirst({
    where: {
      id: projectId,
      status: "PUBLISHED",
      archivedAt: null,
      media: {
        some: {
          visibility: "VISIBLE",
          OR: [
            { mimeType: { startsWith: "image/" } },
            { storageKey: { not: null }, mimeType: null },
          ],
        },
      },
    },
    select: { id: true, thumbnailMediaId: true },
  }) : null;
  if (projectId && !selectedProject) {
    return NextResponse.json(
      { success: false, error: "That project is not available in Newsletter Studio." },
      { status: 404 },
    );
  }

  const [media, posts, generated] = await Promise.all([
    (source === "ALL" || source === "PORTFOLIO")
      ? prisma.media.findMany({
          where: {
            visibility: "VISIBLE",
            project: { status: "PUBLISHED", archivedAt: null },
            ...(projectId ? { projectId } : {}),
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
          take: NEWSLETTER_PROJECT_PAGE_SIZE + 1,
          skip: projectId ? (page - 1) * NEWSLETTER_PROJECT_PAGE_SIZE : 0,
          orderBy: projectId ? { displayOrder: "asc" } : { createdAt: "desc" },
          include: { project: { select: { title: true, slug: true } } },
        }) : [],
    !projectId && (source === "ALL" || source === "BLOG")
      ? prisma.blogPost.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { lte: new Date() },
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
    !projectId && (source === "ALL" || source === "AI")
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

  const hasMore = projectId && media.length > NEWSLETTER_PROJECT_PAGE_SIZE;
  const visibleMedia = projectId
    ? orderProjectMedia(media.slice(0, NEWSLETTER_PROJECT_PAGE_SIZE), selectedProject?.thumbnailMediaId)
    : media.slice(0, NEWSLETTER_PROJECT_PAGE_SIZE);
  const items = [
    ...generated.map(item => ({
      id: `ai:${item.id}`, assetId: item.id, source: "AI", url: item.publicUrl,
      thumbnailUrl: item.publicUrl, label: item.altText, altText: item.altText,
      attribution: item.attribution, width: item.width, height: item.height,
    })),
    ...visibleMedia.flatMap(item => {
      const url = safeNewsletterImageUrl(item.storageKey ? getPublicAssetUrl(item.storageKey) : item.externalUrl);
      if (!url) return [];
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
      const url = safeNewsletterImageUrl(item.featuredImageStorageKey
        ? getPublicAssetUrl(item.featuredImageStorageKey) : item.featuredImageUrl);
      if (!url) return [];
      return [{
        id: `blog:${item.id}`, assetId: item.id, source: "BLOG", url,
        thumbnailUrl: url, label: item.title,
        altText: item.featuredImageAlt || item.title,
        attribution: `Helios Blog · ${item.title}`,
        destinationUrl: `${siteUrl}/blog/${item.slug}`,
      }];
    }),
  ];
  return NextResponse.json({ success: true, items, page, hasMore });
}
