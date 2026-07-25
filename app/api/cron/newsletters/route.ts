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

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const enqueued = await enqueueDueNewsletterJobs();
  const jobs = await claimDueNewsletterJobs({ limit: 10, leaseSeconds: 300 });
  const results: Array<{ id: string; type: string; success: boolean }> = [];
  for (const job of jobs) {
    try {
      const edition = await prisma.newsletterEdition.findUnique({
        where: { id: job.editionId },
        select: {
          id: true, subject: true, cycleKey: true, status: true, intendedSendAt: true,
          series: { select: { name: true } },
        },
      });
      if (!edition) throw new Error("Newsletter edition no longer exists.");
      const label = edition.subject || `${edition.series.name} · ${edition.cycleKey}`;
      const reviewUrl = `${getSiteUrl()}/admin/newsletter-studio/editions/${edition.id}`;

      if (job.type === "GENERATE") {
        await generateNewsletterEdition(edition.id);
        await sendNewsletterAdminNotification({
          kind: "DRAFT_READY",
          editionLabel: label,
          detail: "The AI-assisted draft is ready. It will not be scheduled or sent until an administrator approves it.",
          reviewUrl,
        });
      } else if (job.type === "SEND") {
        try {
          const delivery = await deliverApprovedNewsletter(edition.id);
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
        const missed = await prisma.newsletterEdition.updateMany({
          where: {
            id: edition.id,
            status: {
              in: ["AWAITING_GENERATION", "GENERATING", "DRAFT_GENERATED", "NEEDS_REVIEW", "APPROVED", "GENERATION_FAILED"],
            },
            intendedSendAt: { lte: new Date() },
          },
          data: { status: "MISSED_APPROVAL", approvedRevisionId: null, rowVersion: { increment: 1 } },
        });
        if (missed.count) {
          await prisma.newsletterApproval.updateMany({
            where: { editionId: edition.id, revokedAt: null },
            data: { revokedAt: new Date(), revocationReason: "The intended send time passed without scheduling approval." },
          });
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
  return NextResponse.json({ success: true, enqueued, claimed: jobs.length, results });
}
