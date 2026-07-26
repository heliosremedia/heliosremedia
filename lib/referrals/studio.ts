import "server-only";

import { createHash } from "node:crypto";
import type { Prisma, ReferralAudienceMode, ReferralCampaignStatus, ReferralRewardStatus, ReferralRewardType, ReferralStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { getSiteUrl } from "@/lib/site";
import { resolveAudience } from "./audience";
import { createReferralCredentials } from "./tokens";
import { assertReferralTransition, campaignDraftUpdateIssue, mayArchiveReferralCampaign, mayPermanentlyDeleteReferralCampaign, mayReturnReferralCampaignToDraft } from "./state-machine";
import { personalizeReferralCopy, renderReferralInvitationEmail } from "./email-renderer";
import { generatePreferenceToken, hashPreferenceToken, MARKETING_TOKEN_TTL_DAYS } from "@/lib/client-communications/preferences";

export type CampaignInput = {
  internalName: string;
  publicTitle: string;
  purpose: string;
  audienceMode: ReferralAudienceMode;
  groupIds: string[];
  clientIds: string[];
  excludedClientIds: string[];
  filters: { updatedWithinDays?: number | null };
  referralOffer?: string;
  advocateReward?: string;
  referredCustomerOffer?: string;
  eligibilityRules?: string;
  qualificationRules?: string;
  rewardInstructions?: string;
  maxRewardsPerAdvocate?: number | null;
  terms: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  landingHeadline: string;
  landingBody: string;
  landingThankYou: string;
  privacyNotice: string;
  invitationSubject: string;
  invitationPreviewText?: string;
  invitationBody: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  referralExpirationDays: number;
  followUpConfiguration: Prisma.InputJsonValue;
  communicationTemplates: Prisma.InputJsonValue;
};

export class ReferralCampaignConflictError extends Error {
  constructor() {
    super("This campaign was updated in another tab. Reload the latest draft before saving again.");
    this.name = "ReferralCampaignConflictError";
  }
}

export async function referralDashboardData(from: Date, to: Date) {
  const [campaigns, submissions, invitationCounts, rewards, clients, groups, linkVisits] = await Promise.all([
    prisma.referralCampaign.findMany({
      where: { createdAt: { lte: to }, updatedAt: { gte: from } },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { advocates: true, invitations: true, submissions: true } } },
      take: 100,
    }),
    prisma.referralSubmission.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: { select: { publicTitle: true } },
        advocate: { include: { client: { select: { displayName: true } } } },
      },
      take: 100,
    }),
    prisma.referralInvitation.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.referralReward.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lte: to } },
      _count: true,
    }),
    prisma.communicationClient.count(),
    prisma.communicationGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.referralLink.aggregate({ where: { lastVisitedAt: { gte: from, lte: to } }, _sum: { visitCount: true } }),
  ]);
  const statusCount = (status: ReferralStatus) => submissions.filter(item => item.status === status).length;
  const sent = invitationCounts.find(item => item.status === "SENT")?._count ?? 0;
  const completed = statusCount("COMPLETED") + statusCount("REWARD_ELIGIBLE") + statusCount("REWARD_ISSUED");
  return {
    campaigns,
    submissions,
    groups,
    clientCount: clients,
    metrics: {
      active: campaigns.filter(item => item.status === "ACTIVE").length,
      draft: campaigns.filter(item => item.status === "DRAFT").length,
      paused: campaigns.filter(item => item.status === "PAUSED").length,
      invitationsSent: sent,
      visits: linkVisits._sum.visitCount ?? 0,
      submissions: submissions.length,
      qualified: statusCount("QUALIFIED"),
      booked: statusCount("BOOKED"),
      completed,
      pendingRewards: rewards.filter(item => ["PENDING_REVIEW", "ELIGIBLE", "APPROVED"].includes(item.status)).reduce((sum, item) => sum + item._count, 0),
      issuedRewards: rewards.find(item => item.status === "ISSUED")?._count ?? 0,
      conversionRate: sent ? Math.round((completed / sent) * 1000) / 10 : 0,
    },
  };
}

