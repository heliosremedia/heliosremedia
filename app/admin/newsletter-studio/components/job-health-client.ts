import type { getNewsletterJobHealth } from "@/lib/newsletters/job-health";

export type NewsletterJobHealth = Awaited<ReturnType<typeof getNewsletterJobHealth>>;
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
export async function requestNewsletterJobHealth(signal?: AbortSignal, transport: typeof fetch = fetch): Promise<NewsletterJobHealth> {
  const response = await transport("/api/admin/newsletters/jobs/health", { method: "GET", cache: "no-store", signal });
  const result = await response.json().catch(() => null);
  const failure = response.status === 403 ? "Administrator access is required. Refresh your session." : "Job status is unavailable. Refresh to try again.";
  if (!response.ok || result?.success !== true) throw new Error(failure);
  const health = result.health as NewsletterJobHealth | undefined;
  if (!health || !date(health.observedAt) || health.automaticRetryAllowed !== false || typeof health.truncated !== "boolean"
    || !health.counts || !Object.values(health.counts).every(integer) || !['pending', 'active', 'review', 'failed'].every(key => key in health.counts)
    || !Array.isArray(health.jobs) || health.jobs.length > 50 || health.jobs.some(job => !job || typeof job.id !== "string" || !job.id
      || typeof job.editionId !== "string" || !job.editionId || typeof job.editionLabel !== "string"
      || !["GENERATE", "SEND", "MISSED_APPROVAL", "NOTIFY"].includes(job.type) || !["PENDING", "ACTIVE", "REVIEW", "FAILED"].includes(job.state)
      || !date(job.dueAt) || !integer(job.attempts) || typeof job.editionStatus !== "string" || typeof job.seriesStatus !== "string")) throw new Error(failure);
  return health;
}
