import type { Prisma } from "@/app/generated/prisma/client";
import type { WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { lockNewsletterSeriesIdentity } from "@/lib/newsletters/series-write-lock";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  editionInclude,
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
  serializeEdition,
  serializeSeries,
} from "@/lib/newsletters/api";
import { generateNewsletterEdition } from "@/lib/newsletters/generation";
import { generationDateForSend, nextOccurrence } from "@/lib/newsletters/recurrence";
import type { GenerationRule, RecurrenceRule } from "@/lib/newsletters/types";

const seriesInclude = {
  groups: { select: { groupId: true } },
  recipients: { select: { clientId: true } },
} as const;

function cycleKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}`;
}

function recurrenceFromSeries(series: {
  sendRecurrenceKind: string;
  sendDayOfMonth: number | null;
  sendWeekOrdinal: string | null;
  sendWeekday: number | null;
  sendLocalTime: string;
}) {
  if (series.sendRecurrenceKind === "DAY_OF_MONTH") {
    return {
      kind: "DAY_OF_MONTH",
      dayOfMonth: series.sendDayOfMonth ?? 1,
      localTime: series.sendLocalTime,
    } satisfies RecurrenceRule;
  }
  return {
    kind: "NTH_WEEKDAY",
    ordinal: (series.sendWeekOrdinal ?? "SECOND") as "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST",
    weekday: series.sendWeekday ?? 4,
    localTime: series.sendLocalTime,
  } satisfies RecurrenceRule;
}

function generationFromSeries(series: {
  generationMode: string;
  generationRecurrenceKind: string | null;
  generationDayOfMonth: number | null;
  generationWeekOrdinal: string | null;
  generationWeekday: number | null;
  generationLocalTime: string | null;
  generationDaysBeforeSend: number | null;
}) {
  if (series.generationMode === "MANUAL") return { mode: "MANUAL" } satisfies GenerationRule;
  if (series.generationMode === "DAYS_BEFORE_SEND") {
    return {
      mode: "DAYS_BEFORE_SEND",
      daysBeforeSend: series.generationDaysBeforeSend ?? 7,
      localTime: series.generationLocalTime ?? "08:00",
    } satisfies GenerationRule;
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
  return { mode: "RECURRENCE", recurrence } satisfies GenerationRule;
}

async function pauseSeries(seriesId: string, actor: WorkspaceWriteActor) {
  actor = { ...actor };
  const { workspaceId } = actor;
  return prisma.$transaction(async tx => {
    await lockNewsletterSeriesIdentity(tx, seriesId, actor);
    const series = await tx.newsletterSeries.update({
      where: { id: seriesId, AND: [await getContentOwnershipScope(workspaceId)] },
      data: { status: "PAUSED" },
    });
    await tx.newsletterJob.updateMany({
      where: {
        edition: { seriesId },
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        leaseExpiresAt: null,
        lastErrorCode: "SERIES_PAUSED",
        lastErrorMessage: "Series paused before execution.",
      },
    });
    return series;
  });
}

async function resumeSeries(seriesId: string, actor: WorkspaceWriteActor) {
  actor = { ...actor };
  const { workspaceId } = actor;
  const now = new Date();
  return prisma.$transaction(async tx => {
    await lockNewsletterSeriesIdentity(tx, seriesId, actor);
    const series = await tx.newsletterSeries.findUnique({ where: { id: seriesId, AND: [await getContentOwnershipScope(workspaceId)] } });
    if (!series) throw new Error("Newsletter series was not found.");
    if (series.status === "ACTIVE") return series;
    const upcoming = await tx.newsletterEdition.findFirst({
      where: {
        seriesId,
        intendedSendAt: { gt: now },
        status: { in: ["AWAITING_GENERATION", "DRAFT_GENERATED", "NEEDS_REVIEW", "APPROVED", "SCHEDULED", "PAUSED", "MISSED_APPROVAL", "GENERATION_FAILED"] },
      },
      include: { approvals: { where: { revokedAt: null }, select: { revisionId: true, approvedSendAt: true } } },
      orderBy: { intendedSendAt: "asc" },
    });
    if (upcoming) {
      const resumedStatus = upcoming.status === "PAUSED" ? "AWAITING_GENERATION" : upcoming.status;
      if (upcoming.status === "PAUSED") {
        const changed = await tx.newsletterEdition.updateMany({
          where: { id: upcoming.id, seriesId, status: "PAUSED" },
          data: { status: "AWAITING_GENERATION", rowVersion: { increment: 1 } },
        });
        if (changed.count !== 1) throw new Error("Edition changed while resuming. Reopen and retry.");
      }
      const resumable: Prisma.NewsletterJobWhereInput[] = [];
      if (upcoming.generationDueAt && ["AWAITING_GENERATION", "DRAFT_GENERATED", "NEEDS_REVIEW", "GENERATION_FAILED"].includes(resumedStatus)) {
        resumable.push({ type: "GENERATE", dueAt: upcoming.generationDueAt });
      }
      const approved = resumedStatus === "SCHEDULED" && upcoming.approvedRevisionId
        && upcoming.approvals.some(approval => approval.revisionId === upcoming.approvedRevisionId
          && approval.approvedSendAt.getTime() === upcoming.intendedSendAt.getTime());
      if (approved) resumable.push({ type: "SEND", dueAt: upcoming.intendedSendAt });
      if (resumedStatus !== "SCHEDULED") resumable.push({ type: "MISSED_APPROVAL", dueAt: upcoming.intendedSendAt });
      if (resumable.length) await tx.newsletterJob.updateMany({
        where: {
          editionId: upcoming.id, status: "CANCELLED", lastErrorCode: "SERIES_PAUSED", OR: resumable,
        },
        data: {
          status: "PENDING", completedAt: null, claimToken: null, claimedAt: null, leaseExpiresAt: null,
          lastErrorCode: null, lastErrorMessage: null,
        },
      });
      return tx.newsletterSeries.update({
        where: { id: seriesId, AND: [await getContentOwnershipScope(workspaceId)] },
        data: {
          status: "ACTIVE",
          nextSendAt: upcoming.intendedSendAt,
          nextGenerationAt: upcoming.generationDueAt,
        },
      });
    }

    let nextSendAt = nextOccurrence(now, recurrenceFromSeries(series), series.timeZone);
    let key = cycleKey(nextSendAt, series.timeZone);
    const collision = await tx.newsletterEdition.findUnique({
      where: { seriesId_cycleKey: { seriesId, cycleKey: key } },
      select: { status: true },
    });
    if (collision && ["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(collision.status)) {
      nextSendAt = nextOccurrence(
        new Date(nextSendAt.getTime() + 1_000),
        recurrenceFromSeries(series),
        series.timeZone,
      );
      key = cycleKey(nextSendAt, series.timeZone);
    }
    const nextGenerationAt = generationDateForSend(
      nextSendAt,
      generationFromSeries(series),
      series.timeZone,
    );
    const edition = await tx.newsletterEdition.upsert({
      where: { seriesId_cycleKey: { seriesId, cycleKey: key } },
      update: {},
      create: {
        seriesId,
        cycleKey: key,
        status: "AWAITING_GENERATION",
        intendedSendAt: nextSendAt,
        generationDueAt: nextGenerationAt,
        createdById: series.createdById,
      },
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
    return tx.newsletterSeries.update({
      where: { id: seriesId, AND: [await getContentOwnershipScope(workspaceId)] },
      data: { status: "ACTIVE", nextSendAt, nextGenerationAt },
    });
  });
}

export async function GET() {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const [series, editions, groups] = await Promise.all([
    prisma.newsletterSeries.findMany({ where: await getContentOwnershipScope(session.workspaceId), orderBy: { updatedAt: "desc" }, include: seriesInclude }),
    prisma.newsletterEdition.findMany({
      where: { series: await getContentOwnershipScope(session.workspaceId) },
      take: 50,
      orderBy: [{ intendedSendAt: "asc" }, { createdAt: "desc" }],
      include: editionInclude,
    }),
    prisma.communicationGroup.findMany({
      where: await getContentOwnershipScope(session.workspaceId),
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: { where: { client: { workspaceMemberships: { some: { workspaceId: session.workspaceId } } } } } } } },
    }),
  ]);
  const serializedEditions = await Promise.all(editions.map(serializeEdition));
  const nextEdition = serializedEditions.find((edition) =>
    !["SENT", "PARTIALLY_SENT", "CANCELLED"].includes(edition.status)) ?? null;
  return NextResponse.json({
    success: true,
    data: {
      nextEdition,
      editions: serializedEditions,
      series: series.map(serializeSeries),
      groups: groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships })),
    },
  });
}

export async function POST(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "generate") {
      const editionId = typeof body.editionId === "string" ? body.editionId : "";
      if (!editionId) throw new Error("Edition is required.");
      const result = await generateNewsletterEdition(editionId, { kind: "ADMIN", actor: session });
      await recordAuditEvent({
        workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email,
        action: "NEWSLETTER_GENERATED", entityType: "NewsletterEdition", entityId: editionId,
        summary: "Generated a newsletter draft for administrator review.",
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === "pause-series" || action === "resume-series") {
      const seriesId = typeof body.seriesId === "string" ? body.seriesId : "";
      if (!seriesId) throw new Error("Newsletter series is required.");
      const series = action === "pause-series"
        ? await pauseSeries(seriesId, session)
        : await resumeSeries(seriesId, session);
      await recordAuditEvent({
        workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email,
        action: action === "pause-series" ? "NEWSLETTER_SERIES_PAUSED" : "NEWSLETTER_SERIES_RESUMED",
        entityType: "NewsletterSeries", entityId: series.id,
        summary: `${action === "pause-series" ? "Paused" : "Resumed"} newsletter series "${series.name}".`,
      });
      return NextResponse.json({ success: true, message: `Series ${action === "pause-series" ? "paused" : "resumed"}.` });
    }
    throw new Error("Unsupported newsletter action.");
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "The request could not be completed.",
    }, { status: error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN" ? 403 : 400 });
  }
}
