import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { getSiteUrl } from "@/lib/site";
import { generatePreferenceToken, hashPreferenceToken, MARKETING_TOKEN_TTL_DAYS } from "@/lib/client-communications/preferences";
import { personalizeReferralCopy, renderReferralInvitationEmail } from "./email-renderer";
import { createReferralCredentials } from "./tokens";
import {
  referralCommunicationIdempotencyKey,
  referralLaunchClaimMode,
  referralLaunchBatches,
  referralLaunchIsComplete,
  REFERRAL_STALE_LAUNCH_MS,
  referralRecoveryMode,
  missingReferralRecipients,
} from "./launch-contract";

const LEASE_MS = 4 * 60_000;

type LaunchActor = { userId: string; email: string };
type ApprovedRecipient = { id: string; displayName: string; firstName: string; email: string };
type ApprovedSnapshot = {
  audience?: { eligible?: ApprovedRecipient[] };
  campaign?: {
    invitationSubject?: string;
    invitationPreviewText?: string | null;
    invitationBody?: string;
    followUpConfiguration?: { enabled?: boolean; count?: number; delayDays?: number };
    communicationTemplates?: { followUp?: string };
  };
};

export class ReferralLaunchConflictError extends Error {
  constructor(message = "This campaign is already being prepared. Refresh to see its progress.") {
    super(message);
    this.name = "ReferralLaunchConflictError";
  }
}

function launchLog(
  event: "claimed" | "processor_started" | "batch_started" | "batch_completed" | "processor_failed" | "completed" | "stale_attempt_ignored",
  details: Record<string, string | number | null>,
) {
  const method = event === "processor_failed" ? console.error : console.info;
  method(`[referral-launch] ${event}`, details);
}

export async function claimReferralCampaignLaunch(campaignId: string, actor: LaunchActor) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true, internalName: true, status: true, approvedRevisionId: true,
      launchFailedAt: true, expectedAdvocateCount: true, preparedAdvocateCount: true,
    },
  });
  if (!campaign?.approvedRevisionId) throw new Error("Approve the campaign before launch.");

  const claimMode = referralLaunchClaimMode(campaign.status, campaign.launchFailedAt !== null);
  const retry = claimMode === "RETRY";
  if (claimMode === "IN_PROGRESS") throw new ReferralLaunchConflictError();
  if (claimMode === "REJECTED") throw new Error("Only an approved campaign can be launched.");

  const revision = await prisma.referralCampaignRevision.findUnique({
    where: { id: campaign.approvedRevisionId },
    select: { snapshot: true },
  });
  const audience = (revision?.snapshot as ApprovedSnapshot | undefined)?.audience?.eligible ?? [];
  if (!revision || !audience.length) throw new Error("The approved campaign has no eligible advocates.");

  const attemptId = randomUUID();
  const now = new Date();
  const claimed = await prisma.$transaction(async tx => {
    const result = await tx.referralCampaign.updateMany({
      where: retry
        ? { id: campaignId, status: "LAUNCHING", approvedRevisionId: campaign.approvedRevisionId, launchFailedAt: { not: null } }
        : { id: campaignId, status: "APPROVED", approvedRevisionId: campaign.approvedRevisionId },
      data: {
        status: "LAUNCHING",
        launchStartedAt: retry ? undefined : now,
        launchCompletedAt: null,
        launchFailedAt: null,
        launchLeaseExpiresAt: null,
        launchingAdminId: actor.userId,
        launchRevisionId: campaign.approvedRevisionId,
        launchAttemptId: attemptId,
        expectedAdvocateCount: audience.length,
        preparedAdvocateCount: retry ? undefined : 0,
        preparedInvitationCount: retry ? undefined : 0,
        preparedCommunicationCount: retry ? undefined : 0,
        launchBatch: retry ? undefined : 0,
        lastLaunchError: null,
      },
    });
    if (result.count !== 1) throw new ReferralLaunchConflictError();
    await tx.referralAuditEvent.create({
      data: {
        campaignId, actorId: actor.userId,
        action: retry ? "CAMPAIGN_LAUNCH_RETRIED" : "CAMPAIGN_LAUNCH_CLAIMED",
        summary: retry ? "Retried campaign preparation safely." : `Claimed campaign preparation for ${audience.length} advocates.`,
        metadata: {
          launchAttemptId: attemptId, approvedRevisionId: campaign.approvedRevisionId,
          expectedAdvocateCount: audience.length, previousStatus: campaign.status, newStatus: "LAUNCHING",
        },
      },
    });
    return result;
  });
  void claimed;
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email,
    action: retry ? "REFERRAL_CAMPAIGN_LAUNCH_RETRIED" : "REFERRAL_CAMPAIGN_LAUNCH_REQUESTED",
    entityType: "ReferralCampaign", entityId: campaignId,
    summary: `${retry ? "Retried" : "Requested"} preparation of referral campaign "${campaign.internalName}".`,
    metadata: { launchAttemptId: attemptId, approvedRevisionId: campaign.approvedRevisionId, expectedAdvocateCount: audience.length },
  });
  launchLog("claimed", {
    campaignId,
    launchAttemptId: attemptId,
    expectedCount: audience.length,
    preparedCount: campaign.preparedAdvocateCount,
  });
  return { attemptId, expectedAdvocateCount: audience.length, preparedAdvocateCount: campaign.preparedAdvocateCount };
}

