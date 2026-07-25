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

const seriesInclude = {
  groups: { select: { groupId: true } },
  recipients: { select: { clientId: true } },
} as const;

export async function GET() {
  if (!await requireNewsletterAdministrator()) return forbiddenNewsletterResponse();
  const [series, editions, groups] = await Promise.all([
    prisma.newsletterSeries.findMany({ orderBy: { updatedAt: "desc" }, include: seriesInclude }),
    prisma.newsletterEdition.findMany({
      take: 50,
      orderBy: [{ intendedSendAt: "asc" }, { createdAt: "desc" }],
      include: editionInclude,
    }),
    prisma.communicationGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: true } } },
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
      const result = await generateNewsletterEdition(editionId, session.userId);
      await recordAuditEvent({
        actorId: session.userId, actorEmail: session.email,
        action: "NEWSLETTER_GENERATED", entityType: "NewsletterEdition", entityId: editionId,
        summary: "Generated a newsletter draft for administrator review.",
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (action === "pause-series" || action === "resume-series") {
      const seriesId = typeof body.seriesId === "string" ? body.seriesId : "";
      const series = await prisma.newsletterSeries.update({
        where: { id: seriesId },
        data: { status: action === "pause-series" ? "PAUSED" : "ACTIVE" },
      });
      await recordAuditEvent({
        actorId: session.userId, actorEmail: session.email,
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
    }, { status: 400 });
  }
}
