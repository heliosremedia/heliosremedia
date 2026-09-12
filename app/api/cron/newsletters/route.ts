import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site";
import { deliverApprovedNewsletter } from "@/lib/newsletters/delivery";
import { generateNewsletterEdition } from "@/lib/newsletters/generation";
import { sendNewsletterAdminNotification } from "@/lib/newsletters/notifications";
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
          id: true, subject: true, cycleKey: true, status: true, intendedSendAt: true,
          series: { select: { name: true, status: true } },
        },
      });
      if (!edition) throw new Error("Newsletter edition no longer exists.");
      if (!shouldExecuteNewsletterJob(edition.series.status)) {
        await completeNewsletterJob(job);
        results.push({ id: job.id, type: job.type, success: true });
        continue;
      }
      const label = edition.subject || `${edition.series.name} · ${edition.cycleKey}`;
      const reviewUrl = `${getSiteUrl()}/admin/newsletter-studio/editions/${edition.id}`;

      if (job.type === "GENERATE") {
        await generateNewsletterEdition(edition.id, { kind: "BACKGROUND", jobId: job.id, claimToken: job.claimToken });
        await sendNewsletterAdminNotification({
          kind: "DRAFT_READY",
          editionLabel: label,
          detail: "The AI-assisted draft is ready. It will not be scheduled or sent until an administrator approves it.",
          reviewUrl,
        });
      } else if (job.type === "SEND") {
        try {
          const delivery = await deliverApprovedNewsletter(edition.id, { kind: "BACKGROUND", jobId: job.id, claimToken: job.claimToken });
          await sendNewsletterAdminNotification({
            kind: delivery.failed ? "SEND_FAILED" : "SEND_COMPLETED",
            editionLabel: label,
            detail: `${delivery.sent} delivered${delivery.failed ? `; ${delivery.failed} failed` : ""}.`,
            reviewUrl,
          });
        } catch (error) {
          await sendNewsletterAdminNotification({
            kind: "SEND_FAILED",
            editionLabel: label,
            detail: "The scheduled send failed safely. No unapproved retry will occur.",
            reviewUrl,
          });
          throw error;
        }
      } else if (job.type === "MISSED_APPROVAL") {
        const missed = await markNewsletterApprovalMissed(job);
        if (missed.changed) {
          await sendNewsletterAdminNotification({
            kind: "MISSED_APPROVAL",
            editionLabel: label,
            detail: "The intended send time passed without approval. The edition was not sent and requires a deliberate new schedule.",
            reviewUrl,
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