function launchPlan(snapshot: ApprovedSnapshot, campaign: {
  invitationSubject: string; invitationPreviewText: string | null; invitationBody: string;
  publicTitle: string; referralExpirationDays: number; startsAt: Date | null;
}) {
  const scheduledAt = campaign.startsAt && campaign.startsAt > new Date() ? campaign.startsAt : new Date();
  const followUp = snapshot.campaign?.followUpConfiguration;
  const followUpBody = snapshot.campaign?.communicationTemplates?.followUp?.trim();
  const followUpCount = followUp?.enabled && followUpBody ? Math.max(0, Math.min(3, Number(followUp.count) || 0)) : 0;
  const followUpDelayDays = Math.max(2, Math.min(60, Number(followUp?.delayDays) || 7));
  return {
    scheduledAt, followUpBody, followUpCount, followUpDelayDays,
    subject: snapshot.campaign?.invitationSubject ?? campaign.invitationSubject,
    previewText: snapshot.campaign?.invitationPreviewText ?? campaign.invitationPreviewText,
    body: snapshot.campaign?.invitationBody ?? campaign.invitationBody,
  };
}

async function prepareBatch(campaign: {
  id: string; publicTitle: string; referralExpirationDays: number; approvedRevisionId: string | null;
}, snapshot: ApprovedSnapshot, recipients: ApprovedRecipient[], batchNumber: number, attemptId: string,
plan: ReturnType<typeof launchPlan>) {
  const prepared = recipients.map(recipient => ({
    recipient,
    credentials: createReferralCredentials(),
    unsubscribeToken: generatePreferenceToken(),
  }));
  for (let collisionAttempt = 0; collisionAttempt < 3; collisionAttempt += 1) {
    try {
      await prisma.$transaction(async tx => {
        for (const item of prepared) {
          const advocate = await tx.referralAdvocate.upsert({
            where: { campaignId_clientId: { campaignId: campaign.id, clientId: item.recipient.id } },
            create: { campaignId: campaign.id, clientId: item.recipient.id, includedAt: new Date() },
            update: { includedAt: new Date(), dismissedAt: null },
          });
          const invitation = await tx.referralInvitation.create({
            data: {
              campaignId: campaign.id, advocateId: advocate.id, approvedRevisionId: campaign.approvedRevisionId,
              status: "SCHEDULED", subject: plan.subject, previewText: plan.previewText, body: plan.body,
              approvedSnapshot: snapshot as Prisma.InputJsonValue, scheduledAt: plan.scheduledAt,
            },
          });
          await tx.referralLink.create({
            data: {
              invitationId: invitation.id, campaignId: campaign.id, advocateId: advocate.id,
              tokenHash: item.credentials.tokenHash, code: item.credentials.code,
              expiresAt: new Date(plan.scheduledAt.getTime() + campaign.referralExpirationDays * 86_400_000),
            },
          });
          const preference = await tx.marketingEmailPreference.upsert({
            where: { normalizedEmail: item.recipient.email.trim().toLowerCase() },
            create: { normalizedEmail: item.recipient.email.trim().toLowerCase(), status: "UNKNOWN", source: "REFERRAL_CAMPAIGN" },
            update: {},
          });
          await tx.marketingEmailPreferenceToken.create({
            data: {
              preferenceId: preference.id, tokenHash: hashPreferenceToken(item.unsubscribeToken),
              expiresAt: new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000), campaignId: campaign.id,
            },
          });
          const referralUrl = `${getSiteUrl()}/refer/${encodeURIComponent(item.credentials.token)}`;
          const variables = {
            firstName: item.recipient.firstName || item.recipient.displayName.split(/\s+/)[0] || "there",
            referralUrl, referralCode: item.credentials.code, campaignTitle: campaign.publicTitle,
          };
          const body = personalizeReferralCopy(invitation.body, variables);
          await tx.referralCommunication.create({
            data: {
              campaignId: campaign.id, invitationId: invitation.id, kind: "INVITATION", status: "SCHEDULED",
              recipientEmail: item.recipient.email, recipientName: item.recipient.displayName,
              subject: personalizeReferralCopy(invitation.subject, variables),
              htmlSnapshot: renderReferralInvitationEmail({
                body, previewText: invitation.previewText, unsubscribeToken: item.unsubscribeToken,
                referralUrl, referralCode: item.credentials.code, campaignTitle: campaign.publicTitle,
              }),
              contentHash: createHash("sha256").update(body).digest("hex"), scheduledAt: plan.scheduledAt,
              idempotencyKey: referralCommunicationIdempotencyKey(invitation.id),
            },
          });
          for (let followUpNumber = 1; followUpNumber <= plan.followUpCount; followUpNumber += 1) {
            const followUpBody = personalizeReferralCopy(plan.followUpBody!, variables);
            await tx.referralCommunication.create({
              data: {
                campaignId: campaign.id, invitationId: invitation.id, kind: "FOLLOW_UP", status: "SCHEDULED",
                recipientEmail: item.recipient.email, recipientName: item.recipient.displayName,
                subject: `A gentle reminder: ${invitation.subject}`,
                htmlSnapshot: renderReferralInvitationEmail({
                  body: followUpBody, previewText: invitation.previewText, unsubscribeToken: item.unsubscribeToken,
                  referralUrl, referralCode: item.credentials.code, campaignTitle: campaign.publicTitle,
                }),
                contentHash: createHash("sha256").update(followUpBody).digest("hex"),
                scheduledAt: new Date(plan.scheduledAt.getTime() + plan.followUpDelayDays * followUpNumber * 86_400_000),
                idempotencyKey: referralCommunicationIdempotencyKey(invitation.id, followUpNumber),
              },
            });
          }
        }
        await tx.referralAuditEvent.create({
          data: {
            campaignId: campaign.id, action: "CAMPAIGN_LAUNCH_BATCH_COMPLETED",
            summary: `Prepared launch batch ${batchNumber}.`,
            metadata: { launchAttemptId: attemptId, batchNumber, preparedInBatch: recipients.length },
          },
        });
      }, { timeout: 15_000, maxWait: 5_000 });
      return;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || collisionAttempt === 2) throw error;
      for (const item of prepared) item.credentials = createReferralCredentials();
    }
  }
}

