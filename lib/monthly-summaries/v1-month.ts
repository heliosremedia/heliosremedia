import { checkExistingConnection } from "./v1-check.ts";
import { buildV1Draft, PreviewValidationError } from "./v1-preview.ts";
import { requireCompletedMonth, type Summary } from "./core.ts";
export type DirectoryClient = { id: string; hdPhotoHubUserId: number; displayName: string; normalizedEmail: string };
export const V1_REVIEW_NOTES = [
  "Draft from the synced client directory. Confirm the directory and account order lists are complete.",
  "Dates use the API calendar month. Month-boundary timezone behavior still needs confirmation.",
  "Property ownership is checked separately from the purchaser; billed-client identity needs review.",
  "Missing returned amounts remain unknown. Confirm cancellations, credits and refunds before client delivery.",
];
export async function prepareV1Month(input: { month: string; clients: DirectoryClient[]; apiKey: string; reader?: typeof checkExistingConnection; now?: () => number }) {
  requireCompletedMonth(input.month);
  if (!input.apiKey.trim()) throw new Error("The existing HDPhotoHub connection is not configured.");
  if (!input.clients.length) throw new Error("Sync the client directory before generating summaries.");
  if (input.clients.length > 2000) throw new Error("The directory exceeds the review-generation limit.");
  const ids = new Set(input.clients.map(c => c.hdPhotoHubUserId));
  if (ids.size !== input.clients.length) throw new Error("Duplicate client IDs in the directory.");
  const now = input.now || Date.now;
  const deadline = now() + 230_000;
  const prepared: { clientId: string; summary: Summary }[] = [];
  let next = 0;
  let expired = false;
  const reader = input.reader || checkExistingConnection;
  async function worker() {
    while (next < input.clients.length && !expired) {
      if (now() > deadline) { expired = true; return; }
      const local = input.clients[next++];
      let summary: Summary = { month: input.month, clientId: local.hdPhotoHubUserId, firstName: local.displayName.split(/\s+/)[0], email: local.normalizedEmail, properties: [], totalCents: 0, orderCount: 0, issues: [], excludedOrderIds: [], source: "v1-review", reviewNotes: V1_REVIEW_NOTES };
      try {
        const result = await reader({ apiKey: input.apiKey, clientId: local.hdPhotoHubUserId, clientName: local.displayName, month: input.month, authorizeClient: async id => ids.has(id) });
        if (result.clientId !== local.hdPhotoHubUserId || result.month !== input.month) throw new Error("Account response did not match the requested client and month.");
        if (result.orders.length) {
          const draft = buildV1Draft(result);
          summary = { ...draft, email: local.normalizedEmail, source: "v1-review", reviewNotes: V1_REVIEW_NOTES };
          if (result.email !== local.normalizedEmail) summary.issues.push("Directory email differs from HDPhotoHub. Sync and review.");
          if (result.accountStatus !== "active") summary.issues.push("The HDPhotoHub client account is not confirmed active.");
        }
      } catch (error) {
        // A failed account remains visible; it must never be mistaken for no purchases.
        summary.issues.push(error instanceof PreviewValidationError ? error.message : "This account could not be verified. Run its connection check and retry generation.");
      }
      prepared.push({ clientId: local.id, summary });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, input.clients.length) }, worker));
  if (expired || now() > deadline || prepared.length !== input.clients.length) throw new Error("Reading the directory timed out. No partial month was saved. Retry generation.");
  const orderOwners = new Map<number, number>();
  for (const { summary } of prepared) for (const property of summary.properties) for (const orderId of property.orderIds) {
    if (orderOwners.has(orderId)) throw new Error("An order appeared under multiple accounts. No month was saved; review account associations.");
    orderOwners.set(orderId, summary.clientId);
  }
  return prepared;
}
