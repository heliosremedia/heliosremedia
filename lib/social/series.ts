import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import type { Prisma, SocialPlatform, SocialRecurrenceFrequency } from "@/app/generated/prisma/client";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { prisma } from "@/lib/prisma";
import { recurrenceDates, SOCIAL_PLATFORMS } from "./core";

const dateKey = (value: Date) => [
  value.getFullYear(),
  String(value.getMonth() + 1).padStart(2, "0"),
  String(value.getDate()).padStart(2, "0"),
].join("-");

export async function generateSeriesOccurrences(input: {
  seriesId: string;
  actor: WorkspaceWriteActor;
  through: Date;
}, transaction?: Prisma.TransactionClient) {
  if (!Number.isFinite(input.through.getTime())) throw new Error("INVALID_SERIES_DATE");
  const perform = async (tx: Prisma.TransactionClient) => {
    await requireLockedWorkspaceEditor(tx, input.actor);
    await tx.$queryRaw`SELECT id FROM "SocialSeries" WHERE id=${input.seriesId} AND "workspaceId"=${input.actor.workspaceId} FOR UPDATE`;
    const series = await tx.socialSeries.findFirst({
      where: { id: input.seriesId, workspaceId: input.actor.workspaceId, status: "ACTIVE" },
    });
    if (!series) throw new Error("SOCIAL_SERIES_NOT_FOUND");
    const [hour, minute] = series.localTime.split(":").map(Number);
    const localDates = recurrenceDates({
      startsAt: series.startsAt,
      through: series.endsAt && series.endsAt < input.through ? series.endsAt : input.through,
      frequency: series.frequency,
      interval: series.interval,
      dayOfWeek: series.dayOfWeek,
      dayOfMonth: series.dayOfMonth,
      hour,
      minute,
    });
    const platforms = Array.isArray(series.defaultPlatforms)
      ? series.defaultPlatforms.filter((value): value is SocialPlatform => typeof value === "string" && SOCIAL_PLATFORMS.includes(value as never))
      : [];
    let created = 0;
    for (const [sequence, localDate] of localDates.entries()) {
      const scheduledAt = zonedLocalToUtc(`${dateKey(localDate)}T${series.localTime}`, series.timeZone);
      for (const platform of platforms) {
        const result = await tx.socialSeriesOccurrence.createMany({
          data: [{ seriesId: series.id, platform, scheduledAt, timeZone: series.timeZone, sequence }],
          skipDuplicates: true,
        });
        created += result.count;
      }
    }
    await tx.socialSeries.update({
      where: { id: series.id, workspaceId: input.actor.workspaceId, status: "ACTIVE" },
      data: { generationThrough: input.through },
    });
    return { created, inspected: localDates.length * platforms.length };
  };
  return transaction ? perform(transaction) : prisma.$transaction(perform);
}

export function normalizeSeriesFrequency(value: unknown): SocialRecurrenceFrequency {
  return value === "MONTHLY" ? "MONTHLY" : "WEEKLY";
}
