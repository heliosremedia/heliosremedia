import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getAbsoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ displayOrder: "asc" }, { publishedAt: "desc" }],
    select: {
      slug: true,
      updatedAt: true,
      heroMedia: {
        select: { storageKey: true },
      },
    },
  });

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

  return [...staticPages, ...projectPages];
}
