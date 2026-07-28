import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyticsEventKey, classifyDevice, normalizeReferrer, parsePortfolioEvent,
  selectWorkspaceForHost,
} from "@/lib/portfolio-analytics-core";

const requests = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous").trim().slice(0, 80);
}

function rateLimited(key: string) {
  const now = Date.now();
  if (requests.size > 5_000) {
    for (const [entryKey, entry] of requests) if (entry.resetAt <= now) requests.delete(entryKey);
  }
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 60;
}

export async function POST(request: Request) {
  try {
    const key = clientKey(request);
    if (rateLimited(key)) {
      console.info("[portfolio-analytics] rate_limited");
      return new NextResponse(null, { status: 429 });
    }
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      console.info("[portfolio-analytics] invalid_payload");
      return new NextResponse(null, { status: 400 });
    }
    const event = parsePortfolioEvent(body);
    const sessionId = typeof body.sessionId === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(body.sessionId)
      ? body.sessionId : null;
    if (!event || !sessionId) {
      console.info("[portfolio-analytics] invalid_payload");
      return new NextResponse(null, { status: 400 });
    }

    let projectId: string | null = null;
    let workspaceId: string | null = null;
    if (event.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: event.projectId, status: "PUBLISHED" },
        select: { id: true, workspaceId: true },
      });
      if (!project) {
        console.info("[portfolio-analytics] unknown_project");
        return new NextResponse(null, { status: 404 });
      }
      projectId = project.id;
      workspaceId = project.workspaceId;
    } else {
      const settings = await prisma.siteSettings.findMany({
        where: { workspaceId: { not: null } },
        select: { workspaceId: true, websiteUrl: true },
      });
      workspaceId = selectWorkspaceForHost(
        request.headers.get("x-forwarded-host") || request.headers.get("host"),
        settings,
      );
    }
    if (!workspaceId) {
      console.warn("[portfolio-analytics] workspace_resolution_failed");
      return new NextResponse(null, { status: 204 });
    }

    const deviceCategory = classifyDevice(request.headers.get("user-agent"));
    if (deviceCategory === "automated") {
      console.info("[portfolio-analytics] automated_traffic_ignored");
      return new NextResponse(null, { status: 204 });
    }
    const { trafficSource, referrerHost } = normalizeReferrer(request.headers.get("referer"));
    const created = await prisma.portfolioAnalyticsEvent.create({
      data: {
        workspaceId,
        projectId,
        eventName: event.eventName,
        eventKey: analyticsEventKey(workspaceId, sessionId, event.eventId),
        sessionId,
        deviceCategory,
        trafficSource,
        referrerHost,
        channel: event.channel,
        target: event.target,
        metadata: event.metadata,
      },
    }).catch(error => {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        console.info("[portfolio-analytics] duplicate_event");
        return null;
      }
      throw error;
    });
    // A bounded sample confirms accepted writes without turning operational
    // logs into a duplicate analytics store. The admin health state reads the
    // authoritative latest event directly from the tenant-isolated table.
    if (created && created.eventKey?.startsWith("00")) {
      console.info("[portfolio-analytics] accepted_event_sample");
    }
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    const category = code === "P2021" || code === "P2022"
      ? "migration_or_schema_failure"
      : code.startsWith("P") ? "database_write_failure" : "unexpected_server_failure";
    console.error(`[portfolio-analytics] ${category}`);
    return new NextResponse(null, { status: 202 });
  }
}
