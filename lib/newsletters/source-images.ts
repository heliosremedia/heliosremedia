import type { NewsletterBlockType, NewsletterImageCandidate } from "./types";

export type NewsletterImageMode = "AUTO" | "SOURCE" | "CUSTOM" | "NONE";

export type NewsletterImageSelection = {
  mode: NewsletterImageMode;
  candidateId?: string;
  sourceLabel?: string;
};

export function safeNewsletterImageUrl(value: unknown, custom = false) {
  if (typeof value !== "string" || !value.trim() || value.length > 2_000) return "";
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && !(custom && parsed.protocol === "http:")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function validateCandidateId(
  candidateId: unknown,
  candidates: readonly NewsletterImageCandidate[],
) {
  if (candidateId == null || candidateId === "") return undefined;
  if (typeof candidateId !== "string") throw new Error("Image candidate is invalid.");
  if (!candidates.some((candidate) => candidate.id === candidateId)) {
    throw new Error("Newsletter image is not available from the verified source.");
  }
  return candidateId;
}

const IMAGE_DEFAULTS = new Set<NewsletterBlockType>([
  "HERO", "FEATURED_STORY", "PORTFOLIO_SPOTLIGHT", "SERVICE_SPOTLIGHT", "EVENT_ANNOUNCEMENT",
]);

export function suggestedCandidate(
  type: NewsletterBlockType,
  sourceIds: readonly string[],
  candidates: readonly NewsletterImageCandidate[],
) {
  if (!IMAGE_DEFAULTS.has(type)) return undefined;
  return candidates
    .filter((candidate) => sourceIds.includes(candidate.sourceId))
    .sort((a, b) => a.priority - b.priority)[0];
}

export function preserveManualImage(
  current: Record<string, unknown>,
  replacement: Record<string, unknown>,
) {
  const selection = current.imageSelection;
  const mode = selection && typeof selection === "object"
    ? (selection as { mode?: unknown }).mode : undefined;
  if (mode === "SOURCE" || mode === "CUSTOM" || mode === "NONE") {
    return {
      ...replacement,
      imageUrl: current.imageUrl,
      altText: current.altText,
      imageLink: current.imageLink,
      imageSelection: current.imageSelection,
      imageCandidates: current.imageCandidates,
      imageIsVideo: current.imageIsVideo,
    };
  }
  return replacement;
}
