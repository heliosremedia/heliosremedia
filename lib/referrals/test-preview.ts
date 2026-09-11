import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import "server-only";

import { prisma } from "@/lib/prisma";
import { createReferralTestCredentials, hashReferralTestToken, REFERRAL_TEST_TOKEN_TTL_HOURS } from "./tokens";

export async function createReferralTestPreview(input: {
  campaignId: string;
  recipientEmail: string;
  actorId: string;
}) {
  const credentials = createReferralTestCredentials();
  const expiresAt = new Date(Date.now() + REFERRAL_TEST_TOKEN_TTL_HOURS * 60 * 60_000);
  const preview = await prisma.$transaction(async tx => {
    const created = await tx.referralTestToken.create({
      data: {
        campaignId: input.campaignId,
        createdById: input.actorId,
        recipientEmail: input.recipientEmail,
        tokenHash: credentials.tokenHash,
        expiresAt,
      },
    });
    await tx.referralAuditEvent.create({
      data: {
        campaignId: input.campaignId,
        actorId: input.actorId,
        action: "TEST_REFERRAL_LINK_CREATED",
        summary: `Created a test referral preview link for ${input.recipientEmail}.`,
        metadata: { testTokenId: created.id, expiresAt: expiresAt.toISOString() },
      },
    });
    return created;
  });
  return { ...preview, token: credentials.token };
}

export async function getReferralTestPreview(token: string) {
  const workspaceId = await getPublicWorkspaceId();
  const preview = await prisma.referralTestToken.findFirst({
    where: { campaign: await getContentOwnershipScope(workspaceId), tokenHash: hashReferralTestToken(token) },
    include: { campaign: true },
  });
  if (!preview || preview.revokedAt || preview.expiresAt <= new Date()) return null;
  return preview;
}

export async function submitReferralTestPreview(token: string) {
  const preview = await getReferralTestPreview(token);
  if (!preview) return null;
  const updated = await prisma.referralTestToken.updateMany({
    where: { id: preview.id, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return updated.count === 1 ? { message: preview.campaign.landingThankYou } : null;
}