async function audienceCandidates(groupIds: string[], clientIds: string[], mode: ReferralAudienceMode, filters?: { updatedWithinDays?: number | null }) {
  const updatedSince = mode === "FILTERED" && filters?.updatedWithinDays
    ? new Date(Date.now() - filters.updatedWithinDays * 86_400_000)
    : null;
  return prisma.communicationClient.findMany({
    where: mode === "ALL_ELIGIBLE" ? {} : mode === "FILTERED" ? {
      updatedAt: updatedSince ? { gte: updatedSince } : undefined,
    } : {
      OR: [
        { id: { in: clientIds } },
        { groupMemberships: { some: { groupId: { in: groupIds } } } },
      ],
    },
    include: {
      newsletterSuppressions: { where: { releasedAt: null }, select: { id: true } },
      groupMemberships: { include: { group: { select: { id: true, name: true } } } },
    },
    orderBy: { displayName: "asc" },
  });
}

export async function estimateReferralAudience(input: {
  mode: ReferralAudienceMode;
  groupIds: string[];
  clientIds: string[];
  excludedClientIds: string[];
  filters?: { updatedWithinDays?: number | null };
}) {
  if (input.mode === "FILTERED" && !input.filters?.updatedWithinDays) {
    throw new Error("Choose at least one dynamic audience filter.");
  }
  const candidates = await audienceCandidates(input.groupIds, input.clientIds, input.mode, input.filters);
  const groupClientIds = candidates
    .filter(client => client.groupMemberships.some(membership => input.groupIds.includes(membership.groupId)))
    .map(client => client.id);
  const resolved = resolveAudience(candidates.map(client => ({
    ...client,
    suppressed: client.newsletterSuppressions.length > 0,
  })), {
    mode: input.mode,
    selectedClientIds: input.clientIds,
    selectedGroupClientIds: groupClientIds,
    excludedClientIds: input.excludedClientIds,
  });
  return {
    eligible: resolved.eligible.map(client => ({
      id: client.id,
      displayName: candidates.find(candidate => candidate.id === client.id)?.displayName ?? "",
      firstName: candidates.find(candidate => candidate.id === client.id)?.firstName ?? "",
      email: candidates.find(candidate => candidate.id === client.id)?.email ?? "",
    })),
    excluded: resolved.excluded.map(item => ({
      id: item.client.id,
      displayName: candidates.find(candidate => candidate.id === item.client.id)?.displayName ?? "",
      reasons: item.reasons,
    })),
  };
}

function campaignData(input: CampaignInput) {
  return {
    internalName: input.internalName,
    publicTitle: input.publicTitle,
    purpose: input.purpose,
    audienceMode: input.audienceMode,
    audienceRules: {
      groupIds: input.groupIds,
      clientIds: input.clientIds,
      excludedClientIds: input.excludedClientIds,
      filters: input.filters,
    },
    referralOffer: input.referralOffer || null,
    advocateReward: input.advocateReward || null,
    referredCustomerOffer: input.referredCustomerOffer || null,
    eligibilityRules: input.eligibilityRules || null,
    qualificationRules: input.qualificationRules || null,
    rewardInstructions: input.rewardInstructions || null,
    maxRewardsPerAdvocate: input.maxRewardsPerAdvocate ?? null,
    terms: input.terms,
    senderName: input.senderName || null,
    senderEmail: input.senderEmail || null,
    replyTo: input.replyTo || null,
    landingHeadline: input.landingHeadline,
    landingBody: input.landingBody,
    landingThankYou: input.landingThankYou,
    privacyNotice: input.privacyNotice,
    invitationSubject: input.invitationSubject,
    invitationPreviewText: input.invitationPreviewText || null,
    invitationBody: input.invitationBody,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    referralExpirationDays: input.referralExpirationDays,
    followUpConfiguration: input.followUpConfiguration,
    communicationTemplates: input.communicationTemplates,
  };
}

