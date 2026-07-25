import "server-only";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { estimateSeriesRecipients, recipientSelectionFromSeries } from "./studio";
import { resolveEligibleNewsletterRecipients } from "./recipients";

export async function requireNewsletterAdministrator() {
  const session = await getAdminSession();
  if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) return null;
  return session;
}

export function forbiddenNewsletterResponse() {
  return NextResponse.json(
    { success: false, error: "Owner or administrator access is required." },
    { status: 403 },
  );
}

function jsonString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "label" in value) {
    const label = (value as { label?: unknown }).label;
    return typeof label === "string" ? label : fallback;
  }
  return fallback;
}

export function seriesRuleNames(series: {
  sendRecurrenceKind: string;
  sendWeekOrdinal: string | null;
  sendWeekday: number | null;
  sendLocalTime: string;
  generationMode: string;
  generationRecurrenceKind: string | null;
  generationWeekOrdinal: string | null;
  generationWeekday: number | null;
  generationDayOfMonth: number | null;
  generationDaysBeforeSend: number | null;
}) {
  const sendRule = series.sendRecurrenceKind === "NTH_WEEKDAY" &&
    series.sendWeekOrdinal === "SECOND" && series.sendWeekday === 4 && series.sendLocalTime === "09:00"
    ? "SECOND_THURSDAY_09:00"
    : series.sendWeekOrdinal === "FIRST" && series.sendWeekday === 2
      ? "FIRST_TUESDAY_09:00" : "LAST_THURSDAY_09:00";
  const generationRule = series.generationMode === "MANUAL" ? "MANUAL"
    : series.generationMode === "DAYS_BEFORE_SEND" && series.generationDaysBeforeSend === 7
      ? "SEVEN_DAYS_BEFORE_SEND"
      : series.generationRecurrenceKind === "DAY_OF_MONTH" && series.generationDayOfMonth === 1
        ? "FIRST_DAY" : "FIRST_MONDAY";
  return { sendRule, generationRule };
}

export function serializeSeries(series: {
  id: string; name: string; description: string | null; status: string;
  senderName: string | null; replyTo: string | null; brandInstructions: string | null;
  goals: string | null; defaultCallToAction: unknown; timeZone: string;
  nextGenerationAt: Date | null; nextSendAt: Date | null;
  groups: Array<{ groupId: string }>; recipients: Array<{ clientId: string }>;
  sendRecurrenceKind: string; sendWeekOrdinal: string | null; sendWeekday: number | null;
  sendLocalTime: string; generationMode: string; generationRecurrenceKind: string | null;
  generationWeekOrdinal: string | null; generationWeekday: number | null;
  generationDayOfMonth: number | null; generationDaysBeforeSend: number | null;
}) {
  return {
    id: series.id,
    name: series.name,
    description: series.description ?? "",
    active: series.status === "ACTIVE",
    groupIds: series.groups.map((item) => item.groupId),
    individualRecipientIds: series.recipients.map((item) => item.clientId),
    senderName: series.senderName ?? "",
    replyTo: series.replyTo ?? "",
    brandInstructions: series.brandInstructions ?? "",
    goals: series.goals ?? "",
    defaultCta: jsonString(series.defaultCallToAction),
    timezone: series.timeZone,
    ...seriesRuleNames(series),
    nextGenerationAt: series.nextGenerationAt?.toISOString() ?? null,
    nextSendAt: series.nextSendAt?.toISOString() ?? null,
  };
}

export async function serializeEdition(edition: {
  id: string; seriesId: string; status: string; subject: string | null;
  previewText: string | null; intendedSendAt: Date; generationDueAt: Date | null;
  contentNotes: unknown; internalNotes: string | null; warnings: unknown;
  series: { name: string; groups: Array<{ groupId: string; group: { name: string } }>;
    recipients: Array<{ clientId: string }> };
  blocks: Array<{ id: string; type: string; internalLabel: string | null; content: unknown;
    aiGenerated: boolean; manuallyEdited: boolean;
    sources: Array<{ sourceTitle: string }> }>;
}) {
  const selection = recipientSelectionFromSeries(edition.series);
  const audience = await resolveEligibleNewsletterRecipients(selection);
  const notes = edition.contentNotes && typeof edition.contentNotes === "object"
    ? edition.contentNotes as Record<string, unknown> : {};
  return {
    id: edition.id,
    seriesId: edition.seriesId,
    seriesName: edition.series.name,
    subject: edition.subject ?? "",
    previewText: edition.previewText ?? "",
    status: edition.status,
    generationAt: edition.generationDueAt?.toISOString() ?? null,
    intendedSendAt: edition.intendedSendAt.toISOString(),
    groupNames: edition.series.groups.map((item) => item.group.name),
    eligibleCount: audience.eligible.length,
    excludedCount: audience.excludedCount,
    warnings: Array.isArray(edition.warnings)
      ? edition.warnings.filter((item): item is string => typeof item === "string") : [],
    publishableNotes: typeof notes.publishable === "string" ? notes.publishable : "",
    internalNotes: edition.internalNotes ?? "",
    blocks: edition.blocks.map((block) => {
      const content = block.content && typeof block.content === "object"
        ? block.content as Record<string, unknown> : {};
      return {
        id: block.id,
        type: block.type,
        label: block.internalLabel ?? "",
        eyebrow: typeof content.eyebrow === "string" ? content.eyebrow : "",
        heading: typeof content.heading === "string" ? content.heading : "",
        body: typeof content.body === "string" ? content.body : "",
        imageUrl: typeof content.imageUrl === "string" ? content.imageUrl : "",
        altText: typeof content.altText === "string" ? content.altText : "",
        link: typeof content.link === "string" ? content.link : "",
        buttonLabel: typeof content.buttonLabel === "string" ? content.buttonLabel : "",
        alignment: content.alignment === "center" ? "center" : "left",
        provenance: block.sources.map((source) => source.sourceTitle),
        aiGenerated: block.aiGenerated,
        manuallyEdited: block.manuallyEdited,
      };
    }),
  };
}

export const editionInclude = {
  series: {
    include: {
      groups: { include: { group: { select: { name: true } } } },
      recipients: { select: { clientId: true } },
    },
  },
  blocks: { orderBy: { position: "asc" as const }, include: { sources: true } },
};

export async function getEditionForStudio(id: string) {
  return prisma.newsletterEdition.findUnique({ where: { id }, include: editionInclude });
}

export async function getSeriesAudienceEstimate(seriesId: string) {
  return estimateSeriesRecipients(seriesId);
}
