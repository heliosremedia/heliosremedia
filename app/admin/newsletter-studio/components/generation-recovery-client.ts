import type { getNewsletterGenerationRecovery } from "@/lib/newsletters/generation-recovery";

export type GenerationRecoveryReview = Awaited<ReturnType<typeof getNewsletterGenerationRecovery>>;
export async function requestGenerationRecovery(
  editionId: string,
  action?: { expectedVersion: number; runId: string },
  signal?: AbortSignal,
  transport: typeof fetch = fetch,
): Promise<GenerationRecoveryReview | null> {
  const response = await transport(`/api/admin/newsletters/editions/${encodeURIComponent(editionId)}/generation-recovery`, {
    method: action ? "POST" : "GET", cache: "no-store", signal,
    ...(action ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      confirmation: "RETURN_EXPIRED_GENERATION_TO_REVIEW", expectedVersion: action.expectedVersion, runId: action.runId,
    }) } : {}),
  });
  const failure = response.status === 403
    ? "Administrator access is required. Refresh your session before trying again."
    : "Recovery could not be verified. Load a fresh review before trying again.";
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw new Error(failure);
  if (action) return null;
  const review = result.review;
  if (review?.editionId !== editionId || !Number.isSafeInteger(review.rowVersion) || review.rowVersion < 0
    || typeof review.editionStatus !== "string" || typeof review.eligible !== "boolean"
    || review.automaticRetryAllowed !== false || !(review.runId === null || typeof review.runId === "string")
    || (review.eligible && (!review.runId || review.editionStatus !== "GENERATING"))) throw new Error(failure);
  return review as GenerationRecoveryReview;
}
