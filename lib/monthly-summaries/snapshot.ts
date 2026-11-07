import { createHash } from "node:crypto";
import type { Summary } from "./core.ts";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => [k,canonical(v)]));
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const summaryHash = (summary: Summary) => `v2:${digest(canonical(summary))}`;
export function snapshotMatches(summary: Summary, hash: string) {
  if (hash.startsWith("v2:")) return summaryHash(summary) === hash;
  // Verify existing snapshots against the exact field orders used by the old writers.
  // Unknown fields remain in the canonical comparison and cannot be discarded.
  const tails = ["issues", "excludedOrderIds", "source", "reviewNotes", "verificationFailed"];
  const orders = [
    ["month", "clientId", "firstName", "email", "properties", "totalCents", "orderCount", ...tails],
    ["month", "clientId", "firstName", "email", "totalCents", "orderCount", "properties", ...tails],
  ];
  const record = summary as unknown as Record<string, unknown>;
  return orders.some(keys => {
    const rebuilt = Object.fromEntries(keys.filter(k => Object.hasOwn(record,k)).map(k => [k, k === "properties" ? summary.properties.map(p => ({siteId:p.siteId,address:p.address,services:p.services,totalCents:p.totalCents,orderIds:p.orderIds})) : record[k]]));
    return JSON.stringify(canonical(rebuilt)) === JSON.stringify(canonical(summary)) && digest(rebuilt) === hash;
  });
}
