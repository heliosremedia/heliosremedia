import { NextResponse } from "next/server";
import { ReferralValidationError, email, text } from "@/lib/referrals/validation";
import { getReferralTestPreview, submitReferralTestPreview } from "@/lib/referrals/test-preview";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const preview = await getReferralTestPreview(token);
  if (!preview) return NextResponse.json({ success: false, error: "This test referral link is unavailable or expired." }, { status: 410 });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (text(body.website, 200) || typeof body.renderedAt !== "number" || Date.now() - body.renderedAt < 1_800) {
      return NextResponse.json({ success: true });
    }
    if (body.consent !== true) throw new ReferralValidationError("CONSENT_REQUIRED", "Consent acknowledgment is required.");
    if (body.submittedBy !== "ADVOCATE" && body.submittedBy !== "REFERRED_PERSON") {
      throw new ReferralValidationError("SUBMITTER_REQUIRED", "Choose who is completing this form.");
    }
    text(body.firstName, 100, { required: true });
    text(body.lastName, 100, { required: true });
    email(body.email);
    text(body.phone, 40);
    text(body.preferredContactMethod, 30, { required: true });
    text(body.message, 2_000);
    const result = await submitReferralTestPreview(token);
    if (!result) return NextResponse.json({ success: false, error: "This test referral link is unavailable or expired." }, { status: 410 });
    return NextResponse.json({
      success: true,
      message: "Test completed successfully. No referral, reward, client, metric, follow-up, or notification was created.",
    });
  } catch (error) {
    if (error instanceof ReferralValidationError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: false, error: "The test referral could not be validated." }, { status: 500 });
  }
}
