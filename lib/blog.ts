import "server-only";

import { getPublicAssetUrl } from "@/lib/r2-upload";

export function slugifyBlogTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function blogImageUrl(post: {
  featuredImageStorageKey?: string | null;
  featuredImageUrl?: string | null;
  featuredMedia?: { storageKey: string | null } | null;
}) {
  if (post.featuredImageStorageKey) return getPublicAssetUrl(post.featuredImageStorageKey);
  if (post.featuredMedia?.storageKey) return getPublicAssetUrl(post.featuredMedia.storageKey);
  return post.featuredImageUrl || null;
}

export function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 220));
}
