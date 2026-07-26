import { NextResponse } from "next/server";
import type { ReferralAudienceMode } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { EmailDeliveryError, sendTestCampaign } from "@/lib/client-communications/email";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { renderReferralInvitationEmail } from "@/lib/referrals/email-renderer";
import { approveReferralCampaign, estimateReferralAudience, launchReferralCampaign, ReferralCampaignConflictError, updateCampaignStatus, updateReferralCampaignDraft } from "@/lib/referrals/studio";
import { email, integer, optionalDate, ReferralValidationError, stringArray, text } from "@/lib/referrals/validation";

const audienceModes = new Set<ReferralAudienceMode>(["INDIVIDUALS", "GROUPS", "FILTERED", "ALL_ELIGIBLE"]);

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = await prisma.referralCampaign.findUnique({
    where: { id: campaignId },
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
  return NextResponse.json({ success: true, campaign: { ...campaign, audienceEstimate } });
}

export async function PUT(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { campaignId } = await context.params;
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
    const body = await request.json() as { action?: string; testEmail?: unknown };
    if (body.action === "test") {
      const campaign = await prisma.referralCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new Error("Campaign not found.");
      const recipient = email(body.testEmail);
      await sendTestCampaign({
        to: recipient,
        subject: campaign.invitationSubject,
        html: renderReferralInvitationEmail({
          body: campaign.invitationBody.replaceAll("{{first_name}}", "Jake").replaceAll("{{campaign_title}}", campaign.publicTitle).replaceAll("{{referral_link}}", "#").replaceAll("{{referral_code}}", "HEL-TESTONLY"),
          previewText: campaign.invitationPreviewText,
          unsubscribeToken: "test-preview-disabled",
          referralUrl: "#",
          referralCode: "HEL-TESTONLY",
          campaignTitle: campaign.publicTitle,
        }),
      });
      await recordAuditEvent({
        actorId: session.userId, actorEmail: session.email, action: "REFERRAL_TEST_SENT",
        entityType: "ReferralCampaign", entityId: campaignId, summary: `Referral invitation test sent to ${recipient}.`,
      });
      await prisma.referralAuditEvent.create({
        data: { campaignId, actorId: session.userId, action: "TEST_SENT", summary: `Test invitation sent to ${recipient}.` },
      });
      return NextResponse.json({ success: true, message: `Test referral invitation sent to ${recipient}.` });
    }
    if (body.action === "approve") {
      const result = await approveReferralCampaign(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, message: `Campaign approved for ${result.audience.eligible.length} eligible advocates.` });
    }
    if (body.action === "launch") {
      const count = await launchReferralCampaign(campaignId, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, message: `Campaign launched for ${count} advocates.` });
    }
    if (body.action === "pause" || body.action === "resume" || body.action === "cancel") {
      const status = await updateCampaignStatus(campaignId, body.action, { userId: session.userId, email: session.email });
      return NextResponse.json({ success: true, status, message: `Campaign ${status.toLowerCase()}.` });
    }
    return NextResponse.json({ success: false, error: "Unsupported campaign action." }, { status: 400 });
  } catch (error) {
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
