import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getPublishedLocationPages } from "@/lib/location-pages";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getAbsoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, services, legalDocuments, locations] = await Promise.all([
    prisma.project.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }],
      select: {
        slug: true,
        updatedAt: true,
        heroMedia: {
          select: { storageKey: true },
        },
      },
    }),
    prisma.service.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    prisma.legalDocument.findMany({ where: { published: true }, select: { type: true, updatedAt: true } }),
    getPublishedLocationPages(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/portfolio"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl("/services"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: getAbsoluteUrl("/faq"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: getAbsoluteUrl("/contact"),
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];

  const projectPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: getAbsoluteUrl(`/portfolio/${project.slug}`),
    lastModified: project.updatedAt,
    changeFrequency: "monthly",
    priority: 0.8,
    images: project.heroMedia?.storageKey
      ? [getPublicAssetUrl(project.heroMedia.storageKey)]
      : undefined,
  }));

  const locationPages: MetadataRoute.Sitemap = locations.map(
    (location) => ({
      url: getAbsoluteUrl(`/locations/${location.slug}`),
      lastModified: location.updatedAt,
      changeFrequency: "monthly",
      priority: 0.85,
    }),
  );

  const servicePages: MetadataRoute.Sitemap = services.map((service) => ({
    url: getAbsoluteUrl(`/services/${service.slug}`),
    lastModified: service.updatedAt,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  const legalPages: MetadataRoute.Sitemap = legalDocuments.map((document) => ({
    url: getAbsoluteUrl(document.type === "PRIVACY_POLICY" ? "/privacy" : "/terms"),
    lastModified: document.updatedAt,
    changeFrequency: "yearly",
    priority: 0.2,
  }));

  return [
    ...staticPages,
    ...locationPages,
    ...servicePages,
    ...projectPages,
    ...legalPages,
  ];
}