export async function createReferralCampaign(input: CampaignInput, actor: { userId: string; email: string }) {
  await estimateReferralAudience({
    mode: input.audienceMode, groupIds: input.groupIds, clientIds: input.clientIds,
    excludedClientIds: input.excludedClientIds, filters: input.filters,
  });
  const campaign = await prisma.$transaction(async tx => {
    const created = await tx.referralCampaign.create({
      data: { ...campaignData(input), createdById: actor.userId },
    });
    const audienceRows = [
      ...input.groupIds.map(groupId => ({ campaignId: created.id, groupId, excluded: false })),
      ...input.clientIds.map(clientId => ({ campaignId: created.id, clientId, excluded: false })),
      ...input.excludedClientIds.map(clientId => ({ campaignId: created.id, clientId, excluded: true })),
    ];
    if (audienceRows.length) await tx.referralCampaignAudience.createMany({ data: audienceRows });
    await tx.referralAuditEvent.create({
      data: { campaignId: created.id, actorId: actor.userId, action: "CAMPAIGN_CREATED", summary: `Created referral campaign "${created.internalName}".` },
    });
    return created;
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_CREATED",
    entityType: "ReferralCampaign", entityId: campaign.id, summary: `Created referral campaign "${campaign.internalName}".`,
  });
  return campaign;
}

export async function updateReferralCampaignDraft(
  id: string,
  input: CampaignInput,
  expectedRowVersion: number,
  actor: { userId: string; email: string },
) {
  await estimateReferralAudience({
    mode: input.audienceMode, groupIds: input.groupIds, clientIds: input.clientIds,
    excludedClientIds: input.excludedClientIds, filters: input.filters,
  });
  const before = await prisma.referralCampaign.findUnique({
    where: { id },
    select: { id: true, internalName: true, status: true, rowVersion: true },
  });
  if (!before) throw new Error("Campaign not found.");
  const updateIssue = campaignDraftUpdateIssue(before.status, before.rowVersion, expectedRowVersion);
  if (updateIssue === "STATUS") throw new Error("Only draft campaigns can be edited.");
  if (updateIssue === "STALE") throw new ReferralCampaignConflictError();

  const data = campaignData(input);
  const snapshot = JSON.parse(JSON.stringify({ campaign: data, audience: data.audienceRules })) as Prisma.InputJsonValue;
  const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.referralCampaign.updateMany({
      where: { id, status: "DRAFT", rowVersion: expectedRowVersion },
      data: { ...data, approvedRevisionId: null, rowVersion: { increment: 1 } },
    });
    if (result.count !== 1) throw new ReferralCampaignConflictError();
    await tx.referralCampaignAudience.deleteMany({ where: { campaignId: id } });
    const audienceRows = [
      ...input.groupIds.map(groupId => ({ campaignId: id, groupId, excluded: false })),
      ...input.clientIds.map(clientId => ({ campaignId: id, clientId, excluded: false })),
      ...input.excludedClientIds.map(clientId => ({ campaignId: id, clientId, excluded: true })),
    ];
    if (audienceRows.length) await tx.referralCampaignAudience.createMany({ data: audienceRows });
    const latest = await tx.referralCampaignRevision.findFirst({
      where: { campaignId: id },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });
    const revision = await tx.referralCampaignRevision.create({
      data: {
        campaignId: id,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        snapshot,
        contentHash,
      },
    });
    await tx.referralAuditEvent.create({
      data: {
        campaignId: id,
        actorId: actor.userId,
        action: "CAMPAIGN_EDITED",
        summary: `Saved draft revision ${revision.revisionNumber}.`,
        metadata: {
          previousVersion: expectedRowVersion,
          newVersion: expectedRowVersion + 1,
          previousRevision: latest?.revisionNumber ?? null,
          newRevision: revision.revisionNumber,
          statusBefore: before.status,
          statusAfter: "DRAFT",
        },
      },
    });
    return tx.referralCampaign.findUniqueOrThrow({ where: { id } });
  });
  await recordAuditEvent({
    actorId: actor.userId,
    actorEmail: actor.email,
    action: "REFERRAL_CAMPAIGN_EDITED",
    entityType: "ReferralCampaign",
    entityId: id,
    summary: `Edited referral campaign "${updated.internalName}".`,
    metadata: { previousVersion: expectedRowVersion, newVersion: updated.rowVersion, statusBefore: before.status, statusAfter: updated.status },
  });
  return updated;
}

