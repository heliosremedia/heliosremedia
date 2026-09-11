import "server-only";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { resolveCampaignSourceContext } from "./source-context";
import { publishingStorageReferenceMatches } from "./publishing-payload";

export async function duplicateSocialCampaign(campaignId: string, actor: WorkspaceWriteActor) {
  const workspaceId = actor.workspaceId;
  return prisma.$transaction(async (tx) => {
    await requireLockedWorkspaceEditor(tx, actor);
    await tx.$queryRaw`SELECT id FROM "SocialCampaign" WHERE id=${campaignId} AND "workspaceId"=${workspaceId} FOR UPDATE`;
    const source = await tx.socialCampaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        sourceProject: { select: { workspaceId: true } },
        projects: { include: { project: { select: { workspaceId: true } } } },
        media: { include: { media: { include: { project: { select: { workspaceId: true } } } } } },
        variants: { include: { media: { include: { media: { include: { project: { select: { workspaceId: true } } } } } } } },
      },
    });
    if (!source) throw new Error("SOCIAL_CAMPAIGN_NOT_FOUND");
    const media = [...source.media, ...source.variants.flatMap((variant) => variant.media)];
    if ((source.sourceProjectId && source.sourceProject?.workspaceId !== workspaceId)
      || source.projects.some((item) => item.project.workspaceId !== workspaceId)
      || media.some((item) => item.media.project.workspaceId !== workspaceId || item.media.visibility !== "VISIBLE" || !publishingStorageReferenceMatches(workspaceId, item.media.projectId, item.media.storageKey))) throw new Error("INVALID_SOCIAL_SOURCE");
    const { sourceIds, facts } = await resolveCampaignSourceContext(source, workspaceId, tx);
    return tx.socialCampaign.create({
        data: {
          internalName: `${source.internalName} - Copy`,
          description: source.description, purpose: source.purpose, status: "DRAFT", sourceType: source.sourceType,
          sourceRecordIds: sourceIds,
          verifiedSourceFacts: facts,
          targetAudience: source.targetAudience, brandVoice: source.brandVoice, primaryMessage: source.primaryMessage,
          objective: source.objective, desiredCallToAction: source.desiredCallToAction, destinationLink: source.destinationLink,
          selectedPlatforms: source.selectedPlatforms as Prisma.InputJsonValue, scheduleNotes: source.scheduleNotes, internalNotes: source.internalNotes,
          internalAiInstructions: source.internalAiInstructions, sourceProjectId: source.sourceProjectId,
          createdById: actor.userId, lastEditedById: actor.userId, workspaceId,
          projects: { create: source.projects.map((item) => ({ projectId: item.projectId })) },
          media: { create: source.media.map((item) => ({ mediaId: item.mediaId, displayOrder: item.displayOrder })) },
          variants: { create: source.variants.map((item) => ({
            platform: item.platform, postType: item.postType, status: "DRAFT",
            caption: item.caption, openingHook: item.openingHook, hashtags: item.hashtags === null ? undefined : item.hashtags as Prisma.InputJsonValue,
            callToAction: item.callToAction, destinationLink: item.destinationLink, altText: item.altText,
            onScreenText: item.onScreenText, videoConcept: item.videoConcept, suggestedCover: null,
            platformNotes: item.platformNotes, internalNotes: item.internalNotes, aiMetadata: undefined,
            lastEditedById: actor.userId,
            media: { create: item.media.map((relation) => ({
              mediaId: relation.mediaId, displayOrder: relation.displayOrder, altText: relation.altText,
              cropAspect: relation.cropAspect, cropX: relation.cropX, cropY: relation.cropY, cropScale: relation.cropScale,
            })) },
          })) },
        },
      select: { id: true },
    });
  });
}
