import "server-only";

import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";

type ScheduleActor = { userId: string; email: string };

export async function scheduleReferralCampaign(
  campaignId: string,
  firstSendAt: Date,
  timezone: string,
  actor: ScheduleActor,
) {
  if (!Number.isFinite(firstSendAt.getTime()) || firstSendAt <= new Date()) {
    throw new Error("Choose a future date and time for the first invitation.");
  }
  if (!Intl.supportedValuesOf("timeZone").includes(timezone)) throw new Error("Choose a valid time zone.");

  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true, internalName: true, status: true, approvedRevisionId: true,
      preparedAdvocateCount: true, expectedAdvocateCount: true,
      deliveryScheduledAt: true, deliveryTimezone: true, scheduleConfirmedAt: true,
      scheduleVersion: true, scheduledRevisionId: true, scheduledAudienceCount: true,
      followUpConfiguration: true,
    },
  });
  if (!campaign?.approvedRevisionId) throw new Error("Approve and prepare the campaign before scheduling.");
  if (!["APPROVED", "ACTIVE"].includes(campaign.status)) throw new Error("This campaign is not ready to schedule.");
  if (!campaign.preparedAdvocateCount || campaign.preparedAdvocateCount !== campaign.expectedAdvocateCount) {
    throw new Error("Campaign preparation is incomplete.");
  }
  if (campaign.scheduleConfirmedAt
    && campaign.deliveryScheduledAt?.getTime() === firstSendAt.getTime()
    && campaign.deliveryTimezone === timezone
    && campaign.scheduledRevisionId === campaign.approvedRevisionId
    && campaign.scheduledAudienceCount === campaign.preparedAdvocateCount) {
    return { scheduledAt: firstSendAt, timezone, unchanged: true, version: campaign.scheduleVersion };
  }

  const followUp = campaign.followUpConfiguration as { enabled?: boolean; count?: number; delayDays?: number };
  const followUpCount = followUp.enabled ? Math.max(0, Math.min(3, Number(followUp.count) || 0)) : 0;
  const delayDays = Math.max(2, Math.min(60, Number(followUp.delayDays) || 7));
  const confirmedAt = new Date();
  await prisma.$transaction(async tx => {
    const current = await tx.referralCampaign.findUnique({
      where: { id: campaignId },
      select: {
        scheduleVersion: true, approvedRevisionId: true, preparedAdvocateCount: true,
        scheduleConfirmedAt: true, deliveryScheduledAt: true, deliveryTimezone: true,
      },
    });
    if (!current || current.approvedRevisionId !== campaign.approvedRevisionId || current.preparedAdvocateCount !== campaign.preparedAdvocateCount) {
      throw new Error("Campaign audience or approval changed. Reload and review the schedule again.");
    }
    if (current.scheduleConfirmedAt
      && current.deliveryScheduledAt?.getTime() === firstSendAt.getTime()
      && current.deliveryTimezone === timezone) return;
    const previousSchedule = current.deliveryScheduledAt?.toISOString() ?? null;
    const nextVersion = current.scheduleVersion + 1;
    await tx.referralCampaign.update({
      where: { id: campaignId },
      data: {
        status: "APPROVED",
        deliveryScheduledAt: firstSendAt,
        deliveryTimezone: timezone,
        scheduleConfirmedAt: confirmedAt,
        scheduledById: actor.userId,
        scheduleVersion: nextVersion,
        scheduledRevisionId: campaign.approvedRevisionId,
        scheduledAudienceCount: campaign.preparedAdvocateCount,
        scheduleCancelledAt: null,
      },
    });
    await tx.referralInvitation.updateMany({
      where: { campaignId, approvedRevisionId: campaign.approvedRevisionId, status: { in: ["APPROVED", "SCHEDULED"] } },
      data: { status: "SCHEDULED", scheduledAt: firstSendAt },
    });
    await tx.referralCommunication.updateMany({
      where: { campaignId, kind: "INVITATION", status: { in: ["APPROVED", "SCHEDULED"] } },
      data: { status: "SCHEDULED", scheduledAt: firstSendAt },
    });
    for (let step = 1; step <= followUpCount; step += 1) {
      await tx.referralCommunication.updateMany({
        where: {
          campaignId, kind: "FOLLOW_UP", status: { in: ["APPROVED", "SCHEDULED"] },
          idempotencyKey: { endsWith: `:follow-up:${step}` },
        },
        data: {
          status: "SCHEDULED",
          scheduledAt: new Date(firstSendAt.getTime() + delayDays * step * 86_400_000),
        },
      });
    }
    await tx.referralAuditEvent.create({
      data: {
        campaignId, actorId: actor.userId,
        action: current.scheduleConfirmedAt ? "CAMPAIGN_SCHEDULE_EDITED" : "CAMPAIGN_SCHEDULE_CREATED",
        summary: `Scheduled the initial invitation for ${firstSendAt.toISOString()} (${timezone}).`,
        metadata: {
          firstSendAt: firstSendAt.toISOString(), timezone,
          advocateCount: campaign.preparedAdvocateCount,
          sequenceSteps: 1 + followUpCount,
          estimatedMessages: campaign.preparedAdvocateCount * (1 + followUpCount),
          previousSchedule, newSchedule: firstSendAt.toISOString(),
          scheduleVersion: nextVersion,
          audienceSnapshotVersion: campaign.approvedRevisionId,
          sequenceVersion: campaign.approvedRevisionId,
        },
      },
    });
  }, { timeout: 15_000, maxWait: 5_000 });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_SCHEDULED",
    entityType: "ReferralCampaign", entityId: campaignId,
    summary: `Scheduled referral campaign "${campaign.internalName}" for ${firstSendAt.toISOString()}.`,
  });
  const updated = await prisma.referralCampaign.findUnique({ where: { id: campaignId }, select: { scheduleVersion: true } });
  return { scheduledAt: firstSendAt, timezone, unchanged: false, version: updated?.scheduleVersion ?? campaign.scheduleVersion + 1 };
}

