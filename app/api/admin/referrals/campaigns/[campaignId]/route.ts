import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/audit";
import { EmailDeliveryError, sendTestCampaign } from "@/lib/client-communications/email";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { renderReferralInvitationEmail } from "@/lib/referrals/email-renderer";
import { approveReferralCampaign, estimateReferralAudience, launchReferralCampaign, updateCampaignStatus } from "@/lib/referrals/studio";
import { email } from "@/lib/referrals/validation";

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
