import "server-only";

import { tryResolveExternalMedia } from "@/lib/external-media";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { gallerySlice, orderDiscoveryAssets, stableRotationSeed, type PortfolioOrderingMode } from "@/lib/portfolio-discovery-core";

export type DiscoveryPhoto = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  project: { id: string; title: string; slug: string };
};

export type DiscoveryFilm = {
  id: string;
  title: string;
  externalUrl: string;
  posterUrl: string;
  aspectRatio: number;
  filmType: string;
  project: { id: string; title: string; slug: string; location: string | null };
};

type DiscoveryOptions = {
  workspaceId: string;
  mode: PortfolioOrderingMode;
  excludedProjectIds: string[];
  excludedMediaIds: string[];
  offset: number;
  count: number;
  seed?: string;
};

function orderSeed(seed?: string) {
  return (seed || stableRotationSeed()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
}

export async function getDiscoveryPhotos(options: DiscoveryOptions) {
  const media = await prisma.media.findMany({
    where: {
      project: { workspaceId: options.workspaceId, status: "PUBLISHED", id: { notIn: options.excludedProjectIds } },
      id: { notIn: options.excludedMediaIds },
      visibility: "VISIBLE",
      sourceType: "UPLOADED_IMAGE",
      mediaCategory: { in: ["PHOTOGRAPHY", "DRONE_PHOTOGRAPHY"] },
      storageKey: { not: null },
    },
    orderBy: [{ project: { displayOrder: "asc" } }, { displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, storageKey: true, originalFilename: true, altText: true, caption: true,
      width: true, height: true, aspectRatio: true, displayOrder: true, createdAt: true,
      project: { select: { id: true, title: true, slug: true, displayOrder: true } },
    },
  });
  const eligible = media.flatMap((item) => {
    if (!item.storageKey) return [];
    const width = item.width || (item.aspectRatio && item.aspectRatio < 1 ? 1200 : 1800);
    const height = item.height || (item.aspectRatio ? Math.round(width / item.aspectRatio) : 1200);
    return [{
      ...item,
      projectId: item.project.id,
      projectOrder: item.project.displayOrder,
      mediaOrder: item.displayOrder,
      width,
      height,
      imageUrl: getPublicAssetUrl(item.storageKey),
      alt: item.altText || item.originalFilename || `${item.project.title} photography`,
      project: { id: item.project.id, title: item.project.title, slug: item.project.slug },
    }];
  });
  const ordered = orderDiscoveryAssets(eligible, options.mode, orderSeed(options.seed));
  const page = gallerySlice(ordered, options.offset, options.count);
  return { ...page, items: page.items.map(({ id, imageUrl, width, height, alt, caption, project }) => ({ id, imageUrl, width, height, alt, caption, project })) };
}

export async function getDiscoveryFilms(options: DiscoveryOptions) {
  const media = await prisma.media.findMany({
    where: {
      project: { workspaceId: options.workspaceId, status: "PUBLISHED", id: { notIn: options.excludedProjectIds } },
      id: { notIn: options.excludedMediaIds },
      visibility: "VISIBLE",
      sourceType: { in: ["VIDEO_EMBED", "UPLOADED_VIDEO"] },
      mediaCategory: { in: ["CINEMATIC_FILM", "AGENT_BRANDING", "VERTICAL_REEL", "SOCIAL_CONTENT"] },
      externalUrl: { not: null },
    },
    orderBy: [{ project: { displayOrder: "asc" } }, { displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, originalFilename: true, externalUrl: true, mediaCategory: true, aspectRatio: true,
      width: true, height: true, displayOrder: true, createdAt: true,
      comparisonPlacement: { select: { publicTitle: true, posterOverrideUrl: true } },
      service: { select: { name: true } },
      project: { select: { id: true, title: true, slug: true, displayOrder: true, locationLabel: true, city: true, state: true } },
    },
  });
  const eligible = media.flatMap((item) => {
    if (!item.externalUrl) return [];
    const resolved = tryResolveExternalMedia(item.externalUrl);
    const posterUrl = item.comparisonPlacement?.posterOverrideUrl || resolved?.thumbnailUrl;
    if (!posterUrl || (!resolved?.embedUrl && !resolved?.playbackUrl)) return [];
    const aspectRatio = item.aspectRatio || (item.width && item.height ? item.width / item.height : item.mediaCategory === "VERTICAL_REEL" ? 9 / 16 : 16 / 9);
    return [{
      ...item,
      projectId: item.project.id,
      projectOrder: item.project.displayOrder,
      mediaOrder: item.displayOrder,
      aspectRatio,
      posterUrl,
      title: item.comparisonPlacement?.publicTitle || item.originalFilename || item.project.title,
      filmType: item.service.name,
      project: {
        id: item.project.id, title: item.project.title, slug: item.project.slug,
        location: item.project.locationLabel || [item.project.city, item.project.state].filter(Boolean).join(", ") || null,
      },
    }];
  });
  const ordered = orderDiscoveryAssets(eligible, options.mode, orderSeed(options.seed));
  const page = gallerySlice(ordered, options.offset, options.count);
  return { ...page, items: page.items.map(({ id, title, externalUrl, posterUrl, aspectRatio, filmType, project }) => ({ id, title, externalUrl: externalUrl!, posterUrl, aspectRatio, filmType, project })) };
}
