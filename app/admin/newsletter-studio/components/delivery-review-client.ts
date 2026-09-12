import type { getNewsletterDeliveryReview } from "@/lib/newsletters/delivery-review";

export type DeliveryReview = NonNullable<Awaited<ReturnType<typeof getNewsletterDeliveryReview>>>;
export const deliveryReviewActions = {
  REPAIR_ACCEPTED_DELIVERY_RECORDS: { label: "Repair accepted records", detail: "Fill missing recipient records using matching stored acceptance receipts." },
  RECONCILE_DELIVERY_TOTALS: { label: "Reconcile recorded totals", detail: "Update campaign totals from recorded recipient states." },
  FINALIZE_ACCEPTED_DELIVERY: { label: "Close accepted delivery", detail: "Mark an interrupted delivery as sent only when every recipient has complete acceptance evidence." },
} as const;
export type DeliveryReviewAction = keyof typeof deliveryReviewActions;

export async function requestDeliveryReview(editionId: string, action?: { confirmation: DeliveryReviewAction; expectedVersion: number }, signal?: AbortSignal, transport: typeof fetch = fetch): Promise<DeliveryReview | null> {
  const response = await transport(`/api/admin/newsletters/editions/${encodeURIComponent(editionId)}/delivery-review`, {
    method: action ? "POST" : "GET", cache: "no-store", signal,
    ...(action ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: action.confirmation, expectedVersion: action.expectedVersion }) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(response.status === 403
    ? "Administrator access is required. Refresh your session before trying again."
    : "The delivery could not be reviewed or reconciled. Refresh the review before trying again.");
  if (action) return null;
  if (result.review?.editionId !== editionId || !Number.isSafeInteger(result.review.rowVersion)) throw new Error("The delivery review could not be verified. Refresh the review.");
  return result.review as DeliveryReview;
}
