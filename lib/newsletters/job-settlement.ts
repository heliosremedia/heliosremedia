import "server-only";
import { completeNewsletterJob, deferUnstartedNewsletterJob, failNewsletterJob, type ClaimedNewsletterJob } from "./scheduler";

export type NewsletterJobExecution = "SUCCEEDED" | "FAILED" | "SKIPPED" | "DEFERRED";
export type NewsletterJobResult = {
  id: string;
  type: ClaimedNewsletterJob["type"];
  success: boolean;
  execution: NewsletterJobExecution;
  settlement: "COMPLETED" | "FAILED" | "DEFERRED" | "CLAIM_CHANGED" | "UNAVAILABLE";
};

/** Record outcome evidence without repeating or reclassifying domain execution. */
export async function settleNewsletterJob(
  job: ClaimedNewsletterJob,
  execution: NewsletterJobExecution,
  error?: unknown,
): Promise<NewsletterJobResult> {
  const result = { id: job.id, type: job.type, execution };
  try {
    const updated = execution === "DEFERRED"
      ? await deferUnstartedNewsletterJob(job)
      : execution === "FAILED" ? await failNewsletterJob(job, error) : await completeNewsletterJob(job);
    if (!updated) return { ...result, success: false, settlement: "CLAIM_CHANGED" };
    return { ...result, success: execution === "SUCCEEDED" || execution === "SKIPPED",
      settlement: execution === "DEFERRED" ? "DEFERRED" : execution === "FAILED" ? "FAILED" : "COMPLETED" };
  } catch {
    // A write may have committed despite a lost response. Never attempt a second
    // terminal write, repeat a provider call, or expose raw database errors here.
    return { ...result, success: false, settlement: "UNAVAILABLE" };
  }
}
