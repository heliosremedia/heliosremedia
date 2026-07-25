import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { normalizedPhone } from "@/lib/referrals/attribution";
import { email, text } from "@/lib/referrals/validation";

export async function POST(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const campaignId = text(body.campaignId, 200, { required: true });
    const campaign = await prisma.referralCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ success: false, error: "Choose a valid campaign." }, { status: 400 });
    const advocateId = text(body.advocateId, 200);
    if (advocateId && !(await prisma.referralAdvocate.findFirst({ where: { id: advocateId, campaignId }, select: { id: true } }))) {
      return NextResponse.json({ success: false, error: "The selected advocate is not part of this campaign." }, { status: 400 });
    }
    const referralEmail = email(body.email);
    const phone = text(body.phone, 40);
    const referral = await prisma.$transaction(async tx => {
      const created = await tx.referralSubmission.create({
        data: {
          campaignId, advocateId: advocateId || null,
          firstName: text(body.firstName, 100, { required: true }),
          lastName: text(body.lastName, 100, { required: true }),
          email: referralEmail, normalizedEmail: referralEmail,
          phone: phone || null, normalizedPhone: normalizedPhone(phone),
          preferredContactMethod: text(body.preferredContactMethod, 30, { required: true }),
          message: text(body.message, 2_000) || null,
          submittedBy: "ADMIN_MANUAL",
          consentAcknowledged: false,
          consentText: "Consent was not collected through the public referral form. Administrator must verify appropriate contact permission.",
          consentedAt: new Date(),
          status: "NEEDS_REVIEW", attributionStatus: "NEEDS_REVIEW",
          attributionReason: "Manual referral entry requires administrator attribution and consent review.",
          statusEvents: { create: { toStatus: "NEEDS_REVIEW", actorId: session.userId, reason: "Manual referral created." } },
        },
      });
      await tx.referralAuditEvent.create({
        data: { campaignId, submissionId: created.id, actorId: session.userId, action: "MANUAL_REFERRAL_CREATED", summary: "Created a manual referral for attribution and consent review." },
      });
      return created;
    });
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email, action: "MANUAL_REFERRAL_CREATED",
      entityType: "ReferralSubmission", entityId: referral.id, summary: "Created a manual referral record.",
    });
    return NextResponse.json({ success: true, referralId: referral.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The manual referral could not be created." }, { status: 400 });
  }
}
