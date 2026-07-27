import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBriefing,
  communicationMetrics,
  dedupeAttention,
  percent,
  previousPeriod,
} from "./dashboard-core.ts";

test("communication metrics deduplicate recipient events", () => {
  const result = communicationMetrics([
    {
      id: "a",
      status: "SENT",
      events: [
        { eventType: "DELIVERED", linkUrl: null },
        { eventType: "OPENED", linkUrl: null },
        { eventType: "OPENED", linkUrl: null },
        { eventType: "CLICKED", linkUrl: "https://example.com" },
        { eventType: "CLICKED", linkUrl: "https://example.com" },
      ],
    },
    {
      id: "b",
      status: "FAILED",
      events: [{ eventType: "BOUNCED", linkUrl: null }],
    },
  ]);
  assert.equal(result.estimatedOpens, 1);
  assert.equal(result.uniqueClicks, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.bounces, 1);
  assert.deepEqual(result.topLink, ["https://example.com", 2]);
});

test("attention is deduplicated and severity sorted", () => {
  const now = new Date();
  const items = dedupeAttention([
    { id: "same", severity: "attention", type: "A", message: "A", date: now, href: "/", action: "Open" },
    { id: "same", severity: "attention", type: "A", message: "A", date: now, href: "/", action: "Open" },
    { id: "critical", severity: "critical", type: "B", message: "B", date: now, href: "/", action: "Open" },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "critical");
});

test("previous period preserves duration and percent handles empty totals", () => {
  const start = new Date("2026-07-01T00:00:00Z");
  const end = new Date("2026-07-31T00:00:00Z");
  const prior = previousPeriod(start, end);
  assert.equal(prior.end.toISOString(), start.toISOString());
  assert.equal(end.getTime() - start.getTime(), prior.end.getTime() - prior.start.getTime());
  assert.equal(percent(4, 0), 0);
  assert.equal(percent(1, 4), 25);
});

test("briefing uses supplied facts and deterministic fallback", () => {
  const summary = buildBriefing({
    attention: [],
    upcoming: [],
    newInquiries: 0,
    deliveryRate: null,
    bookingMode: "ONLINE",
  });
  assert.equal(summary, "No urgent operational items are currently waiting.");
  assert.doesNotMatch(summary, /newsletter|campaign|failure/i);
});
