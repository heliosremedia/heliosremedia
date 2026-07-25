import "server-only";

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashReferralToken } from "./tokens";
import { normalizedPhone, resolveAttribution } from "./attribution";

export async function getPublicReferralCampaign(tokenOrCode: string) {
  const normalized = tokenOrCode.trim().toUpperCase();
  const link = await prisma.referralLink.findFirst({
    where: {
      OR: [
        { tokenHash: hashReferralToken(tokenOrCode) },
        { code: normalized },
      ],
    },
    include: {
      campaign: true,
      advocate: { include: { client: { select: { firstName: true, normalizedEmail: true, normalizedPhone: true } } } },
    },
  });
  if (!link || link.revokedAt || link.campaign.status !== "ACTIVE") return null;
  const now = new Date();
  if (link.expiresAt < now || (link.campaign.endsAt && link.campaign.endsAt < now)) {
    return { expired: true as const, link };
  }
  return { expired: false as const, link };
}

export function referralIpHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const secret = process.env.INQUIRY_HASH_SECRET || process.env.AUTH_SECRET || "local-development-only";
  return createHmac("sha256", secret).update(`referral:${ip}`).digest("hex");
}

export async function recordReferralVisit(token: string) {
  const result = await getPublicReferralCampaign(token);
  if (!result || result.expired) return result;
  const now = new Date();
  await prisma.$transaction([
    prisma.referralLink.update({
      where: { id: result.link.id },
      data: {
        visitCount: { increment: 1 },
        firstVisitedAt: result.link.firstVisitedAt ?? now,
        lastVisitedAt: now,
      },
    }),
    prisma.referralAuditEvent.create({
      data: { campaignId: result.link.campaignId, action: "REFERRAL_LINK_VISITED", summary: "Public referral link visited.", metadata: { linkId: result.link.id } },
    }),
  ]);
  return result;
}

export async function submitPublicReferral(input: {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  preferredContactMethod: string;
  message?: string;
  submittedBy: "ADVOCATE" | "REFERRED_PERSON";
  consentText: string;
}, request: Request) {
  const publicCampaign = await getPublicReferralCampaign(input.token);
  if (!publicCampaign) throw new Error("REFERRAL_UNAVAILABLE");
  const hash = referralIpHash(request);
  const recent = await prisma.referralSubmission.count({
    where: { ipHash: hash, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  if (recent >= 5) throw new Error("RATE_LIMITED");

  const phone = normalizedPhone(input.phone);
  const [priorSubmissions, existingClient] = await Promise.all([
    prisma.referralSubmission.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 365 * 86_400_000) },
        OR: [
          { normalizedEmail: input.email },
          ...(phone ? [{ normalizedPhone: phone }] : []),
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, advocateId: true, campaignId: true },
      take: 20,
    }),
    prisma.communicationClient.findFirst({
      where: {
        OR: [
          { normalizedEmail: input.email },
          ...(phone ? [{ normalizedPhone: phone }] : []),
        ],
      },
      select: { id: true },
    }),
  ]);
  const duplicate = priorSubmissions[0];
  const selfReferral = publicCampaign.link.advocate.client.normalizedEmail === input.email
    || Boolean(phone && publicCampaign.link.advocate.client.normalizedPhone === phone);
  const attribution = resolveAttribution({
    campaignId: publicCampaign.link.campaignId,
    advocateId: publicCampaign.link.advocateId,
    expired: publicCampaign.expired,
    selfReferral,
    existingClient: Boolean(existingClient),
    duplicateSubmissionId: duplicate?.id,
    competingAdvocateIds: [...new Set([
      publicCampaign.link.advocateId,
      ...priorSubmissions.map(item => item.advocateId).filter((id): id is string => Boolean(id)),
    ])],
  });
  const now = new Date();
  return prisma.$transaction(async tx => {
    const submission = await tx.referralSubmission.create({
      data: {
        campaignId: publicCampaign.link.campaignId,
        advocateId: publicCampaign.link.advocateId,
        linkId: publicCampaign.link.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        normalizedEmail: input.email,
        phone: input.phone || null,
        normalizedPhone: phone,
        preferredContactMethod: input.preferredContactMethod,
        message: input.message || null,
        submittedBy: input.submittedBy,
        consentAcknowledged: true,
        consentText: input.consentText,
        consentedAt: now,
        ipHash: hash,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        status: attribution.referralStatus,
        attributionStatus: attribution.status,
        attributionReason: attribution.reasons.join("; ") || null,
        duplicateOfId: duplicate?.id || null,
        matchedClientId: existingClient?.id || null,
        statusEvents: {
          create: {
            toStatus: attribution.referralStatus,
            reason: attribution.reasons.join("; ") || "Referral submitted through the public campaign page.",
          },
        },
      },
    });
    await tx.referralInvitation.updateMany({
      where: { id: publicCampaign.link.invitationId, status: { notIn: ["FAILED", "UNSUBSCRIBED", "CANCELLED"] } },
      data: { followUpStoppedAt: now },
    });
    await tx.referralCommunication.updateMany({
      where: {
        invitationId: publicCampaign.link.invitationId,
        kind: "FOLLOW_UP",
        status: { in: ["DRAFT", "APPROVED", "SCHEDULED"] },
      },
      data: { status: "CANCELLED", failureCode: "REFERRAL_SUBMITTED" },
    });
    await tx.referralAuditEvent.create({
      data: {
        campaignId: publicCampaign.link.campaignId,
        submissionId: submission.id,
        action: "REFERRAL_SUBMITTED",
        summary: attribution.status === "CONFIRMED" ? "Referral submitted." : "Referral submitted and flagged for attribution review.",
        metadata: { attributionStatus: attribution.status, reasons: attribution.reasons },
      },
    });
    return { submission, campaign: publicCampaign.link.campaign };
  });
}
