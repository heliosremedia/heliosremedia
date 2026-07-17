export const MEDIA_COLLECTIONS = [
  {
    value: "PHOTOGRAPHY",
    label: "Photography",
    folder: "photography",
    uploadLabel: "Photography upload",
    dropLabel: "project photography",
  },
  {
    value: "DRONE_PHOTOGRAPHY",
    label: "Drone Photography",
    folder: "drone-photography",
    uploadLabel: "Drone photography upload",
    dropLabel: "drone photography",
  },
  {
    value: "CINEMATIC_FILM",
    label: "Cinematic Film",
    folder: "cinematic-film",
    uploadLabel: "Cinematic film upload",
    dropLabel: "cinematic film imagery",
  },
  {
    value: "VERTICAL_REEL",
    label: "Vertical Reel",
    folder: "vertical-reel",
    uploadLabel: "Vertical reel upload",
    dropLabel: "vertical reel imagery",
  },
  {
    value: "AGENT_BRANDING",
    label: "Agent Branding",
    folder: "agent-branding",
    uploadLabel: "Agent branding upload",
    dropLabel: "agent branding imagery",
  },
  {
    value: "SOCIAL_CONTENT",
    label: "Social Content",
    folder: "social-content",
    uploadLabel: "Social content upload",
    dropLabel: "social content imagery",
  },
  {
    value: "FLOOR_PLAN",
    label: "Floor Plans",
    folder: "floor-plan",
    uploadLabel: "Floor plan upload",
    dropLabel: "floor plan images",
  },
  {
    value: "MATTERPORT",
    label: "Matterport",
    folder: "matterport",
    uploadLabel: "Matterport upload",
    dropLabel: "Matterport imagery",
  },
  {
    value: "PROPERTY_WEBSITE",
    label: "Property Website",
    folder: "property-website",
    uploadLabel: "Property website upload",
    dropLabel: "property website imagery",
  },
  {
    value: "OTHER",
    label: "Other",
    folder: "other",
    uploadLabel: "Other media upload",
    dropLabel: "media images",
  },
] as const;

export type MediaCategory =
  (typeof MEDIA_COLLECTIONS)[number]["value"];

export const DEFAULT_MEDIA_CATEGORY: MediaCategory = "PHOTOGRAPHY";

export function isMediaCategory(
  value: unknown,
): value is MediaCategory {
  return (
    typeof value === "string" &&
    MEDIA_COLLECTIONS.some(
      (collection) => collection.value === value,
    )
  );
}

export function getMediaCollection(mediaCategory: MediaCategory) {
  return (
    MEDIA_COLLECTIONS.find(
      (collection) => collection.value === mediaCategory,
    ) ?? MEDIA_COLLECTIONS[0]
  );
}