export async function processReferralLaunch(campaignId: string, attemptId: string) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
    include: { approvedRevision: true },
  });
  if (!campaign?.approvedRevision || campaign.status !== "LAUNCHING" || campaign.launchAttemptId !== attemptId) {
    launchLog("stale_attempt_ignored", {
      campaignId,
      launchAttemptId: attemptId,
      expectedCount: campaign?.expectedAdvocateCount ?? 0,
      preparedCount: campaign?.preparedAdvocateCount ?? 0,
    });
    return null;
  }
  const processingStartedAt = new Date();
  const ownsAttempt = await prisma.$transaction(async tx => {
    const acquired = await tx.referralCampaign.updateMany({
      where: {
        id: campaignId,
        status: "LAUNCHING",
        launchAttemptId: attemptId,
        launchFailedAt: null,
        OR: [
          { launchLeaseExpiresAt: null },
          { launchLeaseExpiresAt: { lt: processingStartedAt } },
        ],
      },
      data: { launchLeaseExpiresAt: new Date(processingStartedAt.getTime() + LEASE_MS) },
    });
    if (acquired.count !== 1) return false;
    await tx.referralAuditEvent.create({
      data: {
        campaignId,
        actorId: campaign.launchingAdminId,
        action: "CAMPAIGN_LAUNCH_PROCESSOR_STARTED",
        summary: "Started secure campaign preparation.",
        metadata: {
          launchAttemptId: attemptId,
          expectedAdvocateCount: campaign.expectedAdvocateCount,
        },
      },
    });
    return true;
  });
  if (!ownsAttempt) {
    launchLog("stale_attempt_ignored", {
      campaignId,
      launchAttemptId: attemptId,
      expectedCount: campaign.expectedAdvocateCount ?? 0,
      preparedCount: campaign.preparedAdvocateCount,
    });
    return null;
  }
  launchLog("processor_started", {
    campaignId,
    launchAttemptId: attemptId,
    expectedCount: campaign.expectedAdvocateCount ?? 0,
    preparedCount: campaign.preparedAdvocateCount,
  });
  const snapshot = campaign.approvedRevision.snapshot as ApprovedSnapshot;
  const audience = snapshot.audience?.eligible ?? [];
  const plan = launchPlan(snapshot, campaign);
  const existing = await prisma.referralInvitation.findMany({
    where: { campaignId, approvedRevisionId: campaign.approvedRevisionId, status: { not: "CANCELLED" } },
    select: { advocate: { select: { clientId: true } } },
  });
  const missing = missingReferralRecipients(audience, existing.map(item => item.advocate.clientId));

  try {
    const batches = referralLaunchBatches(missing);
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const latest = await prisma.referralCampaign.findUnique({
        where: { id: campaignId }, select: { status: true, launchAttemptId: true },
      });
      if (latest?.status !== "LAUNCHING" || latest.launchAttemptId !== attemptId) throw new Error("Launch ownership changed.");
      const batchNumber = campaign.launchBatch + batchIndex + 1;
      launchLog("batch_started", {
        campaignId,
        launchAttemptId: attemptId,
        batchNumber,
        expectedCount: audience.length,
        preparedCount: campaign.preparedAdvocateCount,
      });
      await prepareBatch(campaign, snapshot, batches[batchIndex], batchNumber, attemptId, plan);
      const [advocates, invitations, communications] = await Promise.all([
        prisma.referralAdvocate.count({ where: { campaignId } }),
        prisma.referralInvitation.count({ where: { campaignId, approvedRevisionId: campaign.approvedRevisionId, status: { not: "CANCELLED" } } }),
        prisma.referralCommunication.count({ where: { campaignId, status: { not: "CANCELLED" }, invitation: { approvedRevisionId: campaign.approvedRevisionId } } }),
      ]);
      await prisma.referralCampaign.updateMany({
        where: { id: campaignId, status: "LAUNCHING", launchAttemptId: attemptId },
        data: {
          preparedAdvocateCount: advocates, preparedInvitationCount: invitations,
          preparedCommunicationCount: communications, launchBatch: batchNumber,
          launchLeaseExpiresAt: new Date(Date.now() + LEASE_MS),
        },
      });
      launchLog("batch_completed", {
        campaignId,
        launchAttemptId: attemptId,
        batchNumber,
        expectedCount: audience.length,
        preparedCount: advocates,
      });
    }

    const [invitations, communications] = await Promise.all([
      prisma.referralInvitation.count({ where: { campaignId, approvedRevisionId: campaign.approvedRevisionId, status: { not: "CANCELLED" } } }),
      prisma.referralCommunication.count({ where: { campaignId, status: { not: "CANCELLED" }, invitation: { approvedRevisionId: campaign.approvedRevisionId } } }),
    ]);
    if (!referralLaunchIsComplete({
      expectedAdvocates: audience.length, preparedInvitations: invitations,
      preparedCommunications: communications, followUpCount: plan.followUpCount,
    })) {
      throw new Error("Launch verification found incomplete recipient preparation.");
    }
    const completedAt = new Date();
    await prisma.$transaction(async tx => {
      const completed = await tx.referralCampaign.updateMany({
        where: { id: campaignId, status: "LAUNCHING", launchAttemptId: attemptId, approvedRevisionId: campaign.approvedRevisionId },
        data: {
          status: "ACTIVE", activatedAt: completedAt, launchCompletedAt: completedAt,
          launchLeaseExpiresAt: null, launchFailedAt: null, lastLaunchError: null,
          preparedAdvocateCount: audience.length, preparedInvitationCount: invitations,
          preparedCommunicationCount: communications,
        },
      });
      if (completed.count !== 1) throw new ReferralLaunchConflictError("Campaign launch ownership changed before completion.");
      await tx.referralAuditEvent.create({
        data: {
          campaignId, actorId: campaign.launchingAdminId, action: "CAMPAIGN_LAUNCH_COMPLETED",
          summary: `Launched campaign for ${audience.length} advocates.`,
          metadata: { launchAttemptId: attemptId, advocateCount: audience.length, communicationCount: communications, previousStatus: "LAUNCHING", newStatus: "ACTIVE" },
        },
      });
    });
    launchLog("completed", {
      campaignId,
      launchAttemptId: attemptId,
      expectedCount: audience.length,
      preparedCount: audience.length,
    });
    return { advocateCount: audience.length, communicationCount: communications };
  } catch (error) {
    const category = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "LAUNCH_PREPARATION_FAILED";
    const [advocates, invitations, communications] = await Promise.all([
      prisma.referralAdvocate.count({ where: { campaignId } }),
      prisma.referralInvitation.count({ where: { campaignId, approvedRevisionId: campaign.approvedRevisionId, status: { not: "CANCELLED" } } }),
      prisma.referralCommunication.count({ where: { campaignId, status: { not: "CANCELLED" }, invitation: { approvedRevisionId: campaign.approvedRevisionId } } }),
    ]);
    await prisma.$transaction(async tx => {
      const failed = await tx.referralCampaign.updateMany({
        where: { id: campaignId, status: "LAUNCHING", launchAttemptId: attemptId },
        data: {
          launchFailedAt: new Date(), launchLeaseExpiresAt: null,
          preparedAdvocateCount: advocates,
          preparedInvitationCount: invitations,
          preparedCommunicationCount: communications,
          lastLaunchError: "Campaign preparation stopped before completion. Retry Safely will continue from the existing prepared records.",
        },
      });
      if (failed.count !== 1) return;
      await tx.referralAuditEvent.create({
        data: {
          campaignId, actorId: campaign.launchingAdminId, action: "CAMPAIGN_LAUNCH_FAILED",
          summary: "Campaign preparation stopped before completion.",
          metadata: { launchAttemptId: attemptId, sanitizedErrorCategory: category },
        },
      });
    });
    launchLog("processor_failed", {
      campaignId,
      launchAttemptId: attemptId,
      expectedCount: audience.length,
      preparedCount: advocates,
      errorCategory: category,
    });
    throw error;
  }
}

