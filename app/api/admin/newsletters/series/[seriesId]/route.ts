import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
  serializeSeries,
} from "@/lib/newsletters/api";
import { updateSeries } from "@/lib/newsletters/studio";

const include = {
  groups: { select: { groupId: true } },
  recipients: { select: { clientId: true } },
} as const;

type Context = { params: Promise<{ seriesId: string }> };

export async function GET(_request: Request, context: Context) {
  if (!await requireNewsletterAdministrator()) return forbiddenNewsletterResponse();
  const { seriesId } = await context.params;
  const [series, groups] = await Promise.all([
    prisma.newsletterSeries.findUnique({ where: { id: seriesId }, include }),
    prisma.communicationGroup.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: true } } },
    }),
  ]);
  if (!series) return NextResponse.json({ success: false, error: "Series not found." }, { status: 404 });
  return NextResponse.json({
    success: true,
    series: serializeSeries(series),
    groups: groups.map((group) => ({ id: group.id, name: group.name, count: group._count.memberships })),
  });
}

export async function PATCH(request: Request, context: Context) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const { seriesId } = await context.params;
    const series = await updateSeries(seriesId, await request.json());
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "NEWSLETTER_SERIES_UPDATED",
      entityType: "NewsletterSeries",
      entityId: series.id,
      summary: `Updated newsletter series "${series.name}".`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Series could not be updated.",
    }, { status: 400 });
  }
}
