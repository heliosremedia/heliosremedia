import "server-only";
import { prisma } from "@/lib/prisma";

export type AnalyticsRange = "7d" | "30d" | "90d";

export function analyticsRangeStart(range: AnalyticsRange) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 86_400_000);
}

export async function getPortfolioAnalytics(workspaceId: string, range: AnalyticsRange, projectId?: string) {
  const since = analyticsRangeStart(range);
  const duration = Date.now() - since.getTime();
  const previousSince = new Date(since.getTime() - duration);
  const where = { workspaceId, occurredAt: { gte: since }, ...(projectId ? { projectId } : {}) };
  const [events, uniqueGroups, previousEventCount] = await Promise.all([
    prisma.portfolioAnalyticsEvent.groupBy({
      by: ["eventName"],
      where,
      _count: { _all: true },
    }),
    prisma.portfolioAnalyticsEvent.groupBy({ by: ["sessionId"], where }),
    prisma.portfolioAnalyticsEvent.count({ where: {
      workspaceId, occurredAt: { gte: previousSince, lt: since }, ...(projectId ? { projectId } : {}),
    } }),
  ]);
  const counts = Object.fromEntries(events.map(item => [item.eventName, item._count._all])) as Record<string, number>;
  const sourceRows = await prisma.portfolioAnalyticsEvent.groupBy({
    by: ["trafficSource"], where, _count: { _all: true }, orderBy: { _count: { trafficSource: "desc" } },
  });
  const deviceRows = await prisma.portfolioAnalyticsEvent.groupBy({
    by: ["deviceCategory"], where, _count: { _all: true }, orderBy: { _count: { deviceCategory: "desc" } },
  });
  const recent = await prisma.portfolioAnalyticsEvent.findMany({
    where, orderBy: { occurredAt: "asc" }, select: { occurredAt: true, eventName: true },
  });
  const trend = new Map<string, number>();
  for (const event of recent) {
    const day = event.occurredAt.toISOString().slice(0, 10);
    trend.set(day, (trend.get(day) ?? 0) + 1);
  }
  return {
    since: since.toISOString(),
    counts,
    estimatedUniqueVisitors: uniqueGroups.length,
    previousEventCount,
    periodChangePercent: previousEventCount > 0
      ? Math.round(((events.reduce((sum,item)=>sum+item._count._all,0)-previousEventCount)/previousEventCount)*1000)/10
      : null,
    sources: sourceRows.map(row => ({ label: row.trafficSource, value: row._count._all })),
    devices: deviceRows.map(row => ({ label: row.deviceCategory, value: row._count._all })),
    trend: [...trend].map(([date, value]) => ({ date, value })),
  };
}
