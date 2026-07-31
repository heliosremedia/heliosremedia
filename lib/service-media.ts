import type { MediaCategory } from "@/lib/media-collections";

export type MediaService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  displayOrder: number;
  archivedAt?: string | null;
};

const LEGACY_CATEGORY_BY_SLUG: Record<string, MediaCategory> = {
  photography: "PHOTOGRAPHY",
  "drone-photography": "DRONE_PHOTOGRAPHY",
  "cinematic-films": "CINEMATIC_FILM",
  "vertical-reels": "VERTICAL_REEL",
  "agent-branding": "AGENT_BRANDING",
  "social-content": "SOCIAL_CONTENT",
  "floor-plans": "FLOOR_PLAN",
  matterport: "MATTERPORT",
  "property-websites": "PROPERTY_WEBSITE",
};

export function mediaCategoryForServiceSlug(slug: string): MediaCategory {
  return LEGACY_CATEGORY_BY_SLUG[slug] ?? "OTHER";
}

export function mediaFolderForService(service: Pick<MediaService, "id" | "slug">) {
  const safeSlug = service.slug.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safeSlug || "service"}-${service.id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}