export async function processPendingReferralLaunches(limit = 2) {
  const now = new Date();
  const recentLaunchCutoff = new Date(now.getTime() - REFERRAL_STALE_LAUNCH_MS);
  const candidates = await prisma.referralCampaign.findMany({
    where: {
      status: "LAUNCHING", launchFailedAt: null,
      launchStartedAt: { gte: recentLaunchCutoff },
      OR: [{ launchLeaseExpiresAt: null }, { launchLeaseExpiresAt: { lt: now } }],
    },
    orderBy: { launchStartedAt: "asc" },
    take: limit,
    select: { id: true, launchAttemptId: true, launchStartedAt: true },
  });
  const results = [];
  for (const candidate of candidates) {
    if (!candidate.launchAttemptId) continue;
    if (candidate.launchStartedAt && Date.now() - candidate.launchStartedAt.getTime() > LEASE_MS) {
      await prisma.referralAuditEvent.create({
        data: {
          campaignId: candidate.id, action: "CAMPAIGN_LAUNCH_RESUMED",
          summary: "Resumed an interrupted campaign launch.",
          metadata: { launchAttemptId: candidate.launchAttemptId },
        },
      });
    }
    try {
      results.push({ campaignId: candidate.id, success: true, result: await processReferralLaunch(candidate.id, candidate.launchAttemptId) });
    } catch {
      results.push({ campaignId: candidate.id, success: false });
    }
  }
  return results;
}

