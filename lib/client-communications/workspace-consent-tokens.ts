import "server-only";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { readWorkspaceMarketingEligibility } from "./workspace-consent";
import { normalizeEmail } from "./normalization";
import { MARKETING_TOKEN_TTL_DAYS } from "./preference-rules";
import { campaignWorkspacePreferenceToken, validWorkspacePreferenceToken, workspacePreferenceTokenHash } from "./workspace-token-rules";

type Database = Pick<PrismaClient, "$transaction">;
type CampaignTokenInput = { workspaceId: string; campaignId: string; recipientId: string; expectedCampaignVersion: number; expectedEmail: string; signingSecret: string };

/** Trusted delivery worker entrypoint. Context must come from its owned job/campaign, never a public request body. */
export async function createWorkspaceCampaignPreferenceToken(db: Database, input: CampaignTokenInput) {
  const normalizedEmail = normalizeEmail(input.expectedEmail);
  if (!input.workspaceId || !input.campaignId || !input.recipientId || !normalizedEmail || !Number.isInteger(input.expectedCampaignVersion)) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
  const token = campaignWorkspacePreferenceToken({ ...input, normalizedEmail });
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${input.workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id=${input.campaignId} AND "workspaceId"=${input.workspaceId} FOR SHARE`;
    const campaign = await tx.emailCampaign.findFirst({ where: { id: input.campaignId, workspaceId: input.workspaceId, rowVersion: input.expectedCampaignVersion, status: { in: ["PROCESSING", "SENDING"] } }, select: { id: true } });
    if (!campaign) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    await tx.$queryRaw`SELECT id FROM "CampaignRecipient" WHERE id=${input.recipientId} AND "campaignId"=${campaign.id} FOR SHARE`;
    const recipient = await tx.campaignRecipient.findFirst({ where: { id: input.recipientId, campaignId: campaign.id, status: { in: ["PENDING", "FAILED"] } }, select: { id: true, email: true, clientId: true } });
    if (!recipient || normalizeEmail(recipient.email) !== normalizedEmail) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    await tx.$queryRaw`SELECT id FROM "CommunicationClient" WHERE id=${recipient.clientId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "CommunicationClientWorkspace" WHERE "clientId"=${recipient.clientId} AND "workspaceId"=${input.workspaceId} FOR SHARE`;
    const client = await tx.communicationClient.findFirst({ where: { id: recipient.clientId, normalizedEmail, archivedAt: null, workspaceMemberships: { some: { workspaceId: input.workspaceId } } }, select: { id: true } });
    if (!client || !(await readWorkspaceMarketingEligibility(tx, input.workspaceId, normalizedEmail)).eligible) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    const preference = await tx.workspaceMarketingPreference.findUniqueOrThrow({ where: { workspaceId_normalizedEmail: { workspaceId: input.workspaceId, normalizedEmail } }, select: { id: true } });
    const tokenHash = workspacePreferenceTokenHash(token);
    const binding = { workspaceId: input.workspaceId, preferenceId: preference.id, source: "CAMPAIGN_RECIPIENT", campaignId: campaign.id, messageId: recipient.id };
    const previous = await tx.workspaceMarketingPreferenceToken.findUnique({ where: { tokenHash } });
    if (previous && Object.entries(binding).some(([key,value]) => previous[key as keyof typeof binding] !== value)) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    await tx.workspaceMarketingPreferenceToken.upsert({ where: { tokenHash, ...binding },
      create: { tokenHash, ...binding, expiresAt: new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000) },
      update: { expiresAt: new Date(Date.now() + MARKETING_TOKEN_TTL_DAYS * 86_400_000) },
    });
    return token;
  });
}

/** The immutable stored token binding is the only public unsubscribe authority. */
export async function consumeWorkspacePreferenceToken(db: Database, token: string, reason?: string) {
  if (!validWorkspacePreferenceToken(token)) return null;
  const tokenHash = workspacePreferenceTokenHash(token);
  const recordedReason = typeof reason === "string" ? reason.trim().slice(0, 500) || null : null;
  return db.$transaction(async tx => {
    const initial = await tx.workspaceMarketingPreferenceToken.findUnique({ where: { tokenHash }, select: { id: true, workspaceId: true, preferenceId: true } });
    if (!initial) return null;
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${initial.workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "WorkspaceMarketingPreferenceToken" WHERE id=${initial.id} FOR UPDATE`;
    const current = await tx.workspaceMarketingPreferenceToken.findFirst({ where: { id: initial.id, tokenHash, workspaceId: initial.workspaceId, preferenceId: initial.preferenceId, expiresAt: { gt: new Date() } } });
    if (!current) return null;
    const preference = await tx.workspaceMarketingPreference.findUniqueOrThrow({ where: { workspaceId_id: { workspaceId: current.workspaceId, id: current.preferenceId } } });
    const changed = preference.status !== "UNSUBSCRIBED";
    if (changed) {
      await tx.workspaceMarketingPreference.update({ where: { workspaceId_id: { workspaceId: current.workspaceId, id: preference.id } }, data: { status: "UNSUBSCRIBED", source: "PUBLIC_WORKSPACE_TOKEN", reason: recordedReason, actorId: null, effectiveAt: new Date() } });
      await tx.workspaceMarketingPreferenceEvent.create({ data: { workspaceId: current.workspaceId, preferenceId: preference.id, previousStatus: preference.status, status: "UNSUBSCRIBED", source: "PUBLIC_WORKSPACE_TOKEN", reason: recordedReason } });
      await tx.auditEvent.create({ data: { workspaceId: current.workspaceId, action: "WORKSPACE_MARKETING_TOKEN_UNSUBSCRIBED", entityType: "WorkspaceMarketingPreference", entityId: preference.id,
        summary: "Company marketing preference unsubscribed through its token.", metadata: { tokenId: current.id, campaignId: current.campaignId, messageId: current.messageId } } });
    }
    await tx.workspaceMarketingPreferenceToken.update({ where: { id: current.id, workspaceId: current.workspaceId, preferenceId: preference.id }, data: { lastUsedAt: new Date() } });
    return { success: true, changed };
  });
}