export async function updateCampaignStatus(id: string, action: "pause" | "resume" | "cancel", actor: { userId: string; email: string }) {
  const campaign = await prisma.referralCampaign.findUnique({ where: { id }, select: { status: true, internalName: true } });
  if (!campaign) throw new Error("Campaign not found.");
  let status: ReferralCampaignStatus;
  if (action === "pause") {
    if (campaign.status !== "ACTIVE") throw new Error("Only an active campaign can be paused.");
    status = "PAUSED";
  } else if (action === "resume") {
    if (campaign.status !== "PAUSED") throw new Error("Only a paused campaign can be resumed.");
    status = "ACTIVE";
  } else {
    if (["COMPLETED", "CANCELLED"].includes(campaign.status)) throw new Error("This campaign cannot be cancelled.");
    status = "CANCELLED";
  }
  await prisma.$transaction([
    prisma.referralCampaign.update({
      where: { id },
      data: { status, pausedAt: status === "PAUSED" ? new Date() : null },
    }),
    prisma.referralCommunication.updateMany({
      where: { campaignId: id, status: status === "CANCELLED" ? { in: ["DRAFT", "APPROVED", "SCHEDULED", "SENDING"] } : "SENDING" },
      data: { status: status === "CANCELLED" ? "CANCELLED" : "SCHEDULED", failureCode: status === "CANCELLED" ? "CAMPAIGN_CANCELLED" : null },
    }),
    prisma.referralInvitation.updateMany({
      where: { campaignId: id, status: status === "CANCELLED" ? { in: ["DRAFT", "APPROVED", "SCHEDULED", "SENDING"] } : "SENDING" },
      data: { status: status === "CANCELLED" ? "CANCELLED" : "SCHEDULED" },
    }),
    prisma.referralAuditEvent.create({
      data: { campaignId: id, actorId: actor.userId, action: `CAMPAIGN_${status}`, summary: `${status === "PAUSED" ? "Paused" : status === "ACTIVE" ? "Resumed" : "Cancelled"} referral campaign.` },
    }),
  ]);
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: `REFERRAL_CAMPAIGN_${status}`,
    entityType: "ReferralCampaign", entityId: id, summary: `${status === "PAUSED" ? "Paused" : status === "ACTIVE" ? "Resumed" : "Cancelled"} referral campaign "${campaign.internalName}".`,
  });
  return status;
}

export async function returnReferralCampaignToDraft(
  id: string,
  expectedRowVersion: number,
  actor: { userId: string; email: string },
  openedForEditing = false,
) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id },
    select: { internalName: true, status: true, rowVersion: true, approvedRevisionId: true },
  });
  if (!campaign) throw new Error("Campaign not found.");
  if (!mayReturnReferralCampaignToDraft(campaign.status)) throw new Error("Only an approved campaign can be returned to Draft.");
  if (campaign.rowVersion !== expectedRowVersion) throw new ReferralCampaignConflictError();
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.referralCampaign.updateMany({
      where: { id, status: "APPROVED", rowVersion: expectedRowVersion },
      data: { status: "DRAFT", approvedRevisionId: null, rowVersion: { increment: 1 } },
    });
    if (result.count !== 1) throw new ReferralCampaignConflictError();
    await tx.referralAuditEvent.create({
      data: {
        campaignId: id,
        actorId: actor.userId,
        action: "CAMPAIGN_RETURNED_TO_DRAFT",
        summary: "Returned approved campaign to Draft. Reapproval is required before launch.",
        metadata: {
          previousStatus: campaign.status,
          newStatus: "DRAFT",
          previousApprovedRevisionId: campaign.approvedRevisionId,
          previousVersion: expectedRowVersion,
          newVersion: expectedRowVersion + 1,
        },
      },
    });
    if (openedForEditing) {
      await tx.referralAuditEvent.create({
        data: {
          campaignId: id,
          actorId: actor.userId,
          action: "APPROVED_CAMPAIGN_OPENED_FOR_EDITING",
          summary: "Approved campaign was returned to Draft and opened for editing.",
        },
      });
    }
    return tx.referralCampaign.findUniqueOrThrow({ where: { id } });
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_RETURNED_TO_DRAFT",
    entityType: "ReferralCampaign", entityId: id,
    summary: `Returned referral campaign "${campaign.internalName}" to Draft.`,
    metadata: { previousApprovedRevisionId: campaign.approvedRevisionId },
  });
  return updated;
}

