import type { MediaService } from "./service-media";

const VIDEO_COLLECTIONS = [
  { slug: "cinematic-films", label: "Cinematic Films" },
  { slug: "agent-branding", label: "Agent Branding" },
  { slug: "ai-cinematic-films", label: "AI Cinematic Films" },
  { slug: "vertical-reels", label: "Vertical Reels" },
  { slug: "social-content", label: "Social Content" },
] as const;

/** Preserve service IDs and legacy categories; never route a video to Photography by default. */
export function videoMediaServices(services: MediaService[]) {
  return VIDEO_COLLECTIONS.map((collection) => ({
    ...collection,
    service: services.find((service) => service.slug === collection.slug && service.active && !service.archivedAt) ?? null,
  }));
}

export function defaultVideoServiceId(services: MediaService[]) {
  return videoMediaServices(services)[0].service?.id ?? "";
}
