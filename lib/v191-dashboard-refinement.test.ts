import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V1.9.1 uses focused studio dashboard language and explicit health states", () => {
  const page = read("app/admin/page.tsx");
  assert.match(page, />Dashboard</);
  assert.doesNotMatch(page, /Admin Command Center|Compact Performance Snapshot|Unified Recent Activity/);
  assert.match(page, /Studio Overview/);
  assert.match(page, /Today & Upcoming/);
  for (const tone of ["green", "yellow", "red", "gray"]) {
    assert.match(page, new RegExp(`"${tone}"`));
  }
  assert.match(page, /Booking/);
  assert.match(page, /Email Analytics/);
  assert.match(page, /Client Sync/);
  assert.match(page, /Public Website/);
  assert.match(page, /Verified/);
});

test("primary metrics are specific, clickable, timeframe-aware, and provider-honest", () => {
  const page = read("app/admin/page.tsx");
  for (const label of [
    "New inquiries",
    "Published projects",
    "Portfolio views",
    "Project drafts",
    "Newsletter sends",
    "Email Studio sends",
    "Confirmed delivered",
    "Content reviews",
  ]) assert.match(page, new RegExp(label));
  assert.match(page, /7, 30, 90/);
  assert.match(page, /Awaiting confirmation can include historical sends that have not been reconciled/);
  assert.match(page, /does not determine current platform health/);
  assert.doesNotMatch(page, /providerWarning/);
  assert.doesNotMatch(page, /label="Campaigns"/);
});

test("dashboard preferences and organization controls remain intact", () => {
  const organizer = read("app/admin/components/DashboardOrganizer.tsx");
  const layout = read("lib/dashboard-layout.ts");
  assert.match(organizer, /Organize Dashboard/);
  assert.match(organizer, /Expand All/);
  assert.match(organizer, /Collapse All/);
  assert.match(organizer, /var\(--helios-orange\)/);
  assert.match(organizer, /aria-live="polite"/);
  assert.match(layout, /recent-activity/);
});

test("refinement adds workspace portfolio context without touching frozen surfaces", () => {
  const dashboard = read("lib/dashboard.ts");
  assert.match(dashboard, /featuredExpiresAt/);
  assert.match(dashboard, /portfolioAnalyticsEvent\.count/);
  assert.match(dashboard, /where: \{ workspaceId \}/);
  const changedRelease = read("lib/releases.ts");
  assert.match(changedRelease, /No Homepage Curation, public homepage, Referral Studio, or Social Studio functionality changed/);
});