export async function referralCampaignRemovalEligibility(id: string) {
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id },
    select: {
      status: true,
      _count: { select: { invitations: true, submissions: true, advocates: true, communications: true, links: true } },
      submissions: { select: { _count: { select: { rewards: true } } }, take: 1 },
    },
  });
  if (!campaign) throw new Error("Campaign not found.");
  const counts = campaign._count;
  const hasActivity = counts.invitations > 0 || counts.submissions > 0 || counts.advocates > 0
    || counts.communications > 0 || counts.links > 0 || campaign.submissions.some(item => item._count.rewards > 0);
  return {
    status: campaign.status,
    hasActivity,
    canDelete: mayPermanentlyDeleteReferralCampaign(campaign.status, hasActivity),
    canArchive: mayArchiveReferralCampaign(campaign.status),
  };
}

export async function deleteReferralCampaign(id: string, actor: { userId: string; email: string }) {
  const campaign = await prisma.referralCampaign.findUnique({ where: { id }, select: { internalName: true, status: true } });
  if (!campaign) throw new Error("Campaign not found.");
  const eligibility = await referralCampaignRemovalEligibility(id);
  if (!eligibility.canDelete) {
    throw new Error(eligibility.hasActivity
      ? "This campaign has production activity and cannot be permanently deleted. Archive it instead."
      : "Only Draft or Approved campaigns can be permanently deleted.");
  }
  await prisma.$transaction(async tx => {
    await tx.referralCampaign.update({ where: { id }, data: { approvedRevisionId: null } });
    await tx.referralCampaign.delete({ where: { id } });
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_DELETED",
    entityType: "ReferralCampaign", entityId: id,
    summary: `Permanently deleted referral campaign "${campaign.internalName}".`,
    metadata: { previousStatus: campaign.status },
  });
}

export async function archiveReferralCampaign(id: string, actor: { userId: string; email: string }) {
  const campaign = await prisma.referralCampaign.findUnique({ where: { id }, select: { internalName: true, status: true } });
  if (!campaign) throw new Error("Campaign not found.");
  if (!mayArchiveReferralCampaign(campaign.status)) throw new Error("This campaign cannot be archived.");
  await prisma.$transaction([
    prisma.referralCampaign.update({
      where: { id },
      data: { status: "ARCHIVED", approvedRevisionId: null, rowVersion: { increment: 1 } },
    }),
    prisma.referralAuditEvent.create({
      data: {
        campaignId: id, actorId: actor.userId, action: "CAMPAIGN_ARCHIVED",
        summary: `Archived campaign from ${campaign.status}.`,
        metadata: { previousStatus: campaign.status, newStatus: "ARCHIVED" },
      },
    }),
  ]);
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_ARCHIVED",
    entityType: "ReferralCampaign", entityId: id, summary: `Archived referral campaign "${campaign.internalName}".`,
    metadata: { previousStatus: campaign.status },
  });
}

function approvalSnapshot(campaign: Awaited<ReturnType<typeof loadCampaignForApproval>>, audience: Awaited<ReturnType<typeof estimateReferralAudience>>) {
  return {
    campaign: {
      internalName: campaign.internalName, publicTitle: campaign.publicTitle, purpose: campaign.purpose,
      referralOffer: campaign.referralOffer, advocateReward: campaign.advocateReward,
      referredCustomerOffer: campaign.referredCustomerOffer, eligibilityRules: campaign.eligibilityRules,
      qualificationRules: campaign.qualificationRules, maxRewardsPerAdvocate: campaign.maxRewardsPerAdvocate,
      terms: campaign.terms, senderName: campaign.senderName, senderEmail: campaign.senderEmail,
      replyTo: campaign.replyTo, landingHeadline: campaign.landingHeadline, landingBody: campaign.landingBody,
      landingThankYou: campaign.landingThankYou, privacyNotice: campaign.privacyNotice,
      invitationSubject: campaign.invitationSubject, invitationPreviewText: campaign.invitationPreviewText,
      invitationBody: campaign.invitationBody, startsAt: campaign.startsAt?.toISOString() ?? null,
      endsAt: campaign.endsAt?.toISOString() ?? null, referralExpirationDays: campaign.referralExpirationDays,
      followUpConfiguration: campaign.followUpConfiguration, communicationTemplates: campaign.communicationTemplates,
    },
    audience,
  };
}

