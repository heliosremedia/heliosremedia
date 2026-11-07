import type { Summary } from "./core.ts";
export function accountCheckFailed(summary: Summary) {
  return summary.verificationFailed === true || (summary.source === "v1-review" && summary.orderCount === 0 && summary.issues.includes("This account could not be verified. Run its connection check and retry generation."));
}
export function draftStatus(summary: Summary) {
  if (accountCheckFailed(summary)) return "CHECK_FAILED";
  if (summary.issues.length || (summary.source === "v1-review" && summary.orderCount)) return "NEEDS_REVIEW";
  return summary.orderCount ? "READY" : "NO_PURCHASES";
}
export function generationCounts(prepared: { summary: Summary }[]) {
  return { checked: prepared.length, generated: prepared.filter(p => p.summary.orderCount > 0).length,
    ready: prepared.filter(p => draftStatus(p.summary) === "READY").length,
    review: prepared.filter(p => draftStatus(p.summary) === "NEEDS_REVIEW").length,
    checkFailed: prepared.filter(p => accountCheckFailed(p.summary)).length,
    noPurchases: prepared.filter(p => draftStatus(p.summary) === "NO_PURCHASES").length };
}
