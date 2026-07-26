import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { processEmailCampaign } from "@/lib/client-communications/campaign-delivery";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ campaignId: string }> };

export async function PATCH(request: Request, context: Context) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  const { campaignId } = await context.params;
  const input = await request.json() as { action?: "reschedule" | "cancel" | "send-now" | "edit"; scheduledLocal?: string; scheduledTimeZone?: string; rowVersion?: number };
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SCHEDULED") {
    return NextResponse.json({ success: false, error: "Only scheduled campaigns can be changed." }, { status: 409 });
  }
  const where = { id: campaignId, status: "SCHEDULED" as const, rowVersion: input.rowVersion ?? campaign.rowVersion };
  let action = "";
  if (input.action === "reschedule") {
    const timeZone = input.scheduledTimeZone?.trim() || "America/Denver";
    const scheduledAt = zonedLocalToUtc(input.scheduledLocal?.trim() || "", timeZone);
    if (scheduledAt.getTime() <= Date.now() + 60_000) return NextResponse.json({ success: false, error: "Choose a future delivery time." }, { status: 400 });
    const result = await prisma.emailCampaign.updateMany({ where, data: { scheduledAt, scheduledTimeZone: timeZone, scheduledById: session.userId, rowVersion: { increment: 1 } } });
    if (!result.count) return NextResponse.json({ success: false, error: "The schedule changed in another tab. Refresh and try again." }, { status: 409 });
    action = "EMAIL_CAMPAIGN_RESCHEDULED";
  } else if (input.action === "cancel") {
    const result = await prisma.emailCampaign.updateMany({ where, data: { status: "CANCELLED", cancelledAt: new Date(), rowVersion: { increment: 1 } } });
    if (!result.count) return NextResponse.json({ success: false, error: "The campaign is already processing or changed." }, { status: 409 });
    action = "EMAIL_CAMPAIGN_SCHEDULE_CANCELLED";
  } else if (input.action === "edit") {
    const result = await prisma.emailCampaign.updateMany({ where, data: { status: "DRAFT", scheduledAt: null, scheduledTimeZone: null, cancelledAt: new Date(), rowVersion: { increment: 1 } } });
    if (!result.count) return NextResponse.json({ success: false, error: "The campaign is already processing or changed." }, { status: 409 });
    action = "EMAIL_CAMPAIGN_RETURNED_TO_DRAFT";
  } else if (input.action === "send-now") {
    const result = await prisma.emailCampaign.updateMany({ where, data: { status: "PROCESSING", scheduledAt: new Date(), processingStartedAt: new Date(), rowVersion: { increment: 1 } } });
    if (!result.count) return NextResponse.json({ success: false, error: "The campaign is already processing or changed." }, { status: 409 });
    action = "EMAIL_CAMPAIGN_SCHEDULED_SEND_NOW";
    await processEmailCampaign(campaignId);
  } else {
    return NextResponse.json({ success: false, error: "Choose a valid schedule action." }, { status: 400 });
  }
  await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action, entityType: "EmailCampaign", entityId: campaignId, summary: `${action.replaceAll("_", " ").toLowerCase()} by ${session.email}.` });
  return NextResponse.json({ success: true });
}
