export type NewsletterAnalyticsRecipient = {
  id: string;
  status: string;
  events: Array<{ eventType: string; linkUrl?: string | null }>;
};

function rate(value: number, total: number) {
  return total ? Math.round((value / total) * 10_000) / 100 : 0;
}

export function summarizeNewsletterCampaign(
  recipients: NewsletterAnalyticsRecipient[],
  intended: number,
  unsubscribes = 0,
) {
  const events = recipients.flatMap((recipient) =>
    recipient.events.map((event) => ({ ...event, recipientId: recipient.id })),
  );
  const unique = (type: string) =>
    new Set(
      events
        .filter((event) => event.eventType === type)
        .map((event) => event.recipientId),
    ).size;
  const clicks = events.filter(
    (event) => event.eventType === "CLICKED" && event.linkUrl,
  );
  const topLinks = [
    ...clicks.reduce(
      (map, event) =>
        map.set(event.linkUrl!, (map.get(event.linkUrl!) || 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sent = recipients.filter((recipient) =>
    ["SENT", "FAILED"].includes(recipient.status),
  ).length;
  const delivered = unique("DELIVERED");
  const estimatedUniqueOpens = unique("OPENED");
  const uniqueClicks = unique("CLICKED");
  const bounces = unique("BOUNCED");
  const spamComplaints = unique("COMPLAINED");
  const delayed = unique("DELAYED");

  return {
    intended,
    sent,
    delivered,
    deliveryRate: rate(delivered, sent),
    estimatedUniqueOpens,
    estimatedOpenRate: rate(estimatedUniqueOpens, delivered || sent),
    uniqueClicks,
    clickThroughRate: rate(uniqueClicks, delivered || sent),
    topLinks,
    unsubscribes,
    bounces,
    spamComplaints,
    failed: recipients.filter((recipient) => recipient.status === "FAILED")
      .length,
    delayed,
  };
}
