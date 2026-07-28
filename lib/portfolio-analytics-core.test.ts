import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsEventKey,
  classifyDevice,
  cleanAnalyticsTarget,
  normalizeReferrer,
  parsePortfolioEvent,
} from "./portfolio-analytics-core.ts";

test("analytics payloads accept only the centralized event contract", () => {
  assert.equal(parsePortfolioEvent({ eventName: "SECRET", eventId: "event_123456" }), null);
  assert.equal(parsePortfolioEvent({ eventName: "PROJECT_VIEW", eventId: "bad" }), null);
  assert.deepEqual(parsePortfolioEvent({
    eventName: "PROJECT_SHARE", eventId: "event_123456", channel: "LinkedIn",
    target: "https://example.com/listing?token=secret#private",
    metadata: { position: 2, email: "private@example.com" },
  }), {
    eventName: "PROJECT_SHARE", eventId: "event_123456", channel: "linkedin",
    target: "https://example.com/listing",
    metadata: { position: 2 },
  });
});

test("targets and referrers discard query strings and paths", () => {
  assert.equal(cleanAnalyticsTarget("https://example.com/path?token=secret"), "https://example.com/path");
  assert.deepEqual(normalizeReferrer("https://www.google.com/search?q=private"), {
    referrerHost: "google.com", trafficSource: "organic-search",
  });
});

test("device and deduplication helpers are stable", () => {
  assert.equal(classifyDevice("Mozilla/5.0 (iPhone) Mobile"), "mobile");
  assert.equal(classifyDevice("Googlebot"), "automated");
  assert.equal(analyticsEventKey("w", "s", "e"), analyticsEventKey("w", "s", "e"));
});
