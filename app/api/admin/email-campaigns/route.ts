import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { renderCampaignEmail, sendCampaignBatch, sendTestCampaign } from "@/lib/client-communications/email";
import { addressIsMarketingEligible, createPreferenceToken } from "@/lib/client-communications/preferences";
import { getSiteUrl } from "@/lib/site";

type Payload = {
  action?: "test" | "send";
  subject?: string;
  previewText?: string;
  body?: string;
  mode?: "ALL" | "GROUPS" | "INDIVIDUALS";
  groupIds?: string[];
  clientIds?: string[];
  testEmail?: string;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  try {
    const input = await request.json() as Payload;
    const subject = cleanText(input.subject, 160);
    const previewText = cleanText(input.previewText, 180);
    const body = cleanText(input.body, 20_000);
    if (!subject || !body) {
      return NextResponse.json({ success: false, error: "Subject and message are required." }, { status: 400 });
    }
    if (input.action === "test") {
      const testEmail = cleanText(input.testEmail, 320).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
        return NextResponse.json({ success: false, error: "Enter a valid test email." }, { status: 400 });
      }
      await sendTestCampaign({
        to: testEmail,
        subject,
        html: renderCampaignEmail({ body, previewText, unsubscribeToken: "test-preview-disabled" }),
      });
      await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "EMAIL_CAMPAIGN_TEST_SENT", entityType: "EmailCampaign", summary: `Campaign test sent to ${testEmail}.` });
      return NextResponse.json({ success: true, message: `Test sent to ${testEmail}.` });
    }

    const mode = input.mode;
    const groupIds = [...new Set((input.groupIds ?? []).filter((value): value is string => typeof value === "string"))];
    const clientIds = [...new Set((input.clientIds ?? []).filter((value): value is string => typeof value === "string"))];
    if (!mode || (mode === "GROUPS" && !groupIds.length) || (mode === "INDIVIDUALS" && !clientIds.length)) {
      return NextResponse.json({ success: false, error: "Choose at least one recipient." }, { status: 400 });
    }
    const clients = await prisma.communicationClient.findMany({
      where: {
        emailSubscribed: true,
        normalizedEmail: { not: "" },
        ...(mode === "GROUPS" ? { groupMemberships: { some: { groupId: { in: groupIds } } } } : {}),
        ...(mode === "INDIVIDUALS" ? { id: { in: clientIds } } : {}),
      },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true, normalizedEmail: true },
    });
    const unique = [...new Map(
      clients
        .filter((client) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.normalizedEmail))
        .map((client) => [client.normalizedEmail, client]),
    ).values()];
    if (!unique.length) return NextResponse.json({ success: false, error: "No subscribed recipients with valid email addresses were found." }, { status: 400 });
    if (unique.length > 1_000) return NextResponse.json({ success: false, error: "Campaigns are limited to 1,000 recipients." }, { status: 400 });

    const campaign = await prisma.emailCampaign.create({
      data: {
        subject, previewText: previewText || null, body, status: "SENDING", recipientMode: mode,
        selection: { groupIds, clientIds }, recipientCount: unique.length, createdById: session.userId,
        recipients: { create: unique.map((client) => ({ clientId: client.id, email: client.email, displayName: client.displayName })) },
      },
      include: { recipients: true },
    });

    let sent = 0;
    let failed = 0;
    for (let index = 0; index < campaign.recipients.length; index += 100) {
      const candidates = campaign.recipients.slice(index, index + 100);
      const eligibility = await Promise.all(candidates.map(async recipient => ({
        recipient,
        eligible: await addressIsMarketingEligible(recipient.email.trim().toLowerCase()),
      })));
      const skipped = eligibility.filter(item => !item.eligible).map(item => item.recipient);
      if (skipped.length) await prisma.campaignRecipient.updateMany({
        where: { id: { in: skipped.map(recipient => recipient.id) } },
        data: { status: "SKIPPED", error: "Recipient opted out or became suppressed before delivery." },
      });
      const batch = eligibility.filter(item => item.eligible).map(item => item.recipient);
      if (!batch.length) continue;
      try {
        const tokens = await Promise.all(batch.map(recipient =>
          createPreferenceToken({ clientId: recipient.clientId, campaignId: campaign.id })));
        const result = await sendCampaignBatch({
          campaignId: `${campaign.id}-${index / 100}`,
          messages: batch.map((recipient, offset) => ({
            to: recipient.email, subject,
            html: renderCampaignEmail({ body, previewText, unsubscribeToken: tokens[offset] }),
            unsubscribeUrl: `${getSiteUrl()}/api/unsubscribe?token=${encodeURIComponent(tokens[offset])}`,
          })),
        });
        await prisma.$transaction(batch.map((recipient, offset) => prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", sentAt: new Date(), providerMessageId: result[offset]?.id ?? null },
        })));
        sent += batch.length;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error";
        await prisma.campaignRecipient.updateMany({ where: { id: { in: batch.map((recipient) => recipient.id) } }, data: { status: "FAILED", error: message } });
        failed += batch.length;
      }
    }
    const status = sent && failed ? "PARTIAL" : sent ? "SENT" : "FAILED";
    await prisma.emailCampaign.update({ where: { id: campaign.id }, data: { status, sentCount: sent, failedCount: failed, sentAt: sent ? new Date() : null } });
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email, action: "EMAIL_CAMPAIGN_SENT",
      entityType: "EmailCampaign", entityId: campaign.id,
      summary: `Campaign "${subject}" completed: ${sent} sent, ${failed} failed.`,
      metadata: { recipientMode: mode, recipients: unique.length, sent, failed },
    });
    return NextResponse.json({ success: sent > 0, campaignId: campaign.id, sent, failed, message: `${sent} email${sent === 1 ? "" : "s"} sent${failed ? `; ${failed} failed` : ""}.` }, { status: sent ? 200 : 502 });
  } catch (error) {
    console.error("Unable to process email campaign:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The campaign could not be processed." }, { status: 500 });
  }
}
