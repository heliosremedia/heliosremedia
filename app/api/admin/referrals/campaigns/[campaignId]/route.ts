import { after, NextResponse } from "next/server";
import type { ReferralAudienceMode } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { EmailDeliveryError, sendTestCampaign } from "@/lib/client-communications/email";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { renderReferralInvitationEmail } from "@/lib/referrals/email-renderer";
import { approveReferralCampaign, archiveReferralCampaign, deleteReferralCampaign, estimateReferralAudience, ReferralCampaignConflictError, referralCampaignRemovalEligibility, returnReferralCampaignToDraft, updateCampaignStatus, updateReferralCampaignDraft } from "@/lib/referrals/studio";
import { claimReferralCampaignLaunch, processReferralLaunch, ReferralLaunchConflictError, stopReferralCampaignPreparation } from "@/lib/referrals/launch";
import { referralLaunchIsStalled, referralRecoveryMode } from "@/lib/referrals/launch-contract";
import { email, integer, optionalDate, ReferralValidationError, stringArray, text } from "@/lib/referrals/validation";
import { createReferralTestPreview } from "@/lib/referrals/test-preview";
import { referralOperationalLabel, referralOperationalState, referralSequenceSummary } from "@/lib/referrals/operations";
import { cancelReferralCampaignSchedule, scheduleReferralCampaign } from "@/lib/referrals/scheduling";
import { getSiteUrl } from "@/lib/site";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";

const audienceModes = new Set<ReferralAudienceMode>(["INDIVIDUALS", "GROUPS", "FILTERED", "ALL_ELIGIBLE"]);