async function loadCampaignForApproval(id: string) {
  const campaign = await prisma.referralCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error("Campaign not found.");
  return campaign;
}

export async function approveReferralCampaign(id: string, actor: { userId: string; email: string }) {
  const campaign = await loadCampaignForApproval(id);
  if (campaign.status !== "DRAFT" && campaign.status !== "APPROVED") throw new Error("Only a draft campaign can be approved.");
  const rules = campaign.audienceRules as { groupIds?: string[]; clientIds?: string[]; excludedClientIds?: string[]; filters?: { updatedWithinDays?: number | null } };
  const audience = await estimateReferralAudience({
    mode: campaign.audienceMode,
    groupIds: rules.groupIds ?? [],
    clientIds: rules.clientIds ?? [],
    excludedClientIds: rules.excludedClientIds ?? [],
    filters: rules.filters,
  });
  if (!audience.eligible.length) throw new Error("No eligible advocates are selected.");
  const snapshot = approvalSnapshot(campaign, audience);
  const contentHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const approved = await prisma.$transaction(async tx => {
    const latest = await tx.referralCampaignRevision.findFirst({ where: { campaignId: id }, orderBy: { revisionNumber: "desc" } });
    const revision = await tx.referralCampaignRevision.create({
      data: {
        campaignId: id, revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        snapshot, contentHash, approvedById: actor.userId, approvedAt: new Date(),
      },
    });
    await tx.referralCampaign.update({ where: { id }, data: { status: "APPROVED", approvedRevisionId: revision.id } });
    await tx.referralAuditEvent.create({
      data: { campaignId: id, actorId: actor.userId, action: "CAMPAIGN_APPROVED", summary: `Approved immutable revision ${revision.revisionNumber}.`, metadata: { eligible: audience.eligible.length, excluded: audience.excluded.length } },
    });
    return revision;
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_APPROVED",
    entityType: "ReferralCampaign", entityId: id, summary: `Approved referral campaign "${campaign.internalName}".`,
    metadata: { revisionId: approved.id, eligible: audience.eligible.length, excluded: audience.excluded.length },
  });
  return { revision: approved, audience };
}

