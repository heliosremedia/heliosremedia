import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateSeriesOccurrences } from "@/lib/social/series";
import { requireWorkspaceId } from "@/lib/workspaces";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";

const clean = (value: unknown, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const workspaceId = await requireWorkspaceId(session.userId);
  const { seriesId } = await params;
  const body = await request.json() as Record<string, unknown>;
  const action = clean(body.action, 40);
  const series = await prisma.socialSeries.findFirst({ where: { id: seriesId, workspaceId }, select: { id: true } });
  if (!series) return NextResponse.json({ success: false, error: "Series not found." }, { status: 404 });
  if (action === "archive") {
    await prisma.socialSeries.update({ where: { id: seriesId }, data: { status: "ARCHIVED", lastEditedById: session.userId } });
    return NextResponse.json({ success: true });
  }
  if (action === "generate") {
    const through = new Date(clean(body.through, 40));
    if (Number.isNaN(through.getTime())) return NextResponse.json({ success: false, error: "A valid generation date is required." }, { status: 400 });
    return NextResponse.json({ success: true, ...(await generateSeriesOccurrences({ seriesId, workspaceId, through })) });
  }
  if (action === "reschedule-occurrence") {
    const occurrenceId = clean(body.occurrenceId, 100);
    const timeZone = clean(body.timeZone, 80) || "America/Denver";
    const scheduledLocal = clean(body.scheduledLocal, 40);
    const scheduledAt = zonedLocalToUtc(scheduledLocal, timeZone);
    const changed = await prisma.socialSeriesOccurrence.updateMany({
      where: { id: occurrenceId, seriesId, series: { workspaceId }, variantId: null },
      data: { scheduledAt, timeZone, editedIndependently: true },
    });
    if (!changed.count) return NextResponse.json({ success: false, error: "Planned occurrence not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: "Unsupported series action." }, { status: 400 });
}
