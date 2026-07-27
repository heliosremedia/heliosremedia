export type DashboardAttention = {
  id: string;
  severity: "critical" | "attention" | "info";
  type: string;
  message: string;
  date: Date;
  href: string;
  action: string;
};

export type DashboardEvent = {
  id: string;
  type: string;
  title: string;
  date: Date;
  href: string;
  state: string;
};

export function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10_000) / 100 : 0;
}

export function previousPeriod(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - duration), end: new Date(start) };
}

export function dedupeAttention(items: DashboardAttention[]) {
  const rank = { critical: 0, attention: 1, info: 2 };
  return [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      a.date.getTime() - b.date.getTime(),
  );
}

export function communicationMetrics(
  recipients: Array<{
    id: string;
    status: string;
    events: Array<{ eventType: string; linkUrl: string | null }>;
  }>,
) {
  const unique = (type: string) =>
    new Set(
      recipients.flatMap((recipient) =>
        recipient.events
          .filter((event) => event.eventType === type)
          .map(() => recipient.id),
      ),
    ).size;
  const sent = recipients.filter((item) => item.status === "SENT").length;
  const delivered = unique("DELIVERED");
  const clicks = unique("CLICKED");
  const opens = unique("OPENED");
  const links = new Map<string, number>();
  recipients.forEach((recipient) =>
    recipient.events.forEach((event) => {
      if (event.eventType === "CLICKED" && event.linkUrl) {
        links.set(event.linkUrl, (links.get(event.linkUrl) || 0) + 1);
      }
    }),
  );
  return {
    intended: recipients.length,
    sent,
    delivered,
    deliveryRate: percent(delivered, sent),
    uniqueClicks: clicks,
    clickThroughRate: percent(clicks, delivered || sent),
    estimatedOpens: opens,
    estimatedOpenRate: percent(opens, delivered || sent),
    unsubscribes: unique("UNSUBSCRIBED"),
    bounces: unique("BOUNCED"),
    complaints: unique("COMPLAINED"),
    failed: recipients.filter((item) => item.status === "FAILED").length,
    topLink: [...links.entries()].sort((a, b) => b[1] - a[1])[0] || null,
  };
}

export function buildBriefing(input: {
  attention: DashboardAttention[];
  upcoming: DashboardEvent[];
  newInquiries: number | null;
  deliveryRate: number | null;
  bookingMode: string | null;
}) {
  const lines: string[] = [];
  if (input.attention.length) {
    lines.push(
      `${input.attention.length} ${input.attention.length === 1 ? "item needs" : "items need"} your attention.`,
    );
  } else {
    lines.push("No urgent operational items are currently waiting.");
  }
  if (input.newInquiries) {
    lines.push(
      `${input.newInquiries} new ${input.newInquiries === 1 ? "inquiry is" : "inquiries are"} ready for follow-up.`,
    );
  } else if (input.upcoming.length) {
    lines.push(
      `${input.upcoming.length} scheduled ${input.upcoming.length === 1 ? "item is" : "items are"} coming up in the next 14 days.`,
    );
  }
  if (input.bookingMode && input.bookingMode !== "ONLINE") {
    lines.push("Public online booking is not currently available.");
  } else if (input.deliveryRate !== null) {
    lines.push(
      `Recent communication delivery is ${input.deliveryRate.toFixed(1)}%.`,
    );
  }
  return lines.slice(0, 3).join(" ");
}
