import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generationDateForSend, nextOccurrence } from "./recurrence";
import type { GenerationRule, RecurrenceRule } from "./types";

export type ClaimedNewsletterJob = {
  id: string;
  editionId: string;
  type: "GENERATE" | "SEND" | "MISSED_APPROVAL" | "NOTIFY";
  claimToken: string;
  attempts: number;
};

function sendRuleFromSeries(series: {
  sendRecurrenceKind: string;
  sendDayOfMonth: number | null;
  sendWeekOrdinal: string | null;
  sendWeekday: number | null;
  sendLocalTime: string;
}): RecurrenceRule {
  if (series.sendRecurrenceKind === "DAY_OF_MONTH") {
    return {
      kind: "DAY_OF_MONTH",
      dayOfMonth: series.sendDayOfMonth ?? 1,
      localTime: series.sendLocalTime,
    };
  }
  return {
    kind: "NTH_WEEKDAY",
    ordinal: (series.sendWeekOrdinal ?? "SECOND") as "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST",
    weekday: series.sendWeekday ?? 4,
    localTime: series.sendLocalTime,
  };
}

function generationRuleFromSeries(series: {
  generationMode: string;
  generationRecurrenceKind: string | null;
  generationDayOfMonth: number | null;
  generationWeekOrdinal: string | null;
  generationWeekday: number | null;
  generationLocalTime: string | null;
  generationDaysBeforeSend: number | null;
}): GenerationRule {
  if (series.generationMode === "MANUAL") return { mode: "MANUAL" };
  if (series.generationMode === "DAYS_BEFORE_SEND") {
    return {
      mode: "DAYS_BEFORE_SEND",
      daysBeforeSend: series.generationDaysBeforeSend ?? 7,
      localTime: series.generationLocalTime ?? "08:00",
    };
  }
  const recurrence: RecurrenceRule = series.generationRecurrenceKind === "DAY_OF_MONTH"
    ? {
        kind: "DAY_OF_MONTH",
        dayOfMonth: series.generationDayOfMonth ?? 1,
        localTime: series.generationLocalTime ?? "08:00",
      }
    : {
        kind: "NTH_WEEKDAY",
        ordinal: (series.generationWeekOrdinal ?? "FIRST") as "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST",
        weekday: series.generationWeekday ?? 1,
        localTime: series.generationLocalTime ?? "08:00",
      };
  return { mode: "RECURRENCE", recurrence };
}

function cycleKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export async function ensureUpcomingNewsletterEditions(now = new Date()) {
  const activeSeries = await prisma.newsletterSeries.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      createdById: true,
      timeZone: true,
      nextSendAt: true,
      nextGenerationAt: true,
      sendRecurrenceKind: true,
      sendDayOfMonth: true,
      sendWeekOrdinal: true,
      sendWeekday: true,
      sendLocalTime: true,
      generationMode: true,
      generationRecurrenceKind: true,
      generationDayOfMonth: true,
      generationWeekOrdinal: true,
      generationWeekday: true,
      generationLocalTime: true,
      generationDaysBeforeSend: true,
    },
  });
  let created = 0;

  for (const series of activeSeries) {
    await prisma.$transaction(async (tx) => {
      const persistedSendAt = series.nextSendAt && series.nextSendAt > now
        ? series.nextSendAt
        : null;
      const nextSendAt = persistedSendAt
        ?? nextOccurrence(now, sendRuleFromSeries(series), series.timeZone);
      const nextGenerationAt = persistedSendAt
        ? series.nextGenerationAt
        : generationDateForSend(
            nextSendAt,
            generationRuleFromSeries(series),
            series.timeZone,
          );
      const key = cycleKey(nextSendAt, series.timeZone);
      const existing = await tx.newsletterEdition.findUnique({
        where: { seriesId_cycleKey: { seriesId: series.id, cycleKey: key } },
        select: { id: true },
      });
      const edition = existing ?? await tx.newsletterEdition.create({
        data: {
          seriesId: series.id,
          cycleKey: key,
          status: "AWAITING_GENERATION",
          intendedSendAt: nextSendAt,
          generationDueAt: nextGenerationAt,
          createdById: series.createdById,
        },
        select: { id: true },
      });
      if (!existing) created += 1;

      await tx.newsletterJob.createMany({
        skipDuplicates: true,
        data: [
          ...(nextGenerationAt ? [{
            editionId: edition.id,
            type: "GENERATE" as const,
            dueAt: nextGenerationAt,
            idempotencyKey: `newsletter:generate:${edition.id}`,
          }] : []),
          {
            editionId: edition.id,
            type: "MISSED_APPROVAL" as const,
            dueAt: nextSendAt,
            idempotencyKey: `newsletter:missed-approval:${edition.id}`,
          },
        ],
      });
      await tx.newsletterSeries.update({
        where: { id: series.id },
        data: { nextSendAt, nextGenerationAt },
      });
    });
  }
  return created;
}

export async function enqueueDueNewsletterJobs(now = new Date()) {
  const editionsCreated = await ensureUpcomingNewsletterEditions(now);
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
  return { editionsCreated, generation: generationEditions.length, send: sendEditions.length, missedApproval: missedEditions.length };
}

export async function claimDueNewsletterJobs(input?: { now?: Date; limit?: number; leaseSeconds?: number }) {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));
  const leaseSeconds = Math.max(30, Math.min(input?.leaseSeconds ?? 300, 1_800));
  const claimToken = randomUUID();
  const rows = await prisma.$queryRaw<ClaimedNewsletterJob[]>`
    WITH candidates AS (
      SELECT job."id"
      FROM "NewsletterJob" AS job
      INNER JOIN "NewsletterEdition" AS edition ON edition."id" = job."editionId"
      INNER JOIN "NewsletterSeries" AS series ON series."id" = edition."seriesId"
      WHERE (
        (job."status" = 'PENDING' AND job."dueAt" <= ${now})
        OR (job."status" = 'CLAIMED' AND job."leaseExpiresAt" < ${now})
      )
      AND series."status" = 'ACTIVE'
      ORDER BY job."dueAt" ASC
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
