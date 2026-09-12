import assert from "node:assert/strict";
import { renderFormattedEmailBody } from "./client-communications/email-format.ts";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DASHBOARD_CARD_IDS,
  normalizeDashboardPreferences,
} from "./dashboard-layout.ts";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard rows preserve every card and reject invalid row contents", () => {
  const normalized = normalizeDashboardPreferences({
    rows: [
      ["platform-health", "performance-snapshot", "recent-activity"],
      ["platform-health", "unknown"],
      ["quick-actions"],
    ],
    collapsed: ["quick-actions", "unknown"],
  });
  assert.deepEqual(normalized.rows[0], ["platform-health", "performance-snapshot"]);
  assert.equal(normalized.rows.flat().length, DASHBOARD_CARD_IDS.length);
  assert.equal(new Set(normalized.rows.flat()).size, DASHBOARD_CARD_IDS.length);
  assert.deepEqual(normalized.collapsed, ["quick-actions"]);
});

test("legacy dashboard order migrates to full-width rows", () => {
  const normalized = normalizeDashboardPreferences({
    order: ["quick-actions", "platform-health"],
    collapsed: [],
  });
  assert.deepEqual(normalized.rows[0], ["quick-actions"]);
  assert.deepEqual(normalized.rows[1], ["platform-health"]);
});

test("admin surfaces preserve explicit publication and safe historical rendering", () => {
  const homepage = read("app/admin/homepage/HomepageCurationOrganizer.tsx");
  const profile = read("app/admin/users/ProfileManager.tsx");
  const portals = read("app/admin/client-portals/ClientPortalManager.tsx");
  const testimonials = read("app/admin/testimonials/TestimonialManager.tsx");
  const snapshot = read("app/admin/email-studio/SentCampaignSnapshot.tsx");
  const project = read("app/admin/projects/[projectId]/page.tsx");
  assert.match(homepage, /Expand All/);
  assert.match(homepage, /Collapse All/);
  assert.match(profile, /setExpanded\(false\)/);
  assert.match(portals, /Create Portal/);
  assert.match(testimonials, /checked=\{draft\.published\}/);
  assert.match(read("app/api/admin/testimonials/route.ts"), /published: body\.published === true/);
  assert.match(snapshot, /Technical details/);
  assert.match(snapshot, /__html: renderFormattedEmailBody\(/);
  const rendered = renderFormattedEmailBody('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))');
  assert.doesNotMatch(rendered, /<(?:script|img)\b|href="javascript:/i);
  assert.match(rendered, /&lt;script&gt;/);
  assert.match(project, /bulkSectionIds/);
});

test("workspace-owned operational records drive dashboard and newsletter counts", () => {
  const dashboard = read("lib/dashboard.ts");
  const newsletter = read("app/admin/newsletter-studio/page.tsx");
  const sync = read("app/api/admin/clients/sync/route.ts");
  assert.match(dashboard, /clientSyncRun\.findFirst/);
  assert.match(dashboard, /workspaceId/);
  assert.match(newsletter, /getContentOwnershipScope\(session\.workspaceId\)/);
  assert.match(newsletter, /series: ownershipScope/);
  assert.doesNotMatch(newsletter, /createdBy:/);
  assert.match(sync, /clientSyncRun\.create/);
  assert.match(sync, /workspaceId: session\.workspaceId/);
});
