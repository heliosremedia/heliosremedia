import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";
import { createSeries } from "@/lib/newsletters/studio";

export async function POST(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
  try {
    const series = await createSeries(await request.json(), session.userId);
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "NEWSLETTER_SERIES_CREATED",
      entityType: "NewsletterSeries",
      entityId: series.id,
      summary: `Created newsletter series "${series.name}".`,
    });
    return NextResponse.json({ success: true, seriesId: series.id });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Series could not be created.",
    }, { status: 400 });
  }
}
