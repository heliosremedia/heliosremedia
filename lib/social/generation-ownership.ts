import { resolveCampaignSourceContext } from "./source-context";
import { prisma } from "@/lib/prisma";
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from "@/lib/workspace-write-access";

export async function claimSocialGeneration(actor: WorkspaceWriteActor, campaignId: string, requestId: string, variantId?: string) {
  return prisma.$transaction(async (tx) => {
    await requireLockedWorkspaceEditor(tx, actor);
    const campaign = await tx.socialCampaign.findFirst({ where: { id: campaignId, workspaceId: actor.workspaceId }, include: { variants: true } });
    if (!campaign) throw new Error("SOCIAL_CAMPAIGN_NOT_FOUND");
    if (campaign.status === "ARCHIVED") throw new Error("SOCIAL_GENERATION_LOCKED");
    if (campaign.generationStatus === "RUNNING") throw new Error("SOCIAL_GENERATION_BUSY");
    if (campaign.generationRequestId === requestId && campaign.generationStatus === "SUCCEEDED") return { duplicate: true as const };
    const requested = variantId ? campaign.variants.filter((variant) => variant.id === variantId) : campaign.variants;
    if (!requested.length) throw new Error("SOCIAL_VARIANT_NOT_FOUND");
    const chosen = requested.filter((variant) => !["PUBLISHED", "ARCHIVED"].includes(variant.status));
    if (!chosen.length) throw new Error("SOCIAL_GENERATION_LOCKED");
    const { facts } = await resolveCampaignSourceContext(campaign, actor.workspaceId, tx);
    const claimed = await tx.socialCampaign.updateMany({
      where: { id: campaign.id, workspaceId: actor.workspaceId, generationStatus: campaign.generationStatus, generationRequestId: campaign.generationRequestId },
      data: { generationStatus: "RUNNING", generationError: null, generationRequestId: requestId, verifiedSourceFacts: facts },
    });
    if (claimed.count !== 1) throw new Error("SOCIAL_GENERATION_BUSY");
    return { duplicate: false as const, campaign: { ...campaign, verifiedSourceFacts: facts }, chosen };
  });
}

export async function failSocialGeneration(workspaceId: string, campaignId: string, requestId: string, message: string) {
  return prisma.socialCampaign.updateMany({
    where: { id: campaignId, workspaceId, generationRequestId: requestId, generationStatus: "RUNNING" },
    data: { generationStatus: "FAILED", generationError: message },
  });
}
