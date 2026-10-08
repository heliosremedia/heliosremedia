import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { lifecycleEnabled, workspaceIsActive } from "@/lib/workspace-lifecycle/state";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { resolveNewsletterWorkspace } from "./ownership";
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
    select: { id: true, workspaceId: true },
  });
  let created = 0;

  for (const candidate of activeSeries) {
    const workspaceId = await resolveNewsletterWorkspace(candidate.workspaceId);
    const added = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
      if (!await workspaceIsActive(tx, workspaceId)) return 0;
      const scope = await getContentOwnershipScope(workspaceId);
      const legacyAllowed = "OR" in scope;
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "NewsletterSeries"
        WHERE id = ${candidate.id} AND ("workspaceId" = ${workspaceId} OR ("workspaceId" IS NULL AND ${legacyAllowed}))
        FOR UPDATE
      `;
      if (!locked.length) return 0;
      // Re-read after the shared workspace/series locks. Discovery is not authority
      // to prepare work using a configuration that was changed or paused meanwhile.
      const series = await tx.newsletterSeries.findFirst({
        where: { id: candidate.id, status: "ACTIVE", AND: [scope] },
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
      if (!series) return 0;
      const persistedSendAt = series.nextSendAt && series.nextSendAt > now
        ? series.nextSendAt
        : null;
      let nextSendAt = persistedSendAt
        ?? nextOccurrence(now, sendRuleFromSeries(series), series.timeZone);
      let nextGenerationAt = persistedSendAt
        ? series.nextGenerationAt
        : generationDateForSend(
            nextSendAt,
            generationRuleFromSeries(series),
            series.timeZone,
          );
      let key = cycleKey(nextSendAt, series.timeZone);
      let existing = await tx.newsletterEdition.findUnique({
        where: { seriesId_cycleKey: { seriesId: series.id, cycleKey: key } },
        select: { id: true, status: true, intendedSendAt: true, generationDueAt: true },
      });
      if (existing && ["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(existing.status)) {
        nextSendAt = nextOccurrence(
          new Date(nextSendAt.getTime() + 1_000),
          sendRuleFromSeries(series),
          series.timeZone,
        );
        nextGenerationAt = generationDateForSend(
          nextSendAt,
          generationRuleFromSeries(series),
          series.timeZone,
        );
        key = cycleKey(nextSendAt, series.timeZone);
        existing = await tx.newsletterEdition.findUnique({
          where: { seriesId_cycleKey: { seriesId: series.id, cycleKey: key } },
          select: { id: true, status: true, intendedSendAt: true, generationDueAt: true },
        });
      }
      if (existing) {
        // A previously prepared or deliberately rescheduled edition keeps its
        // stored schedule. Do not attach jobs using a recomputed series date.
        nextSendAt = existing.intendedSendAt;
        nextGenerationAt = existing.generationDueAt;
      }
      const edition = await tx.newsletterEdition.upsert({
        where: { seriesId_cycleKey: { seriesId: series.id, cycleKey: key } },
        update: {},
        create: {
          seriesId: series.id,
          cycleKey: key,
          status: "AWAITING_GENERATION",
          intendedSendAt: nextSendAt,
          generationDueAt: nextGenerationAt,
          createdById: series.createdById,
        },
        select: { id: true },
      });

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
        where: { id: series.id, AND: [scope] },
        data: { nextSendAt, nextGenerationAt },
      });
      return existing ? 0 : 1;
    });
    created += added;
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
  const enabled = lifecycleEnabled();
  const claim = async (db: Pick<Prisma.TransactionClient, "$queryRaw">, workspaceId: string | null, remaining: number) => {
    if (enabled) {
      // Workspace first, then this family's series/edition/job locks. Never lock
      // unrelated companies together for a worker poll.
      await db.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    }
    return db.$queryRaw<ClaimedNewsletterJob[]>`
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
      AND (NOT ${enabled} OR (series."workspaceId" = ${workspaceId} AND EXISTS (
        SELECT 1 FROM "Workspace" AS workspace
        WHERE workspace.id = series."workspaceId"
          AND workspace."lifecycleState" = 'ACTIVE'
          AND (workspace."lastReactivatedAt" IS NULL OR job."dueAt" > workspace."lastReactivatedAt")
      )))
      AND job."type" IN ('GENERATE', 'SEND', 'MISSED_APPROVAL')
      AND (
        job."type" <> 'SEND'
        OR (
          edition."status" IN ('SCHEDULED', 'SEND_FAILED', 'PARTIALLY_SENT')
          AND edition."approvedRevisionId" IS NOT NULL
          AND job."dueAt" = edition."intendedSendAt"
          AND job."dueAt" <= ${now}
          AND NOT EXISTS (
            SELECT 1 FROM "NewsletterDeliveryAttempt" AS attempt
            WHERE attempt."editionId" = edition."id"
              AND attempt."status" IN ('PREPARED', 'UNCERTAIN')
          )
        )
      )
      AND (
        job."type" <> 'GENERATE'
        OR (
          edition."status" IN ('AWAITING_GENERATION', 'NEEDS_REVIEW', 'GENERATION_FAILED', 'DRAFT_GENERATED')
          AND job."dueAt" = edition."generationDueAt"
          AND job."dueAt" <= ${now}
        )
      )
      AND (
        job."type" <> 'MISSED_APPROVAL'
        OR (
          edition."status" IN ('AWAITING_GENERATION', 'GENERATING', 'DRAFT_GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'GENERATION_FAILED')
          AND job."dueAt" = edition."intendedSendAt"
          AND job."dueAt" <= ${now}
        )
      )
      ORDER BY job."dueAt" ASC
      LIMIT ${remaining}
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
  };
  if (!enabled) return claim(prisma, null, limit);
  // Discovery is only a hint; the transaction rechecks lifecycle, cutoff and all
  // approval/attempt predicates after its workspace lock.
  const candidates = await prisma.$queryRaw<Array<{ workspaceId: string }>>`
    SELECT series."workspaceId" AS "workspaceId"
    FROM "NewsletterJob" job
    JOIN "NewsletterEdition" edition ON edition.id = job."editionId"
    JOIN "NewsletterSeries" series ON series.id = edition."seriesId"
    JOIN "Workspace" workspace ON workspace.id = series."workspaceId"
    WHERE workspace."lifecycleState" = 'ACTIVE' AND series.status = 'ACTIVE'
      AND (workspace."lastReactivatedAt" IS NULL OR job."dueAt" > workspace."lastReactivatedAt")
      AND ((job.status = 'PENDING' AND job."dueAt" <= ${now})
        OR (job.status = 'CLAIMED' AND job."leaseExpiresAt" < ${now}))
    GROUP BY series."workspaceId" ORDER BY MIN(job."dueAt"), series."workspaceId"
  `;
  const rows: ClaimedNewsletterJob[] = [];
  for (const candidate of candidates) {
    rows.push(...await prisma.$transaction(tx => claim(tx, candidate.workspaceId, limit - rows.length)));
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function completeNewsletterJob(job: Pick<ClaimedNewsletterJob, "id" | "claimToken">) {
  const result = await prisma.newsletterJob.updateMany({
    where: { id: job.id, claimToken: job.claimToken, status: "CLAIMED" },
    data: { status: "COMPLETED", completedAt: new Date(), leaseExpiresAt: null },
  });
  return result.count === 1;
}

/** Only for a claim whose executor has not been entered in this invocation. */
export async function deferUnstartedNewsletterJob(job: Pick<ClaimedNewsletterJob, "id" | "claimToken">) {
  const result = await prisma.newsletterJob.updateMany({
    where: { id: job.id, claimToken: job.claimToken, status: "CLAIMED" },
    data: { status: "PENDING", claimToken: null, claimedAt: null, leaseExpiresAt: null },
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
