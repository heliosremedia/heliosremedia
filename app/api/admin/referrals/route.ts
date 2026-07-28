import { NextResponse } from "next/server";
import type { ReferralAudienceMode } from "@/app/generated/prisma/client";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { createReferralCampaign, estimateReferralAudience, referralDashboardData } from "@/lib/referrals/studio";
import { email, integer, optionalDate, ReferralValidationError, stringArray, text } from "@/lib/referrals/validation";

const audienceModes = new Set<ReferralAudienceMode>(["INDIVIDUALS", "GROUPS", "FILTERED", "ALL_ELIGIBLE"]);

function range(request: Request) {
  const days = Math.max(7, Math.min(365, Number(new URL(request.url).searchParams.get("days")) || 30));
  return { from: new Date(Date.now() - days * 86_400_000), to: new Date() };
}

export async function GET(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { from, to } = range(request);
    return NextResponse.json({ success: true, data: await referralDashboardData(from, to, session.workspaceId) });
  } catch (error) {
    console.error("Unable to load Referral Studio:", error);
    return NextResponse.json({ success: false, error: "Referral Studio could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const mode = typeof body.audienceMode === "string" && audienceModes.has(body.audienceMode as ReferralAudienceMode)
      ? body.audienceMode as ReferralAudienceMode
      : null;
    if (!mode) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose a valid audience.");
    const groupIds = stringArray(body.groupIds);
    const clientIds = stringArray(body.clientIds);
    const excludedClientIds = stringArray(body.excludedClientIds);
    const filters = { updatedWithinDays: body.filterUpdatedWithinDays ? integer(body.filterUpdatedWithinDays, 1, 3_650, 365) : null };
    if (mode === "INDIVIDUALS" && !clientIds.length) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose at least one individual client.");
    if (mode === "GROUPS" && !groupIds.length) throw new ReferralValidationError("INVALID_AUDIENCE", "Choose at least one client group.");
    if (body.action === "estimate") {
      return NextResponse.json({
        success: true,
        data: await estimateReferralAudience({ mode, groupIds, clientIds, excludedClientIds, filters }),
      });
    }
    const startsAt = optionalDate(body.startsAt);
    const endsAt = optionalDate(body.endsAt);
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new ReferralValidationError("INVALID_DATES", "The end date must be after the start date.");
    }
    const senderEmail = text(body.senderEmail, 320);
    const replyTo = text(body.replyTo, 320);
    if (senderEmail) email(senderEmail);
    if (replyTo) email(replyTo);
    const campaign = await createReferralCampaign({
      internalName: text(body.internalName, 160, { required: true }),
      publicTitle: text(body.publicTitle, 180, { required: true }),
      purpose: text(body.purpose, 2_000, { required: true }),
      audienceMode: mode,
      groupIds, clientIds, excludedClientIds, filters,
      referralOffer: text(body.referralOffer, 1_000),
      advocateReward: text(body.advocateReward, 1_000),
      referredCustomerOffer: text(body.referredCustomerOffer, 1_000),
      eligibilityRules: text(body.eligibilityRules, 4_000),
      qualificationRules: text(body.qualificationRules, 4_000),
      rewardInstructions: text(body.rewardInstructions, 4_000),
      maxRewardsPerAdvocate: body.maxRewardsPerAdvocate === "" ? null : integer(body.maxRewardsPerAdvocate, 1, 10_000, 1),
      terms: text(body.terms, 12_000, { required: true }),
      senderName: text(body.senderName, 160),
      senderEmail, replyTo,
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
        stopAfterSubmission: true,
        stopAfterExpiration: true,
        stopAfterUnsubscribe: true,
        stopAfterDeliveryFailure: true,
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
    }, { userId: session.userId, email: session.email });
    return NextResponse.json({ success: true, campaignId: campaign.id, message: "Referral campaign created." }, { status: 201 });
  } catch (error) {
    if (error instanceof ReferralValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Unable to create referral campaign:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The campaign could not be created." }, { status: 500 });
  }
}
