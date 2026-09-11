import type { PublishPayload } from "./providers";
import { SOCIAL_PLATFORMS } from "./core";

// Preserve the original payload field order for existing stored digests.
// PostgreSQL JSONB key order must not determine whether approval still matches.
export function normalizePublishingPayload(value: unknown): PublishPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!SOCIAL_PLATFORMS.some((platform) => platform === row.platform) || typeof row.postType !== "string" || typeof row.caption !== "string" || !Array.isArray(row.hashtags) || row.hashtags.some((tag) => typeof tag !== "string") || !Array.isArray(row.media) || (row.destinationLink !== undefined && typeof row.destinationLink !== "string")) return null;
  const media: PublishPayload["media"] = [];
  for (const item of row.media) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = item as Record<string, unknown>;
    if (typeof source.url !== "string" || (source.mimeType !== null && source.mimeType !== undefined && typeof source.mimeType !== "string") || (source.altText !== null && source.altText !== undefined && typeof source.altText !== "string")) return null;
    media.push({ url: source.url, mimeType: source.mimeType as string | null | undefined, altText: source.altText as string | null | undefined });
  }
  return { platform: row.platform as PublishPayload["platform"], postType: row.postType, caption: row.caption, hashtags: row.hashtags as string[], destinationLink: row.destinationLink as string | undefined, media };
}

export function publishingStorageReferenceMatches(workspaceId: string, projectId: string, key: string | null) {
  if (!key) return true;
  if (key.includes("\\") || key.split("/").some((part) => part === "." || part === "..") || /%(?:2f|2e|5c)/i.test(key)) return false;
  const workspace = key.match(/^workspaces\/([^/]+)\//)?.[1];
  const project = key.match(/^projects\/([^/]+)\//)?.[1];
  return (!workspace || workspace === workspaceId) && (!project || project === projectId);
}
