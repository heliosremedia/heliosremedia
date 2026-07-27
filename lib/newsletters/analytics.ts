import { prisma } from "@/lib/prisma";
import { summarizeNewsletterCampaign } from "./analytics-core";

export async function getNewsletterAnalytics(editionId: string) {
  const delivery = await prisma.newsletterDelivery.findUnique({
    where: { editionId },
    include: {
      edition: { select: { seriesId: true, intendedSendAt: true } },
      campaign: { include: { recipients: { include: { events: true } } } },
    },
  });
  if (!delivery) return null;
  const previousDelivery = await prisma.newsletterDelivery.findFirst({
    where: {
      edition: {
        seriesId: delivery.edition.seriesId,
        intendedSendAt: { lt: delivery.edition.intendedSendAt },
      },
    },
    orderBy: { edition: { intendedSendAt: "desc" } },
    include: {
      campaign: { include: { recipients: { include: { events: true } } } },
    },
  });
  const campaignIds = [
    delivery.campaignId,
    ...(previousDelivery ? [previousDelivery.campaignId] : []),
  ];
  const preferenceEvents = await prisma.marketingEmailPreferenceEvent.findMany({
    where: { campaignId: { in: campaignIds }, status: "UNSUBSCRIBED" },
    select: { campaignId: true, preferenceId: true },
  });
  const unsubscribeCount = (campaignId: string) =>
    new Set(
      preferenceEvents
        .filter((event) => event.campaignId === campaignId)
        .map((event) => event.preferenceId),
    ).size;
  const current = summarizeNewsletterCampaign(
    delivery.campaign.recipients,
    delivery.eligibleCount,
    unsubscribeCount(delivery.campaignId),
  );
  const previous = previousDelivery
    ? summarizeNewsletterCampaign(
        previousDelivery.campaign.recipients,
        previousDelivery.eligibleCount,
        unsubscribeCount(previousDelivery.campaignId),
      )
    : null;
  return { ...current, previous };
}
