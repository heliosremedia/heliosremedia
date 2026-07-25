import { NextResponse } from "next/server";
import type { ReferralStatus } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { transitionReferral } from "@/lib/referrals/studio";
import { text } from "@/lib/referrals/validation";
import { REFERRAL_STATUSES } from "@/lib/referrals/state-machine";

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  const { submissionId } = await context.params;
  const referral = await prisma.referralSubmission.findUnique({
    where: { id: submissionId },
    include: {
      campaign: true,
      advocate: { include: { client: true } },
      matchedClient: true,
      inquiry: true,
      statusEvents: { include: { actor: { select: { displayName: true, email: true } } }, orderBy: { createdAt: "desc" } },
      rewards: true,
      communications: { orderBy: { createdAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!referral) return NextResponse.json({ success: false, error: "Referral not found." }, { status: 404 });
  return NextResponse.json({ success: true, referral });
}

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const { submissionId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "link") {
      const inquiryId = text(body.inquiryId, 200);
      const clientId = text(body.clientId, 200);
      const externalOrderId = text(body.externalOrderId, 240);
      if (inquiryId && !(await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { id: true } }))) {
        return NextResponse.json({ success: false, error: "The selected inquiry does not exist." }, { status: 400 });
      }
      if (clientId && !(await prisma.communicationClient.findUnique({ where: { id: clientId }, select: { id: true } }))) {
        return NextResponse.json({ success: false, error: "The selected client does not exist." }, { status: 400 });
      }
      const referral = await prisma.referralSubmission.update({
        where: { id: submissionId },
        data: { inquiryId: inquiryId || null, matchedClientId: clientId || null, externalOrderId: externalOrderId || null },
        select: { campaignId: true },
      });
      await prisma.referralAuditEvent.create({
        data: { campaignId: referral.campaignId, submissionId, actorId: session.userId, action: "REFERRAL_RECORD_LINKED", summary: "Updated linked inquiry, client, or external order reference.", metadata: { inquiryId: inquiryId || null, clientId: clientId || null, hasExternalOrderId: Boolean(externalOrderId) } },
      });
      return NextResponse.json({ success: true, message: "Referral relationships updated." });
    }
    const status = typeof body.status === "string" && REFERRAL_STATUSES.includes(body.status as ReferralStatus)
      ? body.status as ReferralStatus
      : null;
    if (!status) return NextResponse.json({ success: false, error: "Choose a valid status." }, { status: 400 });
    await transitionReferral(submissionId, status, text(body.reason, 1_000), { userId: session.userId, email: session.email });
    return NextResponse.json({ success: true, status, message: `Referral moved to ${status.replaceAll("_", " ").toLowerCase()}.` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The referral could not be updated." }, { status: 400 });
  }
}