export async function stopReferralCampaignPreparation(
  campaignId: string,
  actor: LaunchActor,
  returnToApproved: boolean,
) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true, internalName: true, status: true, approvedRevisionId: true,
      launchAttemptId: true, preparedCommunicationCount: true,
    },
  });
  if (!campaign || campaign.status !== "LAUNCHING" || !campaign.approvedRevisionId) {
    throw new Error("Only a campaign currently being prepared can be stopped.");
  }
  const sentCount = await prisma.referralCommunication.count({
    where: { campaignId, status: "SENT" },
  });
  const mode = referralRecoveryMode({
    status: campaign.status,
    sentCount,
    preparedCommunicationCount: campaign.preparedCommunicationCount,
  });
  if (mode === "PARTIAL_DELIVERY") {
    throw new Error("This campaign has already sent communications. Pause or cancel it; it cannot return to Approved.");
  }
  const status = returnToApproved ? "APPROVED" : "CANCELLED";
  await prisma.$transaction(async tx => {
    const stopped = await tx.referralCampaign.updateMany({
      where: {
        id: campaignId,
        status: "LAUNCHING",
        launchAttemptId: campaign.launchAttemptId,
      },
      data: {
        status,
        launchAttemptId: null,
        launchLeaseExpiresAt: null,
        launchFailedAt: new Date(),
        lastLaunchError: returnToApproved
          ? "Preparation was stopped by an administrator before delivery. Fresh confirmation is required."
          : "Campaign was cancelled by an administrator before delivery.",
      },
    });
    if (stopped.count !== 1) throw new ReferralLaunchConflictError("Campaign state changed. Refresh before trying again.");
    await tx.referralCommunication.updateMany({
      where: { campaignId, status: { in: ["DRAFT", "APPROVED", "SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED", failureCode: "PREPARATION_STOPPED" },
    });
    await tx.referralInvitation.updateMany({
      where: { campaignId, status: { in: ["DRAFT", "APPROVED", "SCHEDULED", "SENDING"] } },
      data: { status: "CANCELLED" },
    });
    await tx.referralAuditEvent.create({
      data: {
        campaignId, actorId: actor.userId,
        action: returnToApproved ? "CAMPAIGN_PREPARATION_RETURNED_TO_APPROVED" : "CAMPAIGN_PREPARATION_CANCELLED",
        summary: returnToApproved
          ? "Stopped preparation before delivery and returned the approved snapshot for fresh confirmation."
          : "Stopped preparation before delivery and cancelled the campaign.",
        metadata: { recoveryMode: mode, sentCount: 0, previousStatus: "LAUNCHING", newStatus: status },
      },
    });
  });
  await recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    action: returnToApproved ? "REFERRAL_PREPARATION_RETURNED_TO_APPROVED" : "REFERRAL_PREPARATION_CANCELLED",
    entityType: "ReferralCampaign",
    entityId: campaignId,
    summary: `${returnToApproved ? "Stopped preparation for" : "Cancelled"} referral campaign "${campaign.internalName}" before delivery.`,
  });
  return { status, recoveryMode: mode, sentCount };
}
