import { prisma } from "@/lib/prisma";

function rate(value: number, total: number) { return total ? Math.round((value / total) * 10_000) / 100 : 0; }

export async function getNewsletterAnalytics(editionId: string) {
  const delivery = await prisma.newsletterDelivery.findUnique({
    where: { editionId },
    include: { campaign: { include: { recipients: { include: { events: true } } } } },
  });
  if (!delivery) return null;
  const recipients = delivery.campaign.recipients;
  const events = recipients.flatMap((recipient) => recipient.events.map((event) => ({ ...event, recipientId: recipient.id })));
  const unique = (type: string) => new Set(events.filter((event) => event.eventType === type).map((event) => event.recipientId)).size;
  const clicks = events.filter((event) => event.eventType === "CLICKED" && event.linkUrl);
  const links = [...clicks.reduce((map, event) => map.set(event.linkUrl!, (map.get(event.linkUrl!) || 0) + 1), new Map<string, number>())]
    .map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const sent = recipients.filter((recipient) => recipient.status === "SENT").length;
  const delivered = unique("DELIVERED"); const opens = unique("OPENED"); const uniqueClicks = unique("CLICKED");
  const bounced = unique("BOUNCED"); const complained = unique("COMPLAINED"); const delayed = unique("DELAYED");
  return {
    intended: delivery.eligibleCount, sent, delivered, deliveryRate: rate(delivered, sent),
    estimatedUniqueOpens: opens, estimatedOpenRate: rate(opens, delivered || sent),
    uniqueClicks, clickThroughRate: rate(uniqueClicks, delivered || sent), topLinks: links,
    unsubscribes: complained, bounces: bounced, spamComplaints: complained,
    failed: recipients.filter((recipient) => recipient.status === "FAILED").length, delayed,
  };
}
