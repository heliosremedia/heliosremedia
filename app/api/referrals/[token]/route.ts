import { NextResponse } from "next/server";
import { email, ReferralValidationError, text } from "@/lib/referrals/validation";
import { recordReferralVisit, submitPublicReferral } from "@/lib/referrals/public";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await recordReferralVisit(token);
  if (!result) return NextResponse.json({ success: false, error: "This referral invitation is unavailable." }, { status: 404 });
  if (result.expired) return NextResponse.json({ success: false, error: "This referral invitation has expired." }, { status: 410 });
  return NextResponse.json({
    success: true,
    campaign: {
      publicTitle: result.link.campaign.publicTitle,
      headline: result.link.campaign.landingHeadline,
      body: result.link.campaign.landingBody,
      offer: result.link.campaign.referralOffer,
      referredCustomerOffer: result.link.campaign.referredCustomerOffer,
      terms: result.link.campaign.terms,
      privacyNotice: result.link.campaign.privacyNotice,
      advocateFirstName: result.link.advocate.client.firstName,
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (text(body.website, 200) || typeof body.renderedAt !== "number" || Date.now() - body.renderedAt < 1_800) {
      return NextResponse.json({ success: true });
    }
    if (body.consent !== true) throw new ReferralValidationError("CONSENT_REQUIRED", "Consent acknowledgment is required.");
    const submittedBy = body.submittedBy === "ADVOCATE" ? "ADVOCATE" : body.submittedBy === "REFERRED_PERSON" ? "REFERRED_PERSON" : null;
    if (!submittedBy) throw new ReferralValidationError("SUBMITTER_REQUIRED", "Choose who is completing this form.");
    const consentText = submittedBy === "ADVOCATE"
      ? "I confirm I have permission to share this person’s contact information with Helios for this referral. This does not provide marketing consent on their behalf."
      : "I agree that Helios may contact me about this referral request. This does not enroll me in unrelated marketing.";
    const result = await submitPublicReferral({
      token,
      firstName: text(body.firstName, 100, { required: true }),
      lastName: text(body.lastName, 100, { required: true }),
      email: email(body.email),
      phone: text(body.phone, 40),
      preferredContactMethod: text(body.preferredContactMethod, 30, { required: true }),
      message: text(body.message, 2_000),
      submittedBy,
      consentText,
    }, request);
    return NextResponse.json({ success: true, message: result.campaign.landingThankYou }, { status: 201 });
  } catch (error) {
    if (error instanceof ReferralValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json({ success: false, error: "Too many referrals were submitted. Please try again later." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "REFERRAL_UNAVAILABLE") {
      return NextResponse.json({ success: false, error: "This referral invitation is unavailable or expired." }, { status: 410 });
    }
    console.error("Unable to submit referral:", error);
    return NextResponse.json({ success: false, error: "The referral could not be submitted." }, { status: 500 });
  }
}
