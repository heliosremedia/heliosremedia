import { publicHealthResponse } from "@/lib/health";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [configuredWorkspaces, latestStoredEvent] = await Promise.all([
      prisma.siteSettings.count({ where: { workspaceId: { not: null } } }),
      prisma.portfolioAnalyticsEvent.findFirst({
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      }),
    ]);
    const body = {
      ...publicHealthResponse({ publicSite: true, bookingRoute: true, bookingDestination: null }),
      analytics: {
        configuration: configuredWorkspaces > 0 ? "ready" : "attention",
        ingestion: "available",
        storage: latestStoredEvent ? "verified" : "awaiting_first_event",
        reporting: "available",
      },
    };
    return Response.json(body, {
      status: configuredWorkspaces > 0 ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      analytics: {
        configuration: "unknown",
        ingestion: "unavailable",
        storage: "unavailable",
        reporting: "unavailable",
      },
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
