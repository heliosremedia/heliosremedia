import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getPublishedLocationPages } from "@/lib/location-pages";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getCanonicalAbsoluteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublicWorkspaceId } from "@/lib/public-workspace";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [workspaceId, settings] = await Promise.all([getPublicWorkspaceId(), getSiteSettings()]);
  const absolute = (path: string) => getCanonicalAbsoluteUrl(path, settings.websiteUrl);
  const [projects, services, legalDocuments, locations, blogPosts] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId, status: "PUBLISHED" },
      orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }],
      select: {
        slug: true,
        updatedAt: true,
        heroMedia: {
          select: { storageKey: true },
        },
      },
    }),
    prisma.service.findMany({ where: { workspaceId, active: true, archivedAt: null }, select: { slug: true, updatedAt: true } }),
    prisma.legalDocument.findMany({ where: { published: true }, select: { type: true, updatedAt: true } }),
    getPublishedLocationPages(),
    prisma.blogPost.findMany({ where: { OR: [{ status: "PUBLISHED", publishedAt: { lte: new Date() } }, { status: "SCHEDULED", scheduledAt: { lte: new Date() } }] }, select: { slug: true, updatedAt: true } }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: absolute("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absolute("/portfolio"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absolute("/services"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absolute("/films"),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: absolute("/photo-finishes"),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: absolute("/about"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absolute("/faq"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absolute("/contact"),
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: absolute("/blog"),
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: absolute("/google-business-integration"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absolute("/reviews"),
      changeFrequency: "weekly",
      priority: 0.75,
    },
  ];

  const projectPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: absolute(`/portfolio/${project.slug}`),
    lastModified: project.updatedAt,
    changeFrequency: "monthly",
    priority: 0.8,
    images: project.heroMedia?.storageKey
      ? [getPublicAssetUrl(project.heroMedia.storageKey)]
      : undefined,
  }));

  const locationPages: MetadataRoute.Sitemap = locations.map(
    (location) => ({
      url: absolute(`/locations/${location.slug}`),
      lastModified: location.updatedAt,
      changeFrequency: "monthly",
      priority: 0.85,
    }),
  );

  const servicePages: MetadataRoute.Sitemap = services.map((service) => ({
    url: absolute(`/services/${service.slug}`),
    lastModified: service.updatedAt,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const legalPages: MetadataRoute.Sitemap = legalDocuments.map((document) => ({
    url: absolute(document.type === "PRIVACY_POLICY" ? "/privacy" : "/terms"),
    lastModified: document.updatedAt,
    changeFrequency: "yearly",
    priority: 0.2,
  }));
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({ url: absolute(`/blog/${post.slug}`), lastModified: post.updatedAt, changeFrequency: "monthly", priority: 0.7 }));

  return [
    ...staticPages,
    ...locationPages,
    ...servicePages,
    ...projectPages,
    ...blogPages,
    ...legalPages,
  ];
}
