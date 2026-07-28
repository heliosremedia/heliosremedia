export const SOCIAL_TIME_ZONE = "America/Denver";

export const SOCIAL_PLATFORMS = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "OTHER"] as const;
export type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];

export const POST_TYPES: Record<SocialPlatformName, readonly string[]> = {
  INSTAGRAM: ["SINGLE_IMAGE", "CAROUSEL", "REEL", "STORY_CONCEPT"],
  FACEBOOK: ["TEXT_POST", "IMAGE_POST", "MULTI_IMAGE_POST", "VIDEO_POST", "LINK_POST"],
  LINKEDIN: ["TEXT_POST", "IMAGE_POST", "MULTI_IMAGE_CONCEPT", "VIDEO_POST", "LINK_POST"],
  TIKTOK: ["VIDEO_POST", "PHOTO_POST_CONCEPT", "DRAFT_EXPORT"],
  OTHER: ["CAPTION_AND_MEDIA", "TEXT_POST", "VIDEO_CONCEPT"],
};

export const VARIANT_STATES = [
  "DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "READY_TO_PUBLISH", "PUBLISHED", "FAILED", "ARCHIVED",
] as const;
export type VariantState = (typeof VARIANT_STATES)[number];

export function deriveCampaignStatus(states: VariantState[]) {
  if (!states.length) return "DRAFT";
  if (states.every((state) => state === "ARCHIVED")) return "ARCHIVED";
  if (states.some((state) => state === "FAILED")) return "ATTENTION";
  if (states.every((state) => state === "PUBLISHED" || state === "ARCHIVED")) return "PUBLISHED";
  if (states.some((state) => state === "READY_TO_PUBLISH")) return "READY_TO_PUBLISH";
  if (states.some((state) => state === "NEEDS_REVIEW" || state === "CHANGES_REQUESTED" || state === "DRAFT")) return "IN_REVIEW";
  if (states.some((state) => state === "SCHEDULED")) return "SCHEDULED";
  if (states.some((state) => state === "APPROVED")) return "APPROVED";
  return "DRAFT";
}

export function contentEditState(state: VariantState) {
  if (state === "PUBLISHED") throw new Error("Published variants are immutable. Create a new campaign or variant revision instead.");
  return ["APPROVED", "SCHEDULED", "READY_TO_PUBLISH"].includes(state) ? "NEEDS_REVIEW" : state;
}

export function canApprove(input: { caption?: string | null; postType: string; mediaCount: number; hasGeneratedCover?: boolean }) {
  return Boolean(input.caption?.trim()) && (
    ["TEXT_POST", "LINK_POST"].includes(input.postType) || input.mediaCount > 0 || input.hasGeneratedCover === true
  );
}

export function scheduleState(state: VariantState, scheduledAt: Date | null) {
  if (!scheduledAt) return state === "SCHEDULED" ? "APPROVED" : state;
  if (!["APPROVED", "SCHEDULED", "READY_TO_PUBLISH"].includes(state)) {
    throw new Error("Only approved content can be scheduled.");
  }
  return "SCHEDULED" as const;
}

export function readyState(state: VariantState, scheduledAt: Date | null, now: Date) {
  return state === "SCHEDULED" && scheduledAt && scheduledAt <= now ? "READY_TO_PUBLISH" : state;
}

export function mediaWarning(input: {
  postType: string;
  mimeType?: string | null;
  aspectRatio?: number | null;
}) {
  const wantsVideo = ["REEL", "VIDEO_POST", "DRAFT_EXPORT"].includes(input.postType);
  const isVideo = Boolean(input.mimeType?.startsWith("video/"));
  if (wantsVideo && !isVideo) return "This format normally requires video.";
  if (!wantsVideo && input.postType !== "TEXT_POST" && isVideo) return "This format expects an image.";
  if (["REEL", "STORY_CONCEPT", "VIDEO_POST"].includes(input.postType) && input.aspectRatio && input.aspectRatio > 0.8) {
    return "A 9:16 presentation is recommended for this format.";
  }
  return null;
}

export function platformPrompt(platform: SocialPlatformName) {
  return {
    INSTAGRAM: "Use a strong visual hook, a concise story, selective relevant hashtags, and a restrained call to action.",
    FACEBOOK: "Use conversational context, readable paragraph structure, useful information, and a natural engagement prompt when appropriate.",
    LINKEDIN: "Offer professional insight, business relevance, real-estate marketing value, and a clear point of view without corporate filler.",
    TIKTOK: "Lead immediately, keep the caption short, and include on-screen text plus a practical video structure or shot order.",
    OTHER: "Create a provider-neutral draft with a clear opening, adaptable body copy, restrained hashtags, and an honest manual-publishing handoff.",
  }[platform];
}

export type SeriesFrequency = "WEEKLY" | "MONTHLY";

export function recurrenceDates(input: {
  startsAt: Date;
  through: Date;
  frequency: SeriesFrequency;
  interval: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour: number;
  minute: number;
}) {
  const interval = Math.min(52, Math.max(1, Math.trunc(input.interval)));
  const results: Date[] = [];
  const cursor = new Date(input.startsAt);
  cursor.setSeconds(0, 0);
  if (input.frequency === "WEEKLY") {
    const wanted = Math.min(6, Math.max(0, input.dayOfWeek ?? cursor.getDay()));
    cursor.setDate(cursor.getDate() + ((wanted - cursor.getDay() + 7) % 7));
  } else {
    const wanted = Math.min(31, Math.max(1, input.dayOfMonth ?? cursor.getDate()));
    cursor.setDate(Math.min(wanted, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()));
  }
  cursor.setHours(input.hour, input.minute, 0, 0);
  while (cursor <= input.through && results.length < 104) {
    if (cursor >= input.startsAt) results.push(new Date(cursor));
    if (input.frequency === "WEEKLY") cursor.setDate(cursor.getDate() + 7 * interval);
    else {
      const wanted = Math.min(31, Math.max(1, input.dayOfMonth ?? cursor.getDate()));
      cursor.setMonth(cursor.getMonth() + interval, 1);
      cursor.setDate(Math.min(wanted, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()));
    }
  }
  return results;
}

export function sanitizedVerifiedFacts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, fact]) => ["string", "number", "boolean"].includes(typeof fact) && fact !== "")
      .slice(0, 50),
  );
}

export function normalizeAiCampaignBrief(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const text = (key: string, max: number) => typeof row[key] === "string" ? row[key].trim().slice(0, max) : "";
  const positioning = text("positioning", 3000);
  const themes = Array.isArray(row.themes) ? row.themes.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 300)).filter(Boolean).slice(0, 12) : [];
  const formats = Array.isArray(row.formats) ? row.formats.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 300)).filter(Boolean).slice(0, 12) : [];
  if (!positioning || !themes.length) return null;
  return {
    positioning,
    themes,
    cadence: text("cadence", 1000),
    formats,
    platformConsiderations: text("platformConsiderations", 3000),
    callsToAction: text("callsToAction", 2000),
  };
}
