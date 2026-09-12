import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliverApprovedNewsletter } from "@/lib/newsletters/delivery";
import { generateNewsletterEdition } from "@/lib/newsletters/generation";
import { notifyNewsletterEdition } from "@/lib/newsletters/notification-context";
import {
  claimDueNewsletterJobs,
  enqueueDueNewsletterJobs,
} from "@/lib/newsletters/scheduler";
import { settleNewsletterJob, type NewsletterJobExecution, type NewsletterJobResult } from "@/lib/newsletters/job-settlement";
import { markNewsletterApprovalMissed } from "@/lib/newsletters/missed-approval";
import { shouldExecuteNewsletterJob } from "@/lib/newsletters/presentation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
// Reserve most of the invocation for executing an admitted job, not claiming a backlog.
const claimWindowMs = 30_000;
const maxJobsPerInvocation = 10;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const claimDeadline = performance.now() + claimWindowMs;
  const enqueued = await enqueueDueNewsletterJobs();
  let claimed = 0;
  const results: NewsletterJobResult[] = [];
  while (claimed < maxJobsPerInvocation && performance.now() < claimDeadline) {
    const [job] = await claimDueNewsletterJobs({ limit: 1, leaseSeconds: 300 });
    if (!job) break;
    claimed++;
    if (performance.now() >= claimDeadline) {
      // A slow claim query can consume admission time. Return only this unstarted
      // claim to the queue; never enter domain execution with a depleted budget.
      results.push(await settleNewsletterJob(job, "DEFERRED"));
      break;
    }
    let execution: NewsletterJobExecution = "SUCCEEDED";
    let executionError: unknown;
    try {
      if (!["GENERATE", "SEND", "MISSED_APPROVAL"].includes(job.type)) throw new Error("Unsupported newsletter job type requires review.");
      const edition = await prisma.newsletterEdition.findUnique({
        where: { id: job.editionId },
        select: {
          id: true, status: true,
          series: { select: { status: true } },
        },
      });
      if (!edition) throw new Error("Newsletter edition no longer exists.");
      if (!shouldExecuteNewsletterJob(edition.series.status)) {
        execution = "SKIPPED";
      } else if (job.type === "GENERATE") {
        await generateNewsletterEdition(edition.id, { kind: "BACKGROUND", jobId: job.id, claimToken: job.claimToken });
        await notifyNewsletterEdition({
          kind: "DRAFT_READY",
          editionId: edition.id,
          detail: "The AI-assisted draft is ready. It will not be scheduled or sent until an administrator approves it.",
        });
      } else if (job.type === "SEND") {
        try {
          const delivery = await deliverApprovedNewsletter(edition.id, { kind: "BACKGROUND", jobId: job.id, claimToken: job.claimToken });
          await notifyNewsletterEdition({
            kind: delivery.failed ? "SEND_FAILED" : "SEND_COMPLETED",
            editionId: edition.id,
            detail: `${delivery.sent} delivered${delivery.failed ? `; ${delivery.failed} failed` : ""}.`,
          });
        } catch (error) {
          await notifyNewsletterEdition({
            kind: "SEND_FAILED",
            editionId: edition.id,
            detail: "The scheduled send failed safely. No unapproved retry will occur.",
          });
          throw error;
        }
      } else if (job.type === "MISSED_APPROVAL") {
        const missed = await markNewsletterApprovalMissed(job);
        if (missed.changed) {
          await notifyNewsletterEdition({
            kind: "MISSED_APPROVAL",
            editionId: edition.id,
            detail: "The intended send time passed without approval. The edition was not sent and requires a deliberate new schedule.",
          });
        }
      }
    } catch (error) {
      execution = "FAILED";
      executionError = error;
    }
    const result = await settleNewsletterJob(job, execution, executionError);
    results.push(result);
    // Ownership loss or unavailable persistence requires reconciliation. Avoid
    // increasing uncertain work by claiming more jobs in this invocation.
    if (result.settlement === "CLAIM_CHANGED" || result.settlement === "UNAVAILABLE") break;
  }
  return NextResponse.json({ success: true, enqueued, claimed, results });
}
