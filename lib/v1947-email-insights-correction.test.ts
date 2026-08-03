import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Email Studio uses sticky preview and provider-confirmed delivery language", () => {
  const studio = read("app/admin/email-studio/BulkEmailStudio.tsx");
  const page = read("app/admin/email-studio/page.tsx");
  assert.match(studio, /xl:sticky xl:top-24/);
  assert.match(studio, /provider accepted/);
  assert.doesNotMatch(studio, /sentCount}\/{campaign\.recipientCount} sent/);
  assert.match(page, /communicationMetrics/);
  assert.match(page, /Subscribed, valid, and not suppressed/);
  assert.match(page, /id="analytics-health"/);
});

test("Portfolio Insights records intentional external clicks and defines honest metrics", () => {
  const client = read("app/components/PortfolioAnalytics.tsx");
  const report = read("app/admin/portfolio-intelligence/page.tsx");
  assert.match(client, /event\.isTrusted/);
  assert.match(client, /parseReportableOutboundUrl/);
  assert.doesNotMatch(client, /a\[target='_blank'\]/);
  assert.match(report, /Share launcher activity/);
  assert.match(report, /CTA Clicks/);
  assert.match(report, /Outbound Clicks/);
  assert.match(report, /font-mono/);
});