export async function launchReferralCampaign(id: string, actor: { userId: string; email: string }) {
  const campaign = await prisma.referralCampaign.findUnique({ where: { id }, include: { approvedRevision: true } });
  if (!campaign?.approvedRevision || campaign.status !== "APPROVED") throw new Error("Approve the campaign before launch.");
  const snapshot = campaign.approvedRevision.snapshot as {
    audience?: { eligible?: Array<{ id: string; displayName: string; firstName: string; email: string }> };
    campaign?: {
      invitationSubject?: string;
      invitationPreviewText?: string | null;
      invitationBody?: string;
      followUpConfiguration?: { enabled?: boolean; count?: number; delayDays?: number };
      communicationTemplates?: { followUp?: string };
    };
  };
  const audience = snapshot.audience?.eligible ?? [];
  if (!audience.length) throw new Error("The approved campaign has no eligible advocates.");
  const scheduledAt = campaign.startsAt && campaign.startsAt > new Date() ? campaign.startsAt : new Date();
  await prisma.$transaction(async tx => {
    for (const recipient of audience) {
      const advocate = await tx.referralAdvocate.upsert({
        where: { campaignId_clientId: { campaignId: id, clientId: recipient.id } },
        create: { campaignId: id, clientId: recipient.id, includedAt: new Date() },
        update: { includedAt: new Date(), dismissedAt: null },
      });
      const invitation = await tx.referralInvitation.create({
        data: {
          campaignId: id, advocateId: advocate.id, status: "SCHEDULED",
          subject: snapshot.campaign?.invitationSubject ?? campaign.invitationSubject,
          previewText: snapshot.campaign?.invitationPreviewText ?? campaign.invitationPreviewText,
          body: snapshot.campaign?.invitationBody ?? campaign.invitationBody,
          approvedSnapshot: snapshot as Prisma.InputJsonValue,
          scheduledAt,
        },
      });
      let credentials = createReferralCredentials();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const exists = await tx.referralLink.findFirst({ where: { OR: [{ tokenHash: credentials.tokenHash }, { code: credentials.code }] } });
        if (!exists) break;
        credentials = createReferralCredentials();
      }
      await tx.referralLink.create({
        data: {
          invitationId: invitation.id, campaignId: id, advocateId: advocate.id,
          tokenHash: credentials.tokenHash, code: credentials.code,
          expiresAt: new Date(scheduledAt.getTime() + campaign.referralExpirationDays * 86_400_000),
        },
      });
      const referralUrl = `${getSiteUrl()}/refer/${encodeURIComponent(credentials.token)}`;
      const preference = await tx.marketingEmailPreference.upsert({
        where: { normalizedEmail: recipient.email.trim().toLowerCase() },
        create: { normalizedEmail: recipient.email.trim().toLowerCase(), status: "UNKNOWN", source: "REFERRAL_CAMPAIGN" },
        update: {},
      });
      const unsubscribeToken = generatePreferenceToken();
      await tx.marketingEmailPreferenceToken.create({
        data: {
          preferenceId: preference.id,
          tokenHash: hashPreferenceToken(unsubscribeToken),
          expiresAt: new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000),
          campaignId: id,
        },
      });
      const personalizedBody = personalizeReferralCopy(invitation.body, {
        firstName: recipient.firstName || recipient.displayName.split(/\s+/)[0] || "there",
        referralUrl,
        referralCode: credentials.code,
        campaignTitle: campaign.publicTitle,
      });
      await tx.referralCommunication.create({
        data: {
          campaignId: id, invitationId: invitation.id, kind: "INVITATION", status: "SCHEDULED",
          recipientEmail: recipient.email, recipientName: recipient.displayName,
          subject: personalizeReferralCopy(invitation.subject, {
            firstName: recipient.firstName || recipient.displayName.split(/\s+/)[0] || "there",
            referralUrl,
            referralCode: credentials.code,
            campaignTitle: campaign.publicTitle,
          }),
          htmlSnapshot: renderReferralInvitationEmail({
            body: personalizedBody,
            previewText: invitation.previewText,
            unsubscribeToken,
            referralUrl,
            referralCode: credentials.code,
            campaignTitle: campaign.publicTitle,
          }),
          contentHash: createHash("sha256").update(personalizedBody).digest("hex"),
          scheduledAt,
          idempotencyKey: `referral:${invitation.id}:invitation`,
        },
      });
      const followUp = snapshot.campaign?.followUpConfiguration;
      const followUpBody = snapshot.campaign?.communicationTemplates?.followUp?.trim();
      if (followUp?.enabled && followUpBody) {
        const count = Math.max(0, Math.min(3, Number(followUp.count) || 0));
        const delayDays = Math.max(2, Math.min(60, Number(followUp.delayDays) || 7));
        for (let followUpNumber = 1; followUpNumber <= count; followUpNumber += 1) {
          const body = personalizeReferralCopy(followUpBody, {
            firstName: recipient.firstName || recipient.displayName.split(/\s+/)[0] || "there",
            referralUrl,
            referralCode: credentials.code,
            campaignTitle: campaign.publicTitle,
          });
          await tx.referralCommunication.create({
            data: {
              campaignId: id,
              invitationId: invitation.id,
              kind: "FOLLOW_UP",
              status: "SCHEDULED",
              recipientEmail: recipient.email,
              recipientName: recipient.displayName,
              subject: `A gentle reminder: ${invitation.subject}`,
              htmlSnapshot: renderReferralInvitationEmail({
                body,
                previewText: invitation.previewText,
                unsubscribeToken,
                referralUrl,
                referralCode: credentials.code,
                campaignTitle: campaign.publicTitle,
              }),
              contentHash: createHash("sha256").update(body).digest("hex"),
              scheduledAt: new Date(scheduledAt.getTime() + delayDays * followUpNumber * 86_400_000),
              idempotencyKey: `referral:${invitation.id}:follow-up:${followUpNumber}`,
            },
          });
        }
      }
    }
    await tx.referralCampaign.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date() } });
    await tx.referralAuditEvent.create({
      data: { campaignId: id, actorId: actor.userId, action: "CAMPAIGN_LAUNCHED", summary: `Launched campaign for ${audience.length} advocates.`, metadata: { advocateCount: audience.length } },
    });
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_CAMPAIGN_LAUNCHED",
    entityType: "ReferralCampaign", entityId: id, summary: `Launched referral campaign "${campaign.internalName}" for ${audience.length} advocates.`,
  });
  return audience.length;
}

