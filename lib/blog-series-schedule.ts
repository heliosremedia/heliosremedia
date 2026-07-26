const DAY = 86_400_000;

export function nextBlogSeriesDates(
  cadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  publishAt: Date,
  leadDays: number,
) {
  const nextPublishAt = new Date(publishAt);
  if (cadence === "MONTHLY") {
    const desiredDay = nextPublishAt.getUTCDate();
    nextPublishAt.setUTCDate(1);
    nextPublishAt.setUTCMonth(nextPublishAt.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(nextPublishAt.getUTCFullYear(), nextPublishAt.getUTCMonth() + 1, 0)).getUTCDate();
    nextPublishAt.setUTCDate(Math.min(desiredDay, lastDay));
  }
  else nextPublishAt.setUTCDate(nextPublishAt.getUTCDate() + (cadence === "WEEKLY" ? 7 : 14));
  return {
    nextPublishAt,
    nextGenerationAt: new Date(nextPublishAt.getTime() - Math.max(1, leadDays) * DAY),
  };
}
