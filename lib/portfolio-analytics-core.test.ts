import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  analyticsEventKey,
  classifyDevice,
  cleanAnalyticsTarget,
  normalizeReferrer,
  parsePortfolioEvent,
  selectWorkspaceForHost,
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
    target: "https://example.com/listing?token=secret#private",
    metadata: { position: 2 },
  });
});

test("targets preserve the exact clicked destination while referrers remain privacy-reduced", () => {
  assert.equal(cleanAnalyticsTarget("https://Example.com/ClientPath?Source=Portfolio#Details"), "https://Example.com/ClientPath?Source=Portfolio#Details");
  assert.deepEqual(normalizeReferrer("https://www.google.com/search?q=private"), {
    referrerHost: "google.com", trafficSource: "organic-search",
  });
});

test("device and deduplication helpers are stable", () => {
  assert.equal(classifyDevice("Mozilla/5.0 (iPhone) Mobile"), "mobile");
  assert.equal(classifyDevice("Googlebot"), "automated");
  assert.equal(analyticsEventKey("w", "s", "e"), analyticsEventKey("w", "s", "e"));
});

test("workspace resolution uses trusted hosts and rejects ambiguity", () => {
  const settings = [
    { workspaceId: "workspace-a", websiteUrl: "https://www.example-a.com" },
    { workspaceId: "workspace-b", websiteUrl: "https://example-b.com" },
  ];
  assert.equal(selectWorkspaceForHost("www.example-a.com", settings), "workspace-a");
  assert.equal(selectWorkspaceForHost("example-b.com:443", settings), "workspace-b");
  assert.equal(selectWorkspaceForHost("unknown.example", settings), null);
  assert.equal(selectWorkspaceForHost(null, settings), null);
  assert.equal(selectWorkspaceForHost(null, [settings[0]]), "workspace-a");
  assert.equal(selectWorkspaceForHost("example-a.com", [
    settings[0],
    { workspaceId: "workspace-c", websiteUrl: "https://example-a.com" },
  ]), null);
});

test("page-view event ids must use the public event-id character contract", () => {
  assert.equal(parsePortfolioEvent({
    eventName: "PORTFOLIO_VIEW",
    eventId: "portfolio_view_1234567890abcdef",
  })?.eventName, "PORTFOLIO_VIEW");
  assert.equal(parsePortfolioEvent({
    eventName: "PORTFOLIO_VIEW",
    eventId: "portfolio_view:portfolio:index",
  }), null);
});

test("analytics client confirms storage before suppressing one-time retries", () => {
  const source = readFileSync(
    new URL("../app/components/PortfolioAnalytics.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /result\?\.state === "stored"/);
  assert.match(source, /attempt < 2/);
  assert.doesNotMatch(source, /sendBeacon/);
  assert.doesNotMatch(source, /response\.ok && onceKey/);
});
