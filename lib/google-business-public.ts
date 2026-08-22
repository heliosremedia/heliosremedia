export type GoogleReviewDisplayMode = "FOUR_AND_FIVE" | "FIVE_ONLY" | "MANUAL_ONLY";

export const DEFAULT_GOOGLE_REVIEW_DISPLAY_MODE: GoogleReviewDisplayMode = "FOUR_AND_FIVE";

export function normalizeGoogleReviewDisplayMode(value: unknown): GoogleReviewDisplayMode {
  return value === "FIVE_ONLY" || value === "MANUAL_ONLY" ? value : DEFAULT_GOOGLE_REVIEW_DISPLAY_MODE;
}

export function automaticReviewIsPublic(starRating: number, mode: GoogleReviewDisplayMode) {
  if (mode === "MANUAL_ONLY") return false;
  return starRating >= (mode === "FIVE_ONLY" ? 5 : 4);
}

export function reviewIsPublic(starRating: number, override: boolean | null, mode: GoogleReviewDisplayMode) {
  return override ?? automaticReviewIsPublic(starRating, mode);
}

export function publicGoogleReviewWhere(workspaceId: string, mode: GoogleReviewDisplayMode) {
  const minimumRating = mode === "FIVE_ONLY" ? 5 : 4;
  return {
    workspaceId,
    reviewText: { not: null },
    syncStatus: "CURRENT" as const,
    ...(mode === "MANUAL_ONLY"
      ? { publicVisibilityOverride: true }
      : { OR: [{ publicVisibilityOverride: true }, { publicVisibilityOverride: null, starRating: { gte: minimumRating } }] }),
  };
}
