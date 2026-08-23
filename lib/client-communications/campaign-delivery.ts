import "server-only";

import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { renderCampaignEmail, sendCampaignBatch } from "./email";
import { renderPersonalizedEmail } from "./personalization";
import { addressIsMarketingEligible, createPreferenceToken } from "./preferences";
import { getSiteUrl } from "@/lib/site";
import { bouncedBackSystemKey } from "./bounce-core";

export async function processEmailCampaign(campaignId: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      createdBy: { select: { workspaceId: true } },
      recipients: { include: { client: { include: { groupMemberships: { include: { group: true } } } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!campaign || !["PROCESSING", "SENDING"].includes(campaign.status)) {
    throw new Error("Campaign is not available for delivery.");
  }

  let sent = campaign.recipients.filter((recipient) => recipient.status === "SENT").length;
  const pending = campaign.recipients.filter((recipient) => recipient.status !== "SENT" && recipient.status !== "SKIPPED");
  for (let index = 0; index < pending.length; index += 100) {
    const candidates = pending.slice(index, index + 100);
    const eligibility = await Promise.all(candidates.map(async (recipient) => ({
      recipient,
      eligible:
        !recipient.client.archivedAt &&
        recipient.client.emailSubscribed &&
        recipient.client.emailStatus === "VALID" &&
        !recipient.client.groupMemberships.some(({ group }) =>
          group.systemKey === bouncedBackSystemKey(campaign.createdBy.workspaceId)) &&
        await addressIsMarketingEligible(recipient.email.trim().toLowerCase()),
    })));
    const skipped = eligibility.filter((item) => !item.eligible).map((item) => item.recipient);
    if (skipped.length) {
      await prisma.campaignRecipient.updateMany({
        where: { id: { in: skipped.map(({ id }) => id) }, status: { not: "SENT" } },
        data: { status: "SKIPPED", error: "Recipient became ineligible before delivery." },
      });
    }
    const batch = eligibility.filter((item) => item.eligible).map((item) => item.recipient);
    if (!batch.length) continue;
    try {
      const tokens = await Promise.all(batch.map((recipient) =>
        createPreferenceToken({ clientId: recipient.clientId, campaignId: campaign.id })));
      const messages = batch.map((recipient, offset) => {
        const personalized = renderPersonalizedEmail({
          subject: campaign.subject,
          previewText: campaign.previewText,
          body: campaign.body,
          recipient: {
            firstName: recipient.firstNameSnapshot,
            lastName: recipient.lastNameSnapshot,
            fullName: recipient.fullNameSnapshot || recipient.displayName,
            email: recipient.email,
            phone: recipient.phoneSnapshot,
          },
        });
        return {
          to: recipient.email,
          subject: personalized.subject,
          html: renderCampaignEmail({
            body: personalized.body,
            previewText: personalized.previewText,
            unsubscribeToken: tokens[offset],
            templateKey: campaign.templateKey,
            imageUrl: campaign.imageUrl,
            imageAlt: campaign.imageAlt,
            imageCaption: campaign.imageCaption,
            imageLink: campaign.imageLink,
          }),
          unsubscribeUrl: `${getSiteUrl()}/api/unsubscribe?token=${encodeURIComponent(tokens[offset])}`,
        };
      });
      const result = await sendCampaignBatch({
        campaignId: campaign.id,
        source: "campaign",
        revisionKey: `${campaign.rowVersion}`,
        messages,
      });
      const now = new Date();
      await prisma.$transaction(batch.map((recipient, offset) => prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", sentAt: now, providerMessageId: result[offset]?.id ?? null, error: null },
      })));
      sent += batch.length;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown delivery error";
      await prisma.campaignRecipient.updateMany({
        where: { id: { in: batch.map(({ id }) => id) }, status: { not: "SENT" } },
        data: { status: "FAILED", error: message },
      });
    }
  }
  const skipped = await prisma.campaignRecipient.count({ where: { campaignId, status: "SKIPPED" } });
  const failed = await prisma.campaignRecipient.count({ where: { campaignId, status: "FAILED" } });
  const status = sent && failed ? "PARTIAL" : sent ? "SENT" : "FAILED";
  const completed = await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status,
      sentCount: sent,
      failedCount: failed,
      sentAt: sent ? new Date() : null,
      scheduleError: failed && !sent ? "Delivery failed for every eligible recipient." : null,
      rowVersion: { increment: 1 },
    },
  });
  await recordAuditEvent({
    action: status === "SENT" ? "EMAIL_SCHEDULED_DELIVERY_COMPLETED" : status === "PARTIAL" ? "EMAIL_SCHEDULED_DELIVERY_PARTIAL" : "EMAIL_SCHEDULED_DELIVERY_FAILED",
    entityType: "EmailCampaign",
    entityId: campaign.id,
    summary: `Campaign "${campaign.subject}" completed: ${sent} sent, ${failed} failed, ${skipped} skipped.`,
    metadata: { sent, failed, skipped },
  });
  return completed;
}

export async function claimDueEmailCampaigns(limit = 5) {
  const staleBefore = new Date(Date.now() - 15 * 60_000);
  await prisma.emailCampaign.updateMany({
    where: { status: "PROCESSING", processingStartedAt: { lt: staleBefore }, recipients: { some: { status: { in: ["PENDING", "FAILED"] } } } },
    data: { status: "SCHEDULED", processingStartedAt: null, scheduleError: "Recovered after an interrupted delivery attempt." },
  });
  const due = await prisma.emailCampaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const claimed: string[] = [];
  for (const { id } of due) {
    const result = await prisma.emailCampaign.updateMany({
      where: { id, status: "SCHEDULED", scheduledAt: { lte: new Date() } },
      data: { status: "PROCESSING", processingStartedAt: new Date(), scheduleError: null, rowVersion: { increment: 1 } },
    });
    if (result.count) claimed.push(id);
  }
  return claimed;
}
