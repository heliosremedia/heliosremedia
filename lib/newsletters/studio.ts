import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generationDateForSend, nextOccurrence } from "./recurrence";
import { resolveEligibleNewsletterRecipients } from "./recipients";
import type { GenerationRule, RecipientSelection, RecurrenceRule } from "./types";

const TIME_ZONE = "America/Denver";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function ids(value: unknown, max: number) {
  return [...new Set(Array.isArray(value) ? value.filter((item): item is string =>
    typeof item === "string" && item.length > 0 && item.length <= 100) : [])].slice(0, max);
}

export type SeriesInput = ReturnType<typeof parseSeriesInput>;

export function parseSeriesInput(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const name = clean(input.name, 160);
  if (!name) throw new Error("Series name is required.");
  const timeZone = clean(input.timezone, 80) || TIME_ZONE;
  if (timeZone !== TIME_ZONE) throw new Error("V1.5 supports America/Denver scheduling.");

  const sendRules: Record<string, RecurrenceRule> = {
    "SECOND_THURSDAY_09:00": { kind: "NTH_WEEKDAY", ordinal: "SECOND", weekday: 4, localTime: "09:00" },
    "FIRST_TUESDAY_09:00": { kind: "NTH_WEEKDAY", ordinal: "FIRST", weekday: 2, localTime: "09:00" },
    "LAST_THURSDAY_09:00": { kind: "NTH_WEEKDAY", ordinal: "LAST", weekday: 4, localTime: "09:00" },
  };
  const generationRules: Record<string, GenerationRule> = {
    FIRST_MONDAY: { mode: "RECURRENCE", recurrence: { kind: "NTH_WEEKDAY", ordinal: "FIRST", weekday: 1, localTime: "08:00" } },
    FIRST_DAY: { mode: "RECURRENCE", recurrence: { kind: "DAY_OF_MONTH", dayOfMonth: 1, localTime: "08:00" } },
    SEVEN_DAYS_BEFORE_SEND: { mode: "DAYS_BEFORE_SEND", daysBeforeSend: 7, localTime: "08:00" },
    MANUAL: { mode: "MANUAL" },
  };
  const sendRuleName = clean(input.sendRule, 80);
  const generationRuleName = clean(input.generationRule, 80);
  const sendRule = sendRules[sendRuleName];
  const generationRule = generationRules[generationRuleName];
  if (!sendRule || !generationRule) throw new Error("Choose a valid monthly schedule.");

  return {
    name,
    description: clean(input.description, 2_000) || null,
    active: input.active !== false,
    groupIds: ids(input.groupIds, 100),
    clientIds: ids(input.individualRecipientIds, 1_000),
    senderName: clean(input.senderName, 160) || null,
    replyTo: clean(input.replyTo, 320) || null,
    brandInstructions: clean(input.brandInstructions, 5_000) || null,
    goals: clean(input.goals, 5_000) || null,
    defaultCta: clean(input.defaultCta, 1_000) || null,
    timeZone,
    sendRuleName,
    generationRuleName,
    sendRule,
    generationRule,
  };
}

function sendRecurrenceData(rule: RecurrenceRule) {
  return {
    sendRecurrenceKind: rule.kind,
    sendDayOfMonth: rule.kind === "DAY_OF_MONTH" ? rule.dayOfMonth : null,
    sendWeekOrdinal: rule.kind === "NTH_WEEKDAY" ? rule.ordinal : null,
    sendWeekday: rule.kind === "NTH_WEEKDAY" ? rule.weekday : null,
    sendLocalTime: rule.localTime,
  };
}

function generationRecurrenceData(rule: RecurrenceRule) {
  return {
    generationRecurrenceKind: rule.kind,
    generationDayOfMonth: rule.kind === "DAY_OF_MONTH" ? rule.dayOfMonth : null,
    generationWeekOrdinal: rule.kind === "NTH_WEEKDAY" ? rule.ordinal : null,
    generationWeekday: rule.kind === "NTH_WEEKDAY" ? rule.weekday : null,
    generationLocalTime: rule.localTime,
  };
}

function scheduleFor(input: SeriesInput, after = new Date()) {
  const nextSendAt = nextOccurrence(after, input.sendRule, input.timeZone);
  const nextGenerationAt = generationDateForSend(nextSendAt, input.generationRule, input.timeZone);
  return { nextSendAt, nextGenerationAt };
}

function cycleKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export async function createSeries(inputValue: unknown, createdById: string) {
  const input = parseSeriesInput(inputValue);
  const schedule = scheduleFor(input);
  return prisma.$transaction(async (tx) => {
    const series = await tx.newsletterSeries.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.active ? "ACTIVE" : "PAUSED",
        timeZone: input.timeZone,
        senderName: input.senderName,
        replyTo: input.replyTo,
        brandInstructions: input.brandInstructions,
        goals: input.goals,
        defaultCallToAction: input.defaultCta ? { label: input.defaultCta } : undefined,
        ...sendRecurrenceData(input.sendRule),
        generationMode: input.generationRule.mode,
        ...(input.generationRule.mode === "RECURRENCE"
          ? generationRecurrenceData(input.generationRule.recurrence)
          : {
              generationRecurrenceKind: null,
              generationDayOfMonth: null,
              generationWeekOrdinal: null,
              generationWeekday: null,
              generationLocalTime: input.generationRule.mode === "DAYS_BEFORE_SEND"
                ? input.generationRule.localTime ?? "08:00" : null,
            }),
        generationDaysBeforeSend: input.generationRule.mode === "DAYS_BEFORE_SEND"
          ? input.generationRule.daysBeforeSend : null,
        nextSendAt: schedule.nextSendAt,
        nextGenerationAt: schedule.nextGenerationAt,
        createdById,
        groups: { create: input.groupIds.map((groupId) => ({ groupId })) },
        recipients: { create: input.clientIds.map((clientId) => ({ clientId })) },
      },
    });
    const edition = await tx.newsletterEdition.create({
      data: {
        seriesId: series.id,
        cycleKey: cycleKey(schedule.nextSendAt, input.timeZone),
        status: input.active ? "AWAITING_GENERATION" : "PAUSED",
        intendedSendAt: schedule.nextSendAt,
        generationDueAt: schedule.nextGenerationAt,
        createdById,
      },
    });
    if (schedule.nextGenerationAt) {
      await tx.newsletterJob.create({
        data: {
          editionId: edition.id,
          type: "GENERATE",
          dueAt: schedule.nextGenerationAt,
          idempotencyKey: `newsletter:generate:${edition.id}`,
        },
      });
    }
    await tx.newsletterJob.create({
      data: {
        editionId: edition.id,
        type: "MISSED_APPROVAL",
        dueAt: schedule.nextSendAt,
        idempotencyKey: `newsletter:missed-approval:${edition.id}`,
      },
    });
    return series;
  });
}

export async function updateSeries(seriesId: string, inputValue: unknown) {
  const input = parseSeriesInput(inputValue);
  const schedule = scheduleFor(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.newsletterSeries.findUnique({ where: { id: seriesId } });
    if (!existing) throw new Error("Newsletter series was not found.");
    const affected = await tx.newsletterEdition.findMany({
      where: { seriesId, status: { in: ["APPROVED", "SCHEDULED"] } },
      select: { id: true },
    });
    const affectedIds = affected.map((edition) => edition.id);
    if (affectedIds.length) {
      await tx.newsletterApproval.updateMany({
        where: { editionId: { in: affectedIds }, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revocationReason: "Series audience or schedule configuration changed after approval.",
        },
      });
      await tx.newsletterEdition.updateMany({
        where: { id: { in: affectedIds } },
        data: { status: "NEEDS_REVIEW", approvedRevisionId: null, rowVersion: { increment: 1 } },
      });
      await tx.newsletterJob.updateMany({
        where: { editionId: { in: affectedIds }, type: "SEND", status: { in: ["PENDING", "CLAIMED"] } },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    }
    await tx.newsletterSeriesGroup.deleteMany({ where: { seriesId } });
    await tx.newsletterSeriesRecipient.deleteMany({ where: { seriesId } });
    return tx.newsletterSeries.update({
      where: { id: seriesId },
      data: {
        name: input.name,
        description: input.description,
        status: input.active ? "ACTIVE" : "PAUSED",
        timeZone: input.timeZone,
        senderName: input.senderName,
        replyTo: input.replyTo,
        brandInstructions: input.brandInstructions,
        goals: input.goals,
        defaultCallToAction: input.defaultCta ? { label: input.defaultCta } : undefined,
        ...sendRecurrenceData(input.sendRule),
        generationMode: input.generationRule.mode,
        ...(input.generationRule.mode === "RECURRENCE"
          ? generationRecurrenceData(input.generationRule.recurrence)
          : {
              generationRecurrenceKind: null,
              generationDayOfMonth: null,
              generationWeekOrdinal: null,
              generationWeekday: null,
              generationLocalTime: input.generationRule.mode === "DAYS_BEFORE_SEND"
                ? input.generationRule.localTime ?? "08:00" : null,
            }),
        generationDaysBeforeSend: input.generationRule.mode === "DAYS_BEFORE_SEND"
          ? input.generationRule.daysBeforeSend : null,
        nextSendAt: schedule.nextSendAt,
        nextGenerationAt: schedule.nextGenerationAt,
        groups: { create: input.groupIds.map((groupId) => ({ groupId })) },
        recipients: { create: input.clientIds.map((clientId) => ({ clientId })) },
      },
    });
  });
}

export function recipientSelectionFromSeries(series: {
  groups: Array<{ groupId: string }>;
  recipients: Array<{ clientId: string }>;
}): RecipientSelection {
  const groupIds = series.groups.map((item) => item.groupId);
  const clientIds = series.recipients.map((item) => item.clientId);
  return {
    mode: groupIds.length && clientIds.length ? "GROUPS_AND_INDIVIDUALS"
      : groupIds.length ? "GROUPS" : clientIds.length ? "INDIVIDUALS" : "ALL",
    groupIds,
    clientIds,
  };
}

export async function estimateSeriesRecipients(seriesId: string) {
  const series = await prisma.newsletterSeries.findUnique({
    where: { id: seriesId },
    select: {
      groups: { select: { groupId: true } },
      recipients: { select: { clientId: true } },
    },
  });
  if (!series) throw new Error("Newsletter series was not found.");
  return resolveEligibleNewsletterRecipients(recipientSelectionFromSeries(series));
}

export function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