export const maxDuration = 300;

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = await prisma.referralCampaign.findFirst({
    where: { id: campaignId, createdBy: { workspaceId: session.workspaceId } },
    include: {
      audiences: { include: { group: true, client: true } },
      advocates: { include: { client: true, _count: { select: { submissions: true, rewards: true } } }, orderBy: { client: { displayName: "asc" } } },
      submissions: {
        include: { advocate: { include: { client: true } }, rewards: true },
        orderBy: { createdAt: "desc" },
      },
      revisions: { orderBy: { revisionNumber: "desc" }, take: 10 },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      _count: { select: { invitations: true, submissions: true } },
    },
  });
  if (!campaign) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
  const rules = campaign.audienceRules as { groupIds?: string[]; clientIds?: string[]; excludedClientIds?: string[]; filters?: { updatedWithinDays?: number | null } };
  const audienceEstimate = await estimateReferralAudience({
    mode: campaign.audienceMode,
    groupIds: rules.groupIds ?? [],
    clientIds: rules.clientIds ?? [],
    excludedClientIds: rules.excludedClientIds ?? [],
    filters: rules.filters,
  });
  const removalEligibility = await referralCampaignRemovalEligibility(campaignId);
  const now = new Date();
  const [
    communicationStates,
    invitationStates,
    communicationKindStates,
    lastProgress,
    nextCommunication,
    lastCronInvocation,
    dueScheduledCommunications,
    communicationDeliveryEvidence,
    invitationDeliveryEvidence,
    recentDiagnosticAudits,
  ] = await Promise.all([
    prisma.referralCommunication.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    }),
    prisma.referralInvitation.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    }),
    prisma.referralCommunication.groupBy({
      by: ["kind", "status"],
      where: { campaignId },
      _count: { _all: true },
    }),
    prisma.referralAuditEvent.findFirst({
      where: { campaignId, action: { in: ["CAMPAIGN_LAUNCH_BATCH_COMPLETED", "CAMPAIGN_LAUNCH_COMPLETED"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    campaign.scheduleConfirmedAt && campaign.deliveryScheduledAt && campaign.deliveryScheduledAt > new Date()
      ? prisma.referralCommunication.findFirst({
      where: { campaignId, status: "SCHEDULED", scheduledAt: { gte: campaign.deliveryScheduledAt } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true, kind: true },
    }) : Promise.resolve(null),
    prisma.referralCronInvocation.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true, startedAt: true, completedAt: true, authenticated: true,
        terminalResult: true, communicationsDue: true, communicationsClaimed: true,
        communicationsSkipped: true, providerSubmissionsAccepted: true,
        providerSubmissionsFailed: true,
      },
    }),
    prisma.referralCommunication.count({
      where: { campaignId, status: "SCHEDULED", scheduledAt: { lte: now } },
    }),
    prisma.referralCommunication.count({
      where: {
        campaignId,
        OR: [{ sentAt: { not: null } }, { providerMessageId: { not: null } }],
      },
    }),
    prisma.referralInvitation.count({
      where: {
        campaignId,
        OR: [{ sentAt: { not: null } }, { providerMessageId: { not: null } }],
      },
    }),
    prisma.referralAuditEvent.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { action: true, createdAt: true },
    }),
  ]);
  const communicationCounts = Object.fromEntries(
    communicationStates.map(item => [item.status, item._count._all]),
  ) as Record<string, number>;
  const sentCount = communicationCounts.SENT ?? 0;
  const invitationSentCount = await prisma.referralCommunication.count({
    where: { campaignId, kind: "INVITATION", status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED"] } },
  });
  const invitationStatusCounts = Object.fromEntries(
    invitationStates.map(item => [item.status, item._count._all]),
  ) as Record<string, number>;
  const communicationKindStatusCounts = communicationKindStates.map(item => ({
    kind: item.kind,
    status: item.status,
    count: item._count._all,
  }));
  const authorizationChecks = {
    campaignApprovedOrActive: ["APPROVED", "ACTIVE"].includes(campaign.status),
    scheduleConfirmed: Boolean(campaign.scheduleConfirmedAt),
    deliveryScheduled: Boolean(campaign.deliveryScheduledAt),
    deliveryDue: Boolean(campaign.deliveryScheduledAt && campaign.deliveryScheduledAt <= now),
    timezonePresent: Boolean(campaign.deliveryTimezone),
    approvedRevisionPresent: Boolean(campaign.approvedRevisionId),
    scheduledRevisionMatches: Boolean(
      campaign.approvedRevisionId
      && campaign.scheduledRevisionId === campaign.approvedRevisionId,
    ),
    scheduledAudiencePresent: (campaign.scheduledAudienceCount ?? 0) > 0,
    executionAuthorized: Boolean(campaign.executionAuthorizedAt),
  };
  const stalled = referralLaunchIsStalled({
    status: campaign.status,
    launchStartedAt: campaign.launchStartedAt,
    launchLeaseExpiresAt: campaign.launchLeaseExpiresAt,
    lastProgressAt: lastProgress?.createdAt,
    preparedAdvocateCount: campaign.preparedAdvocateCount,
  });
  const followUp = campaign.followUpConfiguration as { enabled?: boolean; count?: number; delayDays?: number };
  const sequence = referralSequenceSummary({
    advocateCount: campaign.expectedAdvocateCount ?? audienceEstimate.eligible.length,
    followUpEnabled: Boolean(followUp.enabled),
    followUpCount: Number(followUp.count) || 0,
  });
  const operationalState = referralOperationalState({
    status: campaign.status,
    scheduleConfirmedAt: campaign.scheduleConfirmedAt,
    deliveryScheduledAt: campaign.deliveryScheduledAt,
    sentCount: invitationSentCount,
    sendingCount: communicationCounts.SENDING ?? 0,
    stalled,
    timezone: campaign.deliveryTimezone,
    approvedRevisionId: campaign.approvedRevisionId,
    scheduledRevisionId: campaign.scheduledRevisionId,
    scheduledAudienceCount: campaign.scheduledAudienceCount,
    executionAuthorizedAt: campaign.executionAuthorizedAt,
  });
  return NextResponse.json({
    success: true,
    campaign: {
      ...campaign,
      audienceEstimate,
      removalEligibility,
      communicationCounts,
      sentCount,
      lastProgressAt: lastProgress?.createdAt ?? null,
      stalled,
      recoveryMode: referralRecoveryMode({
        status: campaign.status,
        sentCount,
        preparedCommunicationCount: campaign.preparedCommunicationCount,
      }),
      operationalState,
      operationalLabel: referralOperationalLabel(operationalState),
      invitationSentCount,
      nextScheduledAt: ["SCHEDULED", "DUE_QUEUED", "STALLED"].includes(operationalState)
        ? (campaign.deliveryScheduledAt ?? nextCommunication?.scheduledAt ?? null) : null,
      nextScheduledKind: nextCommunication?.kind ?? null,
      sequence,
      lastCronInvocation,
      deliveryDiagnostic: {
        generatedAt: now,
        readOnly: true,
        authorizationChecks,
        campaignStatus: campaign.status,
        scheduleVersion: campaign.scheduleVersion,
        scheduledAudienceCount: campaign.scheduledAudienceCount,
        invitationStatusCounts,
        communicationStatusCounts: communicationCounts,
        communicationKindStatusCounts,
        dueScheduledCommunications,
        communicationDeliveryEvidence,
        invitationDeliveryEvidence,
        recentAuditActions: recentDiagnosticAudits,
      },
      nextAction: operationalState === "APPROVED_NOT_SCHEDULED"
        ? "Review and schedule initial invitation"
        : operationalState === "SCHEDULED"
          ? "No action required"
          : operationalState === "DUE_QUEUED"
            ? "Waiting for the next scheduled worker poll"
          : operationalState === "STALLED"
            ? "Review safe recovery options"
            : "Monitor campaign activity",
    },
  });
}

