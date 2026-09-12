import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliverApprovedNewsletter } from "@/lib/newsletters/delivery";
import { generateNewsletterEdition } from "@/lib/newsletters/generation";
import { notifyNewsletterEdition } from "@/lib/newsletters/notification-context";
import {
  claimDueNewsletterJobs,
  completeNewsletterJob,
  enqueueDueNewsletterJobs,
  failNewsletterJob,
} from "@/lib/newsletters/scheduler";
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
  const results: Array<{ id: string; type: string; success: boolean }> = [];
  while (claimed < maxJobsPerInvocation && performance.now() < claimDeadline) {
    const [job] = await claimDueNewsletterJobs({ limit: 1, leaseSeconds: 300 });
    if (!job) break;
    claimed++;
    try {
      const edition = await prisma.newsletterEdition.findUnique({
        where: { id: job.editionId },
        select: {
          id: true, status: true,
          series: { select: { status: true } },
        },
      });
      if (!edition) throw new Error("Newsletter edition no longer exists.");
      if (!shouldExecuteNewsletterJob(edition.series.status)) {
        await completeNewsletterJob(job);
        results.push({ id: job.id, type: job.type, success: true });
        continue;
      }

      if (job.type === "GENERATE") {
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
      await completeNewsletterJob(job);
      results.push({ id: job.id, type: job.type, success: true });
    } catch (error) {
      await failNewsletterJob(job, error);
      results.push({ id: job.id, type: job.type, success: false });
    }
  }
  return NextResponse.json({ success: true, enqueued, claimed, results });
}
