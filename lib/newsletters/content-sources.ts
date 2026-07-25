import "server-only";

import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { tryResolveExternalMedia } from "@/lib/external-media";
import type { NewsletterSourceReference } from "@/lib/newsletters/ai";
import type { NewsletterImageCandidate } from "./types";
import { safeNewsletterImageUrl } from "./source-images";

function excerpt(value: string | null | undefined, max = 4_000) {
  return (value ?? "").trim().slice(0, max);
}

function candidate(input: NewsletterImageCandidate): NewsletterImageCandidate | null {
  const url = safeNewsletterImageUrl(input.url);
  if (!url) return null;
  return { ...input, url, thumbnailUrl: safeNewsletterImageUrl(input.thumbnailUrl) || undefined };
}

export async function collectVerifiedNewsletterSources(selection: {
  blogPostIds?: string[];
  projectIds?: string[];
  serviceIds?: string[];
  includeWebsiteContent?: boolean;
}): Promise<NewsletterSourceReference[]> {
  const blogPostIds = [...new Set(selection.blogPostIds ?? [])].slice(0, 30);
  const projectIds = [...new Set(selection.projectIds ?? [])].slice(0, 30);
  const serviceIds = [...new Set(selection.serviceIds ?? [])].slice(0, 30);
  const [posts, projects, services, settings] = await Promise.all([
    blogPostIds.length ? prisma.blogPost.findMany({
      where: { id: { in: blogPostIds }, status: "PUBLISHED", publishedAt: { lte: new Date() } },
      select: {
        id: true, title: true, excerpt: true, content: true, slug: true, sourceLinks: true,
        featuredImageStorageKey: true, featuredImageUrl: true, featuredImageAlt: true,
        featuredMedia: { select: { id: true, storageKey: true, altText: true, caption: true, width: true, height: true } },
      },
    }) : [],
    projectIds.length ? prisma.project.findMany({
      where: { id: { in: projectIds }, status: "PUBLISHED" },
      select: {
        id: true, title: true, slug: true, shortDescription: true, description: true,
        city: true, state: true, locationLabel: true, projectType: true, propertyType: true,
        thumbnailMediaId: true, heroMediaId: true,
        media: {
          where: { visibility: "VISIBLE" },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true, sourceType: true, mediaCategory: true, storageKey: true, externalUrl: true,
            altText: true, caption: true, width: true, height: true, displayOrder: true,
          },
        },
      },
    }) : [],
    serviceIds.length ? prisma.service.findMany({
      where: { id: { in: serviceIds }, active: true },
      select: {
        id: true, name: true, slug: true, description: true, heroImageStorageKey: true, heroImageAlt: true,
        projects: {
          where: { project: { status: "PUBLISHED" } },
          take: 6,
          select: {
            project: {
              select: {
                id: true, title: true, slug: true,
                thumbnailMedia: { select: { id: true, storageKey: true, altText: true, width: true, height: true } },
              },
            },
          },
        },
      },
    }) : [],
    selection.includeWebsiteContent ? prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: {
        businessName: true, phoneDisplay: true, email: true, websiteUrl: true,
        serviceArea: true, serviceAreaDescription: true, footerDescription: true,
        standardBody: true, workBody: true, approachBody: true,
      },
    }) : null,
  ]);
  const base = getSiteUrl();
  const sources: NewsletterSourceReference[] = [
    ...posts.map((post) => {
      const sourceId = `blog:${post.id}`;
      const destinationUrl = `${base}/blog/${post.slug}`;
      const imageUrl = post.featuredMedia?.storageKey
        ? getPublicAssetUrl(post.featuredMedia.storageKey)
        : post.featuredImageStorageKey ? getPublicAssetUrl(post.featuredImageStorageKey) : post.featuredImageUrl;
      const image = imageUrl ? candidate({
        id: `${sourceId}:featured`, sourceId, sourceKind: "BLOG_POST", sourceRecordId: post.id,
        url: imageUrl, altText: post.featuredImageAlt || post.featuredMedia?.altText || undefined,
        label: "Published article featured image", role: "FEATURED_IMAGE", priority: 10,
        width: post.featuredMedia?.width || undefined, height: post.featuredMedia?.height || undefined,
        destinationUrl,
      }) : null;
      return {
        id: sourceId, kind: "BLOG_POST", label: post.title,
        excerpt: excerpt([post.excerpt, post.content].filter(Boolean).join("\n\n")),
        url: destinationUrl, imageCandidates: image ? [image] : [],
      };
    }),
    ...projects.map((project) => {
      const sourceId = `project:${project.id}`;
      const destinationUrl = `${base}/portfolio/${project.slug}`;
      const images = project.media.flatMap((media) => {
        const uploaded = media.storageKey ? getPublicAssetUrl(media.storageKey) : null;
        const external = media.externalUrl ? tryResolveExternalMedia(media.externalUrl) : null;
        const imageUrl = uploaded || external?.thumbnailUrl;
        if (!imageUrl) return [];
        const isVideo = Boolean(external?.thumbnailUrl) ||
          ["VERTICAL_REEL", "CINEMATIC_FILM", "SOCIAL_CONTENT"].includes(media.mediaCategory);
        const role = media.id === project.thumbnailMediaId ? "PORTFOLIO_COVER"
          : media.id === project.heroMediaId ? "HERO_IMAGE"
            : isVideo ? "REEL_THUMBNAIL" : "GALLERY_IMAGE";
        const priority = role === "PORTFOLIO_COVER" ? 10 : role === "HERO_IMAGE" ? 20
          : role === "REEL_THUMBNAIL" ? 30 : 40 + media.displayOrder;
        const item = candidate({
          id: `${sourceId}:media:${media.id}`, sourceId, sourceKind: "PROJECT", sourceRecordId: project.id,
          url: imageUrl, altText: media.altText || media.caption || undefined,
          label: role === "REEL_THUMBNAIL" ? `${project.title} reel thumbnail` : `${project.title} ${role.toLowerCase().replaceAll("_", " ")}`,
          role, priority, width: media.width || undefined, height: media.height || undefined,
          destinationUrl, isVideo,
        });
        return item ? [item] : [];
      }).sort((a, b) => a.priority - b.priority);
      return {
        id: sourceId, kind: "PROJECT", label: project.title,
        excerpt: excerpt([
        project.shortDescription, project.description, project.locationLabel,
        [project.city, project.state].filter(Boolean).join(", "), project.projectType, project.propertyType,
      ].filter(Boolean).join("\n")),
        url: destinationUrl, imageCandidates: images,
      };
    }),
    ...services.map((service) => {
      const sourceId = `service:${service.id}`;
      const destinationUrl = `${base}/services/${service.slug}`;
      const image = service.heroImageStorageKey ? candidate({
        id: `${sourceId}:featured`, sourceId, sourceKind: "SERVICE", sourceRecordId: service.id,
        url: getPublicAssetUrl(service.heroImageStorageKey), altText: service.heroImageAlt || undefined,
        label: `${service.name} service image`, role: "SERVICE_IMAGE", priority: 10, destinationUrl,
      }) : null;
      const related = service.projects.flatMap(({ project }, index) => {
        if (!project.thumbnailMedia?.storageKey) return [];
        const item = candidate({
          id: `${sourceId}:project:${project.id}`, sourceId, sourceKind: "SERVICE", sourceRecordId: service.id,
          url: getPublicAssetUrl(project.thumbnailMedia.storageKey),
          altText: project.thumbnailMedia.altText || undefined,
          label: `${service.name} work — ${project.title}`, role: "RELATED_PORTFOLIO_IMAGE",
          priority: 20 + index, width: project.thumbnailMedia.width || undefined,
          height: project.thumbnailMedia.height || undefined,
          destinationUrl: `${base}/portfolio/${project.slug}`,
        });
        return item ? [item] : [];
      });
      return {
        id: sourceId, kind: "SERVICE", label: service.name,
        excerpt: excerpt(service.description), url: destinationUrl,
        imageCandidates: [...(image ? [image] : []), ...related],
      };
    }),
  ];
  if (settings) {
    sources.push({
      id: "website:site-settings", kind: "WEBSITE_CONTENT", label: settings.businessName,
      excerpt: excerpt([
        settings.serviceArea, settings.serviceAreaDescription, settings.footerDescription,
        settings.standardBody, settings.workBody, settings.approachBody,
        settings.phoneDisplay, settings.email,
      ].filter(Boolean).join("\n")),
      url: settings.websiteUrl || base,
    });
  }
  return sources;
}
