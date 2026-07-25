import "server-only";

import { prisma } from "@/lib/prisma";
import { sendCampaignBatch } from "@/lib/client-communications/email";
import { campaignCanExecute, followUpShouldStop } from "./state-machine";

export async function processReferralCommunications(now = new Date(), limit = 50) {
  const due = await prisma.referralCommunication.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    include: {
      campaign: true,
      invitation: {
        include: {
          advocate: {
            include: {
              client: { include: { newsletterSuppressions: { where: { releasedAt: null }, select: { id: true } } } },
              _count: { select: { submissions: true } },
            },
          },
          _count: { select: { communications: true } },
        },
      },
      submission: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const communication of due) {
    const invitation = communication.invitation;
    const client = invitation?.advocate.client;
    const campaignActive = campaignCanExecute(communication.campaign.status, now, communication.campaign.startsAt, communication.campaign.endsAt);
    if (communication.campaign.status === "PAUSED") {
      result.skipped += 1;
      continue;
    }
    const stopFollowUp = communication.kind === "FOLLOW_UP" && invitation
      ? followUpShouldStop({
          campaignStatus: communication.campaign.status,
          campaignEndsAt: communication.campaign.endsAt,
          invitationStatus: invitation.status,
          submissionExists: invitation.advocate._count.submissions > 0,
          stoppedAt: invitation.followUpStoppedAt,
          now,
        })
      : false;
    const ineligible = client && (!client.emailSubscribed || client.archivedAt || client.emailStatus !== "VALID" || client.newsletterSuppressions.length > 0);
    if (!campaignActive || stopFollowUp || ineligible || !communication.htmlSnapshot) {
      await prisma.referralCommunication.update({
        where: { id: communication.id },
        data: { status: "CANCELLED", failureCode: !campaignActive ? "CAMPAIGN_INACTIVE" : stopFollowUp ? "FOLLOW_UP_STOPPED" : ineligible ? "RECIPIENT_INELIGIBLE" : "MISSING_RENDERED_CONTENT" },
      });
      result.skipped += 1;
      continue;
    }
    const claimed = await prisma.referralCommunication.updateMany({
      where: { id: communication.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (!claimed.count) continue;
    try {
      const response = await sendCampaignBatch({
        campaignId: communication.idempotencyKey || communication.id,
        from: communication.campaign.senderEmail
          ? `${communication.campaign.senderName || "Helios Real Estate Media"} <${communication.campaign.senderEmail}>`
          : undefined,
        replyTo: communication.campaign.replyTo,
        messages: [{ to: communication.recipientEmail, subject: communication.subject, html: communication.htmlSnapshot }],
      });
      await prisma.$transaction([
        prisma.referralCommunication.update({
          where: { id: communication.id },
          data: { status: "SENT", sentAt: now, providerMessageId: response[0]?.id ?? null },
        }),
        ...(invitation && communication.kind === "INVITATION"
          ? [prisma.referralInvitation.update({
              where: { id: invitation.id },
              data: { status: "SENT", sentAt: now, providerMessageId: response[0]?.id ?? null },
            })]
          : []),
        prisma.referralAuditEvent.create({
          data: { campaignId: communication.campaignId, submissionId: communication.submissionId, action: "COMMUNICATION_SENT", summary: `${communication.kind.replaceAll("_", " ")} sent.`, metadata: { communicationId: communication.id } },
        }),
      ]);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown provider failure";
      await prisma.$transaction([
        prisma.referralCommunication.update({
          where: { id: communication.id },
          data: { status: "FAILED", failureCode: "PROVIDER_REJECTED", failureMessage: message },
        }),
        ...(invitation && communication.kind === "INVITATION"
          ? [prisma.referralInvitation.update({
              where: { id: invitation.id },
              data: { status: "FAILED", failureCode: "PROVIDER_REJECTED", failureMessage: message },
            })]
          : []),
      ]);
      result.failed += 1;
    }
  }
  return result;
}
