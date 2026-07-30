import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { processEmailCampaign } from "@/lib/client-communications/campaign-delivery";
import { renderCampaignEmail, sendTestCampaign } from "@/lib/client-communications/email";
import { EmailDeliveryError } from "@/lib/client-communications/email";
import { findUnsupportedVariables, renderPersonalizedEmail } from "@/lib/client-communications/personalization";
import { DEFAULT_CAMPAIGN_TIME_ZONE, zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { prisma } from "@/lib/prisma";
import { bouncedBackSystemKey } from "@/lib/client-communications/bounce-core";

type Payload = {
  action?: "test" | "send" | "schedule";
  subject?: string; previewText?: string; body?: string;
  mode?: "ALL" | "GROUPS" | "INDIVIDUALS";
  groupIds?: string[]; clientIds?: string[];
  testEmail?: string; previewClientId?: string; useSampleProfile?: boolean;
  scheduledLocal?: string; scheduledTimeZone?: string;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function authorizedSession() {
  const session = await getAdminSession();
  return session && ["OWNER", "ADMIN"].includes(session.role) ? session : null;
}

export async function POST(request: Request) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  try {
    const input = await request.json() as Payload;
    const subject = cleanText(input.subject, 160);
    const previewText = cleanText(input.previewText, 180);
    const body = cleanText(input.body, 20_000);
    if (!subject || !body) return NextResponse.json({ success: false, error: "Subject and message are required." }, { status: 400 });
    const unsupported = findUnsupportedVariables(subject, previewText, body);
    if (unsupported.length) {
      return NextResponse.json({ success: false, error: `Unsupported personalization variable: {{${unsupported[0]}}}` }, { status: 400 });
    }

    if (input.action === "test") {
      const testEmail = cleanText(input.testEmail, 320).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
        return NextResponse.json({ success: false, error: "Enter a valid test email." }, { status: 400 });
      }
      const selected = input.previewClientId ? await prisma.communicationClient.findFirst({
        where: { id: input.previewClientId, emailSubscribed: true, archivedAt: null },
        select: { firstName: true, lastName: true, displayName: true, email: true, phone: true },
      }) : null;
      const profile = selected ? {
        firstName: selected.firstName, lastName: selected.lastName, fullName: selected.displayName,
        email: selected.email, phone: selected.phone,
      } : {
        firstName: "Preview", lastName: "Recipient", fullName: "Preview Recipient",
        email: "preview@example.com", phone: "(555) 010-0193",
      };
      const personalized = renderPersonalizedEmail({ subject, previewText, body, recipient: profile });
      await sendTestCampaign({
        to: testEmail,
        subject: personalized.subject,
        html: renderCampaignEmail({ body: personalized.body, previewText: personalized.previewText, unsubscribeToken: "test-preview-disabled" }),
        source: "campaign",
      });
      await recordAuditEvent({
        actorId: session.userId, actorEmail: session.email, action: "EMAIL_CAMPAIGN_TEST_SENT",
        entityType: "EmailCampaign", summary: `Personalized campaign test sent to ${testEmail}.`,
        metadata: { previewClientId: selected ? input.previewClientId : null, sampleProfile: !selected },
      });
      return NextResponse.json({ success: true, message: `Personalized test sent to ${testEmail}.` });
    }

    const mode = input.mode;
    const groupIds = [...new Set((input.groupIds ?? []).filter((value): value is string => typeof value === "string"))];
    const clientIds = [...new Set((input.clientIds ?? []).filter((value): value is string => typeof value === "string"))];
    if (!mode || (mode === "GROUPS" && !groupIds.length) || (mode === "INDIVIDUALS" && !clientIds.length)) {
      return NextResponse.json({ success: false, error: "Choose at least one recipient." }, { status: 400 });
    }
    const clients = await prisma.communicationClient.findMany({
      where: {
        emailSubscribed: true, emailStatus: "VALID", archivedAt: null, normalizedEmail: { not: "" },
        groupMemberships: {
          none: { group: { systemKey: bouncedBackSystemKey(session.workspaceId) } },
          ...(mode === "GROUPS" ? { some: { groupId: { in: groupIds } } } : {}),
        },
        ...(mode === "INDIVIDUALS" ? { id: { in: clientIds } } : {}),
      },
      orderBy: { displayName: "asc" },
      select: { id: true, firstName: true, lastName: true, displayName: true, email: true, normalizedEmail: true, phone: true },
    });
    const unique = [...new Map(clients.filter(({ normalizedEmail }) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)).map((client) => [client.normalizedEmail, client])).values()];
    if (!unique.length) return NextResponse.json({ success: false, error: "No eligible subscribed recipients were found." }, { status: 400 });
    if (unique.length > 1_000) return NextResponse.json({ success: false, error: "Campaigns are limited to 1,000 recipients." }, { status: 400 });

    let scheduledAt: Date | null = null;
    const timeZone = cleanText(input.scheduledTimeZone, 100) || DEFAULT_CAMPAIGN_TIME_ZONE;
    if (input.action === "schedule") {
      scheduledAt = zonedLocalToUtc(cleanText(input.scheduledLocal, 40), timeZone);
      if (scheduledAt.getTime() <= Date.now() + 60_000) {
        return NextResponse.json({ success: false, error: "Choose a delivery time at least one minute in the future." }, { status: 400 });
      }
    }
    if (!["send", "schedule"].includes(input.action ?? "")) {
      return NextResponse.json({ success: false, error: "Choose Send Now or Schedule Email." }, { status: 400 });
    }
    const status = input.action === "schedule" ? "SCHEDULED" : "PROCESSING";
    const campaign = await prisma.emailCampaign.create({
      data: {
        subject, previewText: previewText || null, body, status, recipientMode: mode,
        selection: { groupIds, clientIds }, recipientCount: unique.length, createdById: session.userId,
        scheduledAt, scheduledTimeZone: scheduledAt ? timeZone : null,
        scheduledById: scheduledAt ? session.userId : null,
        processingStartedAt: scheduledAt ? null : new Date(),
        recipients: { create: unique.map((client) => ({
          clientId: client.id, email: client.email, displayName: client.displayName,
          firstNameSnapshot: client.firstName, lastNameSnapshot: client.lastName,
          fullNameSnapshot: client.displayName, phoneSnapshot: client.phone,
        })) },
      },
    });
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email,
      action: scheduledAt ? "EMAIL_CAMPAIGN_SCHEDULED" : "EMAIL_CAMPAIGN_SEND_NOW",
      entityType: "EmailCampaign", entityId: campaign.id,
      summary: scheduledAt ? `Campaign "${subject}" scheduled for ${scheduledAt.toISOString()}.` : `Campaign "${subject}" started immediately.`,
      metadata: { recipientMode: mode, recipients: unique.length, scheduledAt: scheduledAt?.toISOString(), timeZone, variables: [...new Set([subject, previewText, body].flatMap((value) => [...value.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((match) => match[1])))] },
    });
    if (scheduledAt) {
      return NextResponse.json({ success: true, campaignId: campaign.id, scheduledAt: scheduledAt.toISOString(), message: `Email scheduled for ${unique.length} recipients.` });
    }
    const completed = await processEmailCampaign(campaign.id);
    return NextResponse.json({
      success: completed.sentCount > 0, campaignId: campaign.id,
      sent: completed.sentCount, failed: completed.failedCount,
      message: `${completed.sentCount} email${completed.sentCount === 1 ? "" : "s"} sent${completed.failedCount ? `; ${completed.failedCount} failed` : ""}.`,
    }, { status: completed.sentCount ? 200 : 502 });
  } catch (error) {
    console.error("Unable to process email campaign:", error);
    if (error instanceof EmailDeliveryError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.code === "EMAIL_PROVIDER_NOT_CONFIGURED" ? 503 : 502 },
      );
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The campaign could not be processed." }, { status: 500 });
  }
}
