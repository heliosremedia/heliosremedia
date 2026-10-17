import "server-only";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { tenantContextEnabled } from "@/lib/workspace-context-core";
import { normalizeEmail } from "./normalization";
import { createPreferenceToken } from "./preferences";
import { createWorkspaceCampaignPreferenceToken } from "./workspace-consent-tokens";

type Input = { workspaceId: string; campaignId: string; recipientId: string; expectedCampaignVersion: number; expectedEmail: string; signingSecret: string };

/** Stored campaign/recipient authority; retain legacy issuance only in attributable sole-company compatibility. */
export async function createCampaignDeliveryPreferenceToken(db: Pick<PrismaClient, "$transaction">, input: Input) {
  const email = normalizeEmail(input.expectedEmail);
  if (!input.workspaceId || !input.campaignId || !input.recipientId || !email || !Number.isInteger(input.expectedCampaignVersion)) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
  const legacy = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${input.workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "EmailCampaign" WHERE id=${input.campaignId} FOR SHARE`;
    const campaign = await tx.emailCampaign.findFirst({ where: { id: input.campaignId, rowVersion: input.expectedCampaignVersion, status: { in: ["PROCESSING", "SENDING"] }, OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }] }, select: { id: true, workspaceId: true } });
    if (!campaign) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    await tx.$queryRaw`SELECT id FROM "CampaignRecipient" WHERE id=${input.recipientId} AND "campaignId"=${campaign.id} FOR SHARE`;
    const recipient = await tx.campaignRecipient.findFirst({ where: { id: input.recipientId, campaignId: campaign.id, status: { in: ["PENDING", "FAILED"] } }, select: { clientId: true, email: true } });
    if (!recipient || normalizeEmail(recipient.email) !== email) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    await tx.$queryRaw`SELECT id FROM "CommunicationClient" WHERE id=${recipient.clientId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "CommunicationClientWorkspace" WHERE "clientId"=${recipient.clientId} AND "workspaceId"=${input.workspaceId} FOR SHARE`;
    const client = await tx.communicationClient.findFirst({ where: { id: recipient.clientId, normalizedEmail: email, archivedAt: null, emailSubscribed: true, emailStatus: "VALID", workspaceMemberships: { some: { workspaceId: input.workspaceId } } }, select: { id: true } });
    if (!client) throw new Error("CONSENT_TOKEN_SOURCE_INVALID");
    const own = await tx.workspaceMarketingPreference.findUnique({ where: { workspaceId_normalizedEmail: { workspaceId: input.workspaceId, normalizedEmail: email } }, select: { id: true } });
    const issued = await tx.workspaceMarketingPreferenceToken.findFirst({ where: { campaignId: campaign.id }, select: { id: true } });
    if (tenantContextEnabled() || own || issued) return null;
    // Stabilize sole-company compatibility against concurrent provisioning.
    await tx.$executeRaw`LOCK TABLE "Workspace" IN SHARE ROW EXCLUSIVE MODE`;
    const workspaces = await tx.workspace.findMany({ take: 2, select: { id: true } });
    if (workspaces.length !== 1 || workspaces[0].id !== input.workspaceId) return null;
    return createPreferenceToken({ clientId: client.id, campaignId: campaign.id }, tx);
  });
  if (legacy) return legacy;
  // No nested workspace lock. This service rechecks source, consent and legacy
  // protocol markers inside its own transaction before creating any token.
  return createWorkspaceCampaignPreferenceToken(db, input);
}
