import { prisma } from "@/lib/prisma";
import { getMediaCollection } from "@/lib/media-collections";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { getSiteSettings } from "@/lib/site-settings";
import BlogStudio, { type BlogEditorPost, type BlogImageOption } from "./BlogStudio";
import type { BlogSeriesEditor } from "./BlogSeriesPanel";

export const dynamic = "force-dynamic";

export default async function BlogStudioPage() {
  const [posts, media, settings, seriesRows] = await Promise.all([
    prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" }, include: { featuredMedia: { select: { storageKey: true } } } }),
    prisma.media.findMany({
      where: { sourceType: "UPLOADED_IMAGE", visibility: "VISIBLE", storageKey: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, projectId: true, storageKey: true, altText: true, caption: true, mediaCategory: true, project: { select: { title: true, locationLabel: true } } },
    }),
    getSiteSettings(),
    prisma.blogSeries.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);
  const serialized: BlogEditorPost[] = posts.map(post => ({
    ...post,
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() || null,
    publishedAt: post.publishedAt?.toISOString() || null,
    archivedAt: post.archivedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(),
    sourceLinks: Array.isArray(post.sourceLinks) ? post.sourceLinks.filter((item): item is string => typeof item === "string") : [],
  }));
  const images: BlogImageOption[] = media.map(item => ({
    id: item.id, url: getPublicAssetUrl(item.storageKey!), alt: item.altText || item.caption || item.project.title,
    projectId: item.projectId,
    property: item.project.title,
    location: item.project.locationLabel || "",
    caption: item.caption || "",
    category: item.mediaCategory,
    categoryLabel: getMediaCollection(item.mediaCategory).label,
  }));
  const series: BlogSeriesEditor[] = seriesRows.map(item=>({
    ...item, nextPublishAt:item.nextPublishAt?.toISOString()||null,
    contentPillars:Array.isArray(item.contentPillars)?item.contentPillars.filter((value):value is string=>typeof value==="string"):[],
  }));
  return <BlogStudio initialPosts={serialized} images={images} defaultAuthor={settings.defaultBlogAuthor || settings.businessName} series={series} />;
}