export async function cancelReferralCampaignSchedule(campaignId: string, actor: ScheduleActor) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
    select: {
      internalName: true, scheduleConfirmedAt: true, deliveryScheduledAt: true,
      deliveryTimezone: true, scheduleVersion: true, preparedAdvocateCount: true,
      approvedRevisionId: true,
    },
  });
  if (!campaign?.scheduleConfirmedAt) return { unchanged: true };
  const cancelledAt = new Date();
  await prisma.$transaction(async tx => {
    await tx.referralCommunication.updateMany({
      where: { campaignId, status: { in: ["APPROVED", "SCHEDULED"] }, sentAt: null },
      data: { status: "APPROVED", scheduledAt: null },
    });
    await tx.referralInvitation.updateMany({
      where: { campaignId, status: { in: ["APPROVED", "SCHEDULED"] }, sentAt: null },
      data: { status: "APPROVED", scheduledAt: null },
    });
    await tx.referralCampaign.update({
      where: { id: campaignId },
      data: {
        status: "APPROVED", deliveryScheduledAt: null, scheduleConfirmedAt: null,
        scheduledById: null, scheduledRevisionId: null, scheduledAudienceCount: null,
        scheduleCancelledAt: cancelledAt, scheduleVersion: { increment: 1 },
      },
    });
    await tx.referralAuditEvent.create({
      data: {
        campaignId, actorId: actor.userId, action: "CAMPAIGN_SCHEDULE_CANCELLED",
        summary: "Cancelled all future unsent referral communications.",
        metadata: {
          previousSchedule: campaign.deliveryScheduledAt?.toISOString() ?? null,
          newSchedule: null, timezone: campaign.deliveryTimezone,
          scheduleVersion: campaign.scheduleVersion + 1,
          audienceSnapshotVersion: campaign.approvedRevisionId,
          totalPlannedMessages: campaign.preparedAdvocateCount,
        },
      },
    });
  }, { timeout: 15_000, maxWait: 5_000 });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_SCHEDULE_CANCELLED",
    entityType: "ReferralCampaign", entityId: campaignId,
    summary: `Cancelled the future schedule for referral campaign "${campaign.internalName}".`,
  });
  return { unchanged: false };
}
