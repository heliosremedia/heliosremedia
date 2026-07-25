import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type ClaimedNewsletterJob = {
  id: string;
  editionId: string;
  type: "GENERATE" | "SEND" | "MISSED_APPROVAL" | "NOTIFY";
  claimToken: string;
  attempts: number;
};

export async function enqueueDueNewsletterJobs(now = new Date()) {
  const [generationEditions, sendEditions, missedEditions] = await Promise.all([
    prisma.newsletterEdition.findMany({
      where: {
        status: { in: ["AWAITING_GENERATION", "GENERATION_FAILED"] },
        generationDueAt: { not: null, lte: now },
        series: { status: "ACTIVE" },
      },
      select: { id: true, generationDueAt: true },
      take: 100,
    }),
    prisma.newsletterEdition.findMany({
      where: { status: "SCHEDULED", intendedSendAt: { lte: now }, series: { status: "ACTIVE" } },
      select: { id: true, intendedSendAt: true },
      take: 100,
    }),
    prisma.newsletterEdition.findMany({
      where: {
        status: { in: ["AWAITING_GENERATION", "GENERATING", "DRAFT_GENERATED", "NEEDS_REVIEW", "APPROVED", "GENERATION_FAILED"] },
        intendedSendAt: { lte: now },
        series: { status: "ACTIVE" },
      },
      select: { id: true, intendedSendAt: true },
      take: 100,
    }),
  ]);
  const jobs = [
    ...generationEditions.flatMap((edition) => edition.generationDueAt ? [{
      editionId: edition.id, type: "GENERATE" as const, dueAt: edition.generationDueAt,
      idempotencyKey: `generate:${edition.id}:${edition.generationDueAt.toISOString()}`,
    }] : []),
    ...sendEditions.map((edition) => ({
      editionId: edition.id, type: "SEND" as const, dueAt: edition.intendedSendAt,
      idempotencyKey: `send:${edition.id}:${edition.intendedSendAt.toISOString()}`,
    })),
    ...missedEditions.map((edition) => ({
      editionId: edition.id, type: "MISSED_APPROVAL" as const, dueAt: edition.intendedSendAt,
      idempotencyKey: `missed-approval:${edition.id}:${edition.intendedSendAt.toISOString()}`,
    })),
  ];
  if (jobs.length) await prisma.newsletterJob.createMany({ data: jobs, skipDuplicates: true });
  return { generation: generationEditions.length, send: sendEditions.length, missedApproval: missedEditions.length };
}

export async function claimDueNewsletterJobs(input?: { now?: Date; limit?: number; leaseSeconds?: number }) {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));
  const leaseSeconds = Math.max(30, Math.min(input?.leaseSeconds ?? 300, 1_800));
  const claimToken = randomUUID();
  const rows = await prisma.$queryRaw<ClaimedNewsletterJob[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "NewsletterJob"
      WHERE (
        ("status" = 'PENDING' AND "dueAt" <= ${now})
        OR ("status" = 'CLAIMED' AND "leaseExpiresAt" < ${now})
      )
      ORDER BY "dueAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "NewsletterJob" AS job
    SET
      "status" = 'CLAIMED',
      "claimToken" = ${claimToken} || ':' || job."id",
      "claimedAt" = ${now},
      "leaseExpiresAt" = ${new Date(now.getTime() + leaseSeconds * 1_000)},
      "attempts" = job."attempts" + 1,
      "updatedAt" = ${now}
    FROM candidates
    WHERE job."id" = candidates."id"
    RETURNING job."id", job."editionId", job."type", job."claimToken", job."attempts"
  `;
  return rows;
}

export async function completeNewsletterJob(job: Pick<ClaimedNewsletterJob, "id" | "claimToken">) {
  const result = await prisma.newsletterJob.updateMany({
    where: { id: job.id, claimToken: job.claimToken, status: "CLAIMED" },
    data: { status: "COMPLETED", completedAt: new Date(), leaseExpiresAt: null },
  });
  return result.count === 1;
}

export async function failNewsletterJob(
  job: Pick<ClaimedNewsletterJob, "id" | "claimToken">,
  error: unknown,
) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown newsletter job failure";
  const result = await prisma.newsletterJob.updateMany({
    where: { id: job.id, claimToken: job.claimToken, status: "CLAIMED" },
    data: {
      status: "FAILED", completedAt: new Date(), leaseExpiresAt: null,
      lastErrorCode: error instanceof Error ? error.name.slice(0, 100) : "UNKNOWN",
      lastErrorMessage: message,
    },
  });
  return result.count === 1;
}
