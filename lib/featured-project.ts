export type FeaturedDuration = "NONE" | "7_DAYS" | "14_DAYS" | "30_DAYS" | "ALWAYS";

const DAYS: Record<Exclude<FeaturedDuration, "NONE" | "ALWAYS">, number> = {
  "7_DAYS": 7,
  "14_DAYS": 14,
  "30_DAYS": 30,
};

export function featuredWindow(duration: FeaturedDuration, now = new Date()) {
  if (duration === "NONE") return { featured: false, featuredStartedAt: null, featuredExpiresAt: null };
  if (duration === "ALWAYS") return { featured: true, featuredStartedAt: now, featuredExpiresAt: null };
  return {
    featured: true,
    featuredStartedAt: now,
    featuredExpiresAt: new Date(now.getTime() + DAYS[duration] * 86_400_000),
  };
}

export function isActivelyFeatured(project: {
  featured: boolean;
  featuredExpiresAt: Date | string | null;
}, now = new Date()) {
  return project.featured &&
    (!project.featuredExpiresAt || new Date(project.featuredExpiresAt).getTime() > now.getTime());
}

export function remainingFeaturedTime(expiresAt: Date | string | null, now = new Date()) {
  if (!expiresAt) return null;
  return Math.max(0, new Date(expiresAt).getTime() - now.getTime());
}
