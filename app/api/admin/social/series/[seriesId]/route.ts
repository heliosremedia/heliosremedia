import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateSeriesOccurrences } from "@/lib/social/series";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";

const clean = (value: unknown, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const workspaceId = session.workspaceId;
    const { seriesId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 40);
    if (action === "generate") {
      const through = new Date(clean(body.through, 40));
      if (!Number.isFinite(through.getTime())) return NextResponse.json({ success: false, error: "A valid generation date is required." }, { status: 400 });
      return NextResponse.json({ success: true, ...(await generateSeriesOccurrences({ seriesId, actor: session, through })) });
    }
    if (!["archive", "reschedule-occurrence"].includes(action)) return NextResponse.json({ success: false, error: "Unsupported series action." }, { status: 400 });
    const timeZone = clean(body.timeZone, 80) || "America/Denver";
    let scheduledAt: Date | undefined;
    if (action === "reschedule-occurrence") {
      try {
        scheduledAt = zonedLocalToUtc(clean(body.scheduledLocal, 40), timeZone);
        if (!Number.isFinite(scheduledAt.getTime())) throw new Error("invalid");
      } catch { return NextResponse.json({ success: false, error: "Choose a valid date and time zone." }, { status: 400 }); }
    }
    await prisma.$transaction(async (tx) => {
      await requireLockedWorkspaceEditor(tx, session);
      await tx.$queryRaw`SELECT id FROM "SocialSeries" WHERE id=${seriesId} AND "workspaceId"=${workspaceId} FOR UPDATE`;
      const series = await tx.socialSeries.findFirst({ where: { id: seriesId, workspaceId, status: "ACTIVE" }, select: { id: true } });
      if (!series) throw new Error("SOCIAL_SERIES_NOT_FOUND");
      if (action === "archive") {
        await tx.socialSeries.update({ where: { id: seriesId, workspaceId, status: "ACTIVE" }, data: { status: "ARCHIVED", lastEditedById: session.userId } });
      } else {
        const changed = await tx.socialSeriesOccurrence.updateMany({
          where: { id: clean(body.occurrenceId), seriesId, series: { workspaceId, status: "ACTIVE" }, variantId: null, campaignId: null },
          data: { scheduledAt: scheduledAt!, timeZone, editedIndependently: true },
        });
        if (!changed.count) throw new Error("SOCIAL_OCCURRENCE_NOT_FOUND");
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
    if (["SOCIAL_SERIES_NOT_FOUND", "SOCIAL_OCCURRENCE_NOT_FOUND"].includes(message)) return NextResponse.json({ success: false, error: "The active series or unassigned occurrence was not found." }, { status: 404 });
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ success: false, error: "An occurrence already exists at that time." }, { status: 409 });
    return NextResponse.json({ success: false, error: "The series could not be updated." }, { status: 500 });
  }
}
