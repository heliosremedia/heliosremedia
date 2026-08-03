import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizedOutboundKey, outboundDestinationLabel, parseReportableOutboundUrl } from "@/lib/portfolio-outbound";

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
  const [sourceRows, deviceRows, channelRows, targetRows, settings] = await Promise.all([
    prisma.portfolioAnalyticsEvent.groupBy({
      by: ["trafficSource"], where, _count: { _all: true }, orderBy: { _count: { trafficSource: "desc" } },
    }),
    prisma.portfolioAnalyticsEvent.groupBy({
      by: ["deviceCategory"], where, _count: { _all: true }, orderBy: { _count: { deviceCategory: "desc" } },
    }),
    prisma.portfolioAnalyticsEvent.groupBy({
      by: ["eventName", "channel"], where: { ...where, channel: { not: null } }, _count: { _all: true },
    }),
    prisma.portfolioAnalyticsEvent.groupBy({
      by: ["eventName", "target"], where: { ...where, target: { not: null } }, _count: { _all: true },
    }),
    prisma.siteSettings.findFirst({ where: { workspaceId }, select: { websiteUrl: true } }),
  ]);
  const validOutboundCounts = new Map<string, { eventName: string; label: string; url: string; value: number }>();
  const targets: Array<{ eventName: string; label: string; url: string | null; value: number }> = targetRows.flatMap(row => {
    const target = row.target || "unknown";
    if (row.eventName !== "OUTBOUND_LINK_CLICK") return [{ eventName: row.eventName, label: target, url: null, value: row._count._all }];
    if (!parseReportableOutboundUrl(target, settings?.websiteUrl)) return [];
    const key = normalizedOutboundKey(target);
    if (!key) return [];
    const current = validOutboundCounts.get(key);
    if (current) current.value += row._count._all;
    else validOutboundCounts.set(key, { eventName: row.eventName, label: outboundDestinationLabel(target), url: target, value: row._count._all });
    return [];
  });
  targets.push(...validOutboundCounts.values());
  counts.OUTBOUND_LINK_CLICK = [...validOutboundCounts.values()].reduce((sum, row) => sum + row.value, 0);
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
    channels: channelRows.map(row => ({ eventName: row.eventName, label: row.channel || "unknown", value: row._count._all })),
    targets,
    trend: [...trend].map(([date, value]) => ({ date, value })),
  };
}

export async function getPortfolioAnalyticsHealth(workspaceId: string) {
  try {
    const [settings, latestEvent] = await Promise.all([
      prisma.siteSettings.findFirst({
        where: { workspaceId },
        select: { websiteUrl: true },
      }),
      prisma.portfolioAnalyticsEvent.findFirst({
        where: { workspaceId },
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);
    if (!settings) return { state: "workspace" as const, label: "Workspace configuration needed", detail: "Managed Site Settings are not connected to this workspace." };
    if (latestEvent) return {
      state: "recent" as const,
      label: "Verified ingestion",
      detail: `Most recent database-confirmed event: ${latestEvent.occurredAt.toLocaleString("en-US")}. Reporting query is healthy.`,
    };
    return {
      state: "awaiting" as const,
      label: "No verified ingestion yet",
      detail: settings.websiteUrl
        ? "Workspace configuration and reporting query are healthy, but no database-confirmed public event exists."
        : "Reporting is healthy. Add the public website address before enabling multiple companies.",
    };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2021" || code === "P2022") return { state: "schema" as const, label: "Analytics schema unavailable", detail: "The analytics database migration requires administrator attention." };
    return { state: "configuration" as const, label: "Analytics health unavailable", detail: "Studio could not verify ingestion readiness. Review server operational logs." };
  }
}
