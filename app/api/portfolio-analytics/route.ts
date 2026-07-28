import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyticsEventKey, classifyDevice, normalizeReferrer, parsePortfolioEvent,
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
    if (rateLimited(key)) return new NextResponse(null, { status: 429 });
    const body = await request.json() as Record<string, unknown>;
    const event = parsePortfolioEvent(body);
    const sessionId = typeof body.sessionId === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(body.sessionId)
      ? body.sessionId : null;
    if (!event || !sessionId) return new NextResponse(null, { status: 400 });

    let projectId: string | null = null;
    let workspaceId: string | null = null;
    if (event.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: event.projectId, status: "PUBLISHED" },
        select: { id: true, workspaceId: true },
      });
      if (!project) return new NextResponse(null, { status: 404 });
      projectId = project.id;
      workspaceId = project.workspaceId;
    } else {
      const settings = await prisma.siteSettings.findFirst({
        where: { workspaceId: { not: null } },
        select: { workspaceId: true },
      });
      workspaceId = settings?.workspaceId ?? null;
    }
    if (!workspaceId) return new NextResponse(null, { status: 204 });

    const deviceCategory = classifyDevice(request.headers.get("user-agent"));
    if (deviceCategory === "automated") return new NextResponse(null, { status: 204 });
    const { trafficSource, referrerHost } = normalizeReferrer(request.headers.get("referer"));
    await prisma.portfolioAnalyticsEvent.create({
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
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") return null;
      throw error;
    });
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error("Portfolio analytics event was not recorded.", error);
    return new NextResponse(null, { status: 202 });
  }
}
