import { getContentOwnershipScope } from "@/lib/blog-ownership";
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
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  const { seriesId } = await context.params;
  const [series, groups] = await Promise.all([
    prisma.newsletterSeries.findUnique({ where: { id: seriesId, AND: [await getContentOwnershipScope(session.workspaceId)] }, include }),
    prisma.communicationGroup.findMany({
      where: await getContentOwnershipScope(session.workspaceId),
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { memberships: { where: { client: { workspaceMemberships: { some: { workspaceId: session.workspaceId } } } } } } } },
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
    const series = await updateSeries(seriesId, await request.json(), session.workspaceId);
    await recordAuditEvent({
      workspaceId: session.workspaceId, actorId: session.userId,
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
