import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { normalizeEmail } from "@/lib/client-communications/normalization";
import { workspaceAddressIsMarketingEligible } from "@/lib/client-communications/delivery-consent";
import { MARKETING_TOKEN_TTL_DAYS, hashPreferenceToken } from "@/lib/client-communications/preference-rules";
import { validWorkspacePreferenceToken, workspacePreferenceTokenHash } from "@/lib/client-communications/workspace-token-rules";
import { lockReferralPreparationSource, type ReferralPreparationClaim } from "./preparation-claim";

type Input = { clientId: string; invitationId: string; email: string; tokenSeed: string };

/** Called inside the invitation/communication preparation transaction; never rewrites prepared HTML. */
export async function createReferralPreparationPreferenceToken(tx: Prisma.TransactionClient, claim: ReferralPreparationClaim, input: Input) {
  const email = normalizeEmail(input.email), token = `v2.${input.tokenSeed}`;
  if (!email || !validWorkspacePreferenceToken(token)) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
  await lockReferralPreparationSource(tx, claim);
  await tx.$queryRaw`SELECT id FROM "ReferralInvitation" WHERE id=${input.invitationId} FOR SHARE`;
  const invitation = await tx.referralInvitation.findFirst({ where: { id: input.invitationId, campaignId: claim.campaignId,
    approvedRevisionId: claim.revisionId, status: "APPROVED", advocate: { clientId: input.clientId, campaignId: claim.campaignId } }, select: { id: true } });
  if (!invitation) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
  await tx.$queryRaw`SELECT id FROM "CommunicationClient" WHERE id=${input.clientId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "CommunicationClientWorkspace" WHERE "clientId"=${input.clientId} AND "workspaceId"=${claim.workspaceId} FOR SHARE`;
  const client = await tx.communicationClient.findFirst({ where: { id: input.clientId, normalizedEmail: email,
    archivedAt: null, emailSubscribed: true, emailStatus: "VALID", workspaceMemberships: { some: { workspaceId: claim.workspaceId } },
    newsletterSuppressions: { none: { releasedAt: null } } }, select: { id: true } });
  if (!client || !await workspaceAddressIsMarketingEligible(tx, claim.workspaceId, email)) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
  const preference = await tx.workspaceMarketingPreference.findUnique({ where: { workspaceId_normalizedEmail: { workspaceId: claim.workspaceId, normalizedEmail: email } }, select: { id: true } });
  const issued = await tx.workspaceMarketingPreferenceToken.findFirst({ where: { campaignId: claim.campaignId }, select: { id: true } });
  const expiresAt = new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000);
  if (!tenantContextEnabled() && !preference && !issued) {
    await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE ROW EXCLUSIVE MODE`;
    const rows = await tx.workspace.findMany({ take: 2, select: { id: true } });
    if (rows.length !== 1 || rows[0].id !== claim.workspaceId) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
    const legacy = await tx.marketingEmailPreference.upsert({ where: { normalizedEmail: email },
      create: { normalizedEmail: email, status: "UNKNOWN", source: "REFERRAL_CAMPAIGN" }, update: {} });
    await tx.marketingEmailPreferenceToken.create({ data: { preferenceId: legacy.id, tokenHash: hashPreferenceToken(input.tokenSeed), expiresAt, campaignId: claim.campaignId } });
    return input.tokenSeed;
  }
  if (!preference) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
  if (await tx.marketingEmailPreferenceToken.findFirst({ where: { campaignId: claim.campaignId }, select: { id: true } })) throw new Error("REFERRAL_CONSENT_LEGACY_RETRY_REVIEW_REQUIRED");
  const source = `REFERRAL_INVITATION_REVISION_${claim.revisionId}`, tokenHash = workspacePreferenceTokenHash(token);
  const conflict = await tx.workspaceMarketingPreferenceToken.findFirst({ where: { campaignId: claim.campaignId,
    OR: [{ workspaceId: { not: claim.workspaceId } }, { source: { not: source } }, { messageId: invitation.id, tokenHash: { not: tokenHash } }] }, select: { id: true } });
  if (conflict) throw new Error("REFERRAL_CONSENT_RETRY_REVIEW_REQUIRED");
  const binding = { workspaceId: claim.workspaceId, preferenceId: preference.id, source, campaignId: claim.campaignId, messageId: invitation.id };
  const previous = await tx.workspaceMarketingPreferenceToken.findUnique({ where: { tokenHash } });
  if (previous) {
    if (Object.entries(binding).some(([key, value]) => previous[key as keyof typeof binding] !== value)) throw new Error("REFERRAL_CONSENT_SOURCE_INVALID");
    return token;
  }
  await tx.workspaceMarketingPreferenceToken.create({ data: { ...binding, tokenHash, expiresAt } });
  return token;
}
