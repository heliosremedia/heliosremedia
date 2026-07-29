import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences } from "./dashboard-layout.ts";
import { featuredWindow, isActivelyFeatured } from "./featured-project.ts";
import { communicationMetrics } from "./dashboard-core.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard preferences are per-user, normalized, and safely reset", () => {
  assert.deepEqual(normalizeDashboardPreferences(null), DEFAULT_DASHBOARD_PREFERENCES);
  const value = normalizeDashboardPreferences({ order: ["quick-actions", "unknown", "quick-actions"], collapsed: ["platform-health"] });
  assert.equal(value.order[0], "quick-actions");
  assert.equal(value.order.length, 6);
  assert.deepEqual(value.collapsed, ["platform-health"]);
  const route = read("app/api/admin/dashboard-layout/route.ts");
  assert.match(route, /id: session\.userId, workspaceId: session\.workspaceId/);
});

test("dashboard organization is deliberate, accessible, and visually precise", () => {
  const source = read("app/admin/components/DashboardOrganizer.tsx");
  assert.match(source, /Organize Dashboard/);
  assert.match(source, /Expand All/);
  assert.match(source, /Collapse All/);
  assert.match(source, /bg-\[var\(--helios-orange\)\]/);
  assert.match(source, /Move Up/);
  assert.match(source, /aria-live="polite"/);
});

test("communication health distinguishes awaiting provider data", () => {
  const metrics = communicationMetrics([
    { id: "sent", status: "SENT", providerMessageId: "provider-1", events: [] },
    { id: "delivered", status: "SENT", providerMessageId: "provider-2", events: [{ eventType: "DELIVERED", linkUrl: null }] },
  ]);
  assert.equal(metrics.sent, 2);
  assert.equal(metrics.delivered, 1);
  assert.equal(metrics.awaitingProviderConfirmation, 1);
});

test("timed featured projects expire at query time without changing publication", () => {
  const now = new Date("2026-07-29T18:00:00Z");
  const seven = featuredWindow("7_DAYS", now);
  assert.equal(isActivelyFeatured(seven, new Date("2026-08-05T17:59:59Z")), true);
  assert.equal(isActivelyFeatured(seven, new Date("2026-08-05T18:00:00Z")), false);
  assert.deepEqual(featuredWindow("NONE", now), { featured: false, featuredStartedAt: null, featuredExpiresAt: null });
  assert.equal(featuredWindow("ALWAYS", now).featuredExpiresAt, null);
});

test("newsletter and blog delivery remain explicit administrator workflows", () => {
  const newsletter = read("app/api/admin/newsletters/editions/[editionId]/route.ts");
  const blog = read("app/api/admin/blog/[postId]/email-draft/route.ts");
  assert.match(newsletter, /REPLACE_SCHEDULE_AND_SEND_NOW/);
  assert.match(newsletter, /deliverApprovedNewsletter/);
  assert.match(blog, /status: "DRAFT"/);
  assert.match(blog, /status: "PUBLISHED"/);
  assert.doesNotMatch(blog, /processEmailCampaign|sendCampaignBatch|sendTestCampaign/);
});

test("dashboard and newsletter mutations are explicitly workspace scoped", () => {
  const dashboard = read("lib/dashboard.ts");
  const dashboardPage = read("app/admin/page.tsx");
  const newsletterApi = read("lib/newsletters/api.ts");
  const newsletterRoute = read("app/api/admin/newsletters/editions/[editionId]/route.ts");
  assert.match(dashboard, /getDashboardData\(workspaceId: string/);
  assert.match(dashboardPage, /getDashboardData\(session\.workspaceId, days\)/);
  assert.match(dashboard, /createdBy: \{ workspaceId \}/);
  assert.match(dashboard, /campaign: \{ workspaceId \}/);
  assert.match(dashboard, /project\.count\(\{ where: \{ workspaceId \} \}\)/);
  assert.match(newsletterApi, /series: \{ createdBy: \{ workspaceId \} \}/);
  assert.match(newsletterRoute, /getEditionForStudio\(editionId, session\.workspaceId\)/);
});

test("project navigation targets the true review and publish section", () => {
  const page = read("app/admin/projects/[projectId]/page.tsx");
  const workflow = read("app/admin/projects/[projectId]/ProjectWorkflowManager.tsx");
  const navigator = read("app/admin/components/AdminSectionNavigator.tsx");
  assert.match(page, /href: "#project-publishing"/);
  assert.match(workflow, /id="project-publishing"/);
  assert.match(navigator, /focus\(\{ preventScroll: true \}\)/);
});