export async function PUT(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { campaignId } = await context.params;
    const authorizedCampaign = await prisma.referralCampaign.findFirst({
      where: { id: campaignId, createdBy: { workspaceId: session.workspaceId } },
      select: { id: true },
    });
    if (!authorizedCampaign) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const mode = typeof body.audienceMode === "string" && audienceModes.has(body.audienceMode as ReferralAudienceMode)
      ? body.audienceMode as ReferralAudienceMode
      : null;
    if (!mode) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose a valid audience.");
    const groupIds = stringArray(body.groupIds);
    const clientIds = stringArray(body.clientIds);
    const excludedClientIds = stringArray(body.excludedClientIds);
    if (mode === "INDIVIDUALS" && !clientIds.length) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose at least one individual client.");
    if (mode === "GROUPS" && !groupIds.length) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose at least one client group.");
    const rowVersion = Number(body.rowVersion);
    if (!Number.isInteger(rowVersion) || rowVersion < 0) throw new ReferralValidationError("STALE_DRAFT", "Reload this campaign before saving.");
    const startsAt = optionalDate(body.startsAt);
    const endsAt = optionalDate(body.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) throw new ReferralValidationError("INVALID_DATES", "The end date must be after the start date.");
    const senderEmail = text(body.senderEmail, 320);
    const replyTo = text(body.replyTo, 320);
    if (senderEmail) email(senderEmail);
    if (replyTo) email(replyTo);
    const filters = { updatedWithinDays: body.filterUpdatedWithinDays ? integer(body.filterUpdatedWithinDays, 1, 3_650, 365) : null };
    const campaign = await updateReferralCampaignDraft(campaignId, {
      internalName: text(body.internalName, 160, { required: true }),
      publicTitle: text(body.publicTitle, 180, { required: true }),
      purpose: text(body.purpose, 2_000, { required: true }),
      audienceMode: mode, groupIds, clientIds, excludedClientIds, filters,
      referralOffer: text(body.referralOffer, 1_000),
      advocateReward: text(body.advocateReward, 1_000),
      referredCustomerOffer: text(body.referredCustomerOffer, 1_000),
      eligibilityRules: text(body.eligibilityRules, 4_000),
      qualificationRules: text(body.qualificationRules, 4_000),
      rewardInstructions: text(body.rewardInstructions, 4_000),
      maxRewardsPerAdvocate: body.maxRewardsPerAdvocate === "" ? null : integer(body.maxRewardsPerAdvocate, 1, 10_000, 1),
      terms: text(body.terms, 12_000, { required: true }),
      senderName: text(body.senderName, 160), senderEmail, replyTo,
      landingHeadline: text(body.landingHeadline, 240, { required: true }),
      landingBody: text(body.landingBody, 8_000, { required: true }),
      landingThankYou: text(body.landingThankYou, 1_000, { required: true }),
      privacyNotice: text(body.privacyNotice, 4_000, { required: true }),
      invitationSubject: text(body.invitationSubject, 180, { required: true }),
      invitationPreviewText: text(body.invitationPreviewText, 300),
      invitationBody: text(body.invitationBody, 12_000, { required: true }),
      startsAt, endsAt,
      referralExpirationDays: integer(body.referralExpirationDays, 1, 730, 90),
      followUpConfiguration: {
        enabled: body.followUpEnabled === true,
        count: integer(body.followUpCount, 0, 3, 1),
        delayDays: integer(body.followUpDelayDays, 2, 60, 7),
        stopAfterSubmission: true, stopAfterExpiration: true, stopAfterUnsubscribe: true, stopAfterDeliveryFailure: true,
      },
      communicationTemplates: {
        followUp: text(body.followUpBody, 12_000),
        referralReceived: text(body.referralReceivedBody, 8_000),
        referredPersonAcknowledgment: text(body.referredPersonAcknowledgmentBody, 8_000),
        qualifiedUpdate: text(body.qualifiedUpdateBody, 8_000),
        completionThankYou: text(body.completionThankYouBody, 8_000),
        rewardEligible: text(body.rewardEligibleBody, 8_000),
        rewardIssued: text(body.rewardIssuedBody, 8_000),
      },
    }, rowVersion, { userId: session.userId, email: session.email });
    return NextResponse.json({ success: true, campaign, message: "Draft campaign saved." });
  } catch (error) {
    if (error instanceof ReferralCampaignConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof ReferralValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The draft could not be saved." }, { status: 400 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { campaignId } = await context.params;
    const authorizedCampaign = await prisma.referralCampaign.findFirst({
      where: { id: campaignId, createdBy: { workspaceId: session.workspaceId } },
      select: { id: true },
    });
    if (!authorizedCampaign) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
    const body = await request.json() as { action?: string; testEmail?: unknown; rowVersion?: unknown; firstSendAt?: unknown; timezone?: unknown; confirmation?: unknown };
    if (body.action === "scheduling-review-opened" || body.action === "save-schedule-draft") {
      await prisma.referralAuditEvent.create({
        data: {
          campaignId, actorId: session.userId,
          action: body.action === "scheduling-review-opened" ? "SCHEDULING_REVIEW_OPENED" : "SCHEDULE_REVIEW_SAVED_WITHOUT_SCHEDULING",
          summary: body.action === "scheduling-review-opened"
            ? "Opened the production scheduling review. No schedule was created."
            : "Saved the scheduling review without creating a production schedule.",
          metadata: { timezone: text(body.timezone, 100) || null },
        },
      });
      return NextResponse.json({ success: true, message: body.action === "save-schedule-draft" ? "Review saved without scheduling." : "Scheduling review opened." });
    }
    if (body.action === "schedule") {
      if (body.confirmation !== "SCHEDULE") throw new ReferralValidationError("CONFIRMATION_REQUIRED", "Confirm the reviewed schedule before creating delivery jobs.");
      const timezone = text(body.timezone, 100, { required: true });
      const scheduledLocal = text(body.firstSendAt, 40, { required: true });
      const firstSendAt = zonedLocalToUtc(scheduledLocal, timezone);
      const result = await scheduleReferralCampaign(campaignId, firstSendAt, timezone, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, result, message: result.unchanged ? "This schedule is already confirmed." : "Campaign schedule confirmed. No message is sent until the scheduled time." });
    }
    if (body.action === "cancel-schedule") {
      if (body.confirmation !== "CANCEL SCHEDULE") throw new ReferralValidationError("CONFIRMATION_REQUIRED", "Confirm cancellation of the future schedule.");
      const result = await cancelReferralCampaignSchedule(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, result, message: result.unchanged ? "This campaign is already not scheduled." : "Future schedule cancelled. No messages were sent." });
    }
    if (body.action === "test") {
      const campaign = await prisma.referralCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error("Campaign not found.");
      const recipient = email(body.testEmail);
      const preview = await createReferralTestPreview({ campaignId, recipientEmail: recipient, actorId: session.userId });
      const referralUrl = `${getSiteUrl()}/refer/test/${encodeURIComponent(preview.token)}`;
      try {
        await sendTestCampaign({
          to: recipient,
          subject: campaign.invitationSubject,
          html: renderReferralInvitationEmail({
            body: campaign.invitationBody.replaceAll("{{first_name}}", "Jake").replaceAll("{{campaign_title}}", campaign.publicTitle).replaceAll("{{referral_link}}", referralUrl).replaceAll("{{referral_code}}", "HEL-TESTONLY"),
            previewText: campaign.invitationPreviewText,
            unsubscribeToken: "test-preview-disabled",
            referralUrl,
            referralCode: "HEL-TESTONLY",
            campaignTitle: campaign.publicTitle,
          }),
        });
      } catch (error) {
        await prisma.$transaction([
          prisma.referralTestToken.update({ where: { id: preview.id }, data: { revokedAt: new Date() } }),
          prisma.referralAuditEvent.create({
            data: {
              campaignId, actorId: session.userId, action: "TEST_SEND_FAILED",
              summary: `Test invitation delivery failed for ${recipient}.`,
              metadata: { testTokenId: preview.id },
            },
          }),
        ]);
        throw error;
      }
      await recordAuditEvent({
        actorId: session.userId, actorEmail: session.email, action: "REFERRAL_TEST_SENT",
        entityType: "ReferralCampaign", entityId: campaignId, summary: `Referral invitation test sent to ${recipient}.`,
      });
      await prisma.referralAuditEvent.create({
        data: { campaignId, actorId: session.userId, action: "TEST_SENT", summary: `Test invitation sent to ${recipient}.`, metadata: { testTokenId: preview.id, expiresAt: preview.expiresAt.toISOString() } },
      });
      return NextResponse.json({ success: true, message: `Test referral invitation sent to ${recipient}.` });
    }
    if (body.action === "approve") {
      const result = await approveReferralCampaign(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, message: `Campaign approved for ${result.audience.eligible.length} eligible advocates.` });
    }
    if (body.action === "launch" || body.action === "retry-safe") {
      const launch = await claimReferralCampaignLaunch(campaignId, { userId: session.userId, email: session.email });
      after(async () => {
        try {
          await processReferralLaunch(campaignId, launch.attemptId);
        } catch {
          // processReferralLaunch records a sanitized, recoverable failure before
          // rejecting. Swallow here so the after() callback itself cannot leak
          // operational details or produce an unhandled rejection.
        }
      });
      return NextResponse.json({
        success: true, launch,
        message: `Campaign preparation queued for ${launch.expectedAdvocateCount} advocates.`,
      }, { status: 202 });
    }
    if (body.action === "stop-preparation" || body.action === "return-to-approved") {
      const result = await stopReferralCampaignPreparation(
        campaignId,
        { userId: session.userId, email: session.email },
        body.action === "return-to-approved",
      );
      return NextResponse.json({
        success: true,
        result,
        message: body.action === "return-to-approved"
          ? "Preparation stopped before delivery. The approved snapshot is preserved; fresh launch confirmation is required."
          : "Campaign preparation stopped and the campaign was cancelled before delivery.",
      });
    }
    if (body.action === "return-to-draft" || body.action === "edit-approved") {
      const rowVersion = Number(body.rowVersion);
      if (!Number.isInteger(rowVersion) || rowVersion < 0) throw new ReferralValidationError("STALE_CAMPAIGN", "Reload this campaign before changing its approval.");
      const campaign = await returnReferralCampaignToDraft(campaignId, rowVersion, { userId: session.userId, email: session.email }, body.action === "edit-approved");
      return NextResponse.json({ success: true, campaign, message: "Campaign returned to Draft. Approval was removed and reapproval is required before launch." });
    }
    if (body.action === "delete") {
      await deleteReferralCampaign(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, deleted: true, message: "Campaign permanently deleted." });
    }
    if (body.action === "archive") {
      await archiveReferralCampaign(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, message: "Campaign archived with its history preserved." });
    }
    if (body.action === "pause" || body.action === "resume" || body.action === "cancel") {
      const status = await updateCampaignStatus(campaignId, body.action, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, status, message: `Campaign ${status.toLowerCase()}.` });
    }
    return NextResponse.json({ success: false, error: "Unsupported campaign action." }, { status: 400 });
  } catch (error) {
    if (error instanceof ReferralLaunchConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof EmailDeliveryError) {
      const messages = {
        EMAIL_PROVIDER_NOT_CONFIGURED: "Email delivery is not configured. Add the required Resend sender configuration.",
        EMAIL_PROVIDER_REJECTED: "The email provider rejected the test request. Verify the authorized sender and recipient.",
      };
      return NextResponse.json({ success: false, error: messages[error.code] }, { status: error.code === "EMAIL_PROVIDER_NOT_CONFIGURED" ? 503 : 502 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The action could not be completed." }, { status: 400 });
  }
}
