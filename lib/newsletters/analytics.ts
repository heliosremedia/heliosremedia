import "server-only";
import { prisma } from "@/lib/prisma";
import { getContentOwnershipScope } from "@/lib/blog-ownership";
import { requireLockedWorkspaceAdministrator, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { summarizeNewsletterCampaign } from "./analytics-core";

const selection = {
  campaignId: true, eligibleCount: true,
  edition: { select: { seriesId: true, intendedSendAt: true } },
  campaign: { select: { recipients: { select: { id: true, status: true,
    events: { select: { eventType: true, linkUrl: true } },
  } } } },
} as const;

export async function getNewsletterAnalytics(editionId: string, inputActor: WorkspaceWriteActor) {
  const actor = { ...inputActor };
  return prisma.$transaction(async tx => {
    await requireLockedWorkspaceAdministrator(tx, actor);
    const scope = await getContentOwnershipScope(actor.workspaceId);
    const delivery = await tx.newsletterDelivery.findFirst({
      where: { editionId, edition: { series: scope }, campaign: scope }, select: selection,
    });
    if (!delivery) return null;
    const previousDelivery = await tx.newsletterDelivery.findFirst({
      where: {
        edition: { series: scope, seriesId: delivery.edition.seriesId, intendedSendAt: { lt: delivery.edition.intendedSendAt } },
        campaign: scope,
      },
      orderBy: { edition: { intendedSendAt: "desc" } }, select: selection,
    });
    // Global preference identities remain protected; only campaign-attributed events
    // for the two already-authorized deliveries contribute to these aggregate counts.
    const campaignIds = [delivery.campaignId, ...(previousDelivery ? [previousDelivery.campaignId] : [])];
    const preferenceEvents = await tx.marketingEmailPreferenceEvent.findMany({
      where: { campaignId: { in: campaignIds }, status: "UNSUBSCRIBED" },
      select: { campaignId: true, preferenceId: true },
    });
    const unsubscribeCount = (campaignId: string) => new Set(preferenceEvents.filter(event => event.campaignId === campaignId).map(event => event.preferenceId)).size;
    const current = summarizeNewsletterCampaign(delivery.campaign.recipients, delivery.eligibleCount, unsubscribeCount(delivery.campaignId));
    const previous = previousDelivery ? summarizeNewsletterCampaign(previousDelivery.campaign.recipients, previousDelivery.eligibleCount, unsubscribeCount(previousDelivery.campaignId)) : null;
    return { ...current, previous };
  }, { isolationLevel: "RepeatableRead" });
}