export async function transitionReferral(id: string, toStatus: ReferralStatus, reason: string, actor: { userId: string; email: string }) {
  const current = await prisma.referralSubmission.findUnique({ where: { id }, select: { status: true, campaignId: true, advocateId: true } });
  if (!current) throw new Error("Referral not found.");
  assertReferralTransition(current.status, toStatus);
  await prisma.$transaction(async tx => {
    await tx.referralSubmission.update({ where: { id }, data: { status: toStatus } });
    await tx.referralStatusEvent.create({
      data: { submissionId: id, fromStatus: current.status, toStatus, reason: reason || null, actorId: actor.userId },
    });
    await tx.referralAuditEvent.create({
      data: { campaignId: current.campaignId, submissionId: id, actorId: actor.userId, action: "REFERRAL_STATUS_CHANGED", summary: `Changed referral status from ${current.status} to ${toStatus}.`, metadata: { from: current.status, to: toStatus } },
    });
    if (toStatus === "REWARD_ELIGIBLE" && current.advocateId) {
      await tx.referralReward.upsert({
        where: { submissionId_advocateId: { submissionId: id, advocateId: current.advocateId } },
        create: {
          submissionId: id, advocateId: current.advocateId, type: "CUSTOM",
          status: "PENDING_REVIEW", eligibilityReason: reason || "Referral marked reward eligible.",
        },
        update: { status: "PENDING_REVIEW", eligibilityReason: reason || "Referral marked reward eligible." },
      });
    }
  });
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: "REFERRAL_STATUS_CHANGED",
    entityType: "ReferralSubmission", entityId: id, summary: `Changed referral status from ${current.status} to ${toStatus}.`,
  });
}

export async function updateReward(id: string, status: ReferralRewardStatus, input: {
  type?: ReferralRewardType;
  value?: string;
  notes?: string;
  externalReference?: string;
}, actor: { userId: string; email: string }) {
  const reward = await prisma.referralReward.findUnique({ where: { id }, include: { submission: true } });
  if (!reward) throw new Error("Reward not found.");
  if (reward.status === "ISSUED" && status === "ISSUED") throw new Error("This reward has already been issued.");
  const now = new Date();
  await prisma.$transaction([
    prisma.referralReward.update({
      where: { id },
      data: {
        status, type: input.type, value: input.value || null, fulfillmentNotes: input.notes || null,
        externalReference: input.externalReference || null,
        approvedById: status === "APPROVED" || status === "ISSUED" ? actor.userId : reward.approvedById,
        approvedAt: status === "APPROVED" || status === "ISSUED" ? reward.approvedAt ?? now : reward.approvedAt,
        issuedById: status === "ISSUED" ? actor.userId : null,
        issuedAt: status === "ISSUED" ? now : null,
      },
    }),
    prisma.referralAuditEvent.create({
      data: { campaignId: reward.submission.campaignId, submissionId: reward.submissionId, actorId: actor.userId, action: `REWARD_${status}`, summary: `Reward status changed to ${status}.` },
    }),
  ]);
  await recordAuditEvent({
    actorId: actor.userId, actorEmail: actor.email, action: `REFERRAL_REWARD_${status}`,
    entityType: "ReferralReward", entityId: id, summary: `Referral reward status changed to ${status}.`,
  });
}
