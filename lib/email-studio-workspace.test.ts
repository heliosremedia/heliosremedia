import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EMAIL_STUDIO_VIEWS, filterEmailCampaigns } from "./email-studio-workspace.ts";

const campaigns = [
  { id: "draft", subject: "A client thank-you", status: "DRAFT" },
  { id: "scheduled", subject: "A Winter Update", status: "SCHEDULED" },
  { id: "sent", subject: "Winter portfolio", status: "SENT" },
  { id: "partial", subject: "Partial delivery", status: "PARTIAL" },
  { id: "failed", subject: "Failed delivery", status: "FAILED" },
  { id: "processing", subject: "Processing", status: "PROCESSING" },
  { id: "cancelled", subject: "Cancelled", status: "CANCELLED" },
];

test("workspace defaults to Compose and keeps campaign and health views distinct", () => {
  assert.deepEqual(EMAIL_STUDIO_VIEWS.map((view) => view.id), ["compose", "campaigns", "health"]);
});

test("campaign filters preserve order, record identity, and all campaign statuses", () => {
  const before = JSON.stringify(campaigns);
  assert.deepEqual(filterEmailCampaigns(campaigns, "ALL"), campaigns);
  assert.deepEqual(filterEmailCampaigns(campaigns, "DRAFT").map((item) => item.id), ["draft"]);
  assert.deepEqual(filterEmailCampaigns(campaigns, "SCHEDULED").map((item) => item.id), ["scheduled"]);
  assert.deepEqual(filterEmailCampaigns(campaigns, "SENT").map((item) => item.id), ["sent", "partial"]);
  assert.deepEqual(filterEmailCampaigns(campaigns, "ISSUES").map((item) => item.id), ["partial", "failed"]);
  assert.equal(filterEmailCampaigns(campaigns, "DRAFT")[0], campaigns[0]);
  assert.equal(JSON.stringify(campaigns), before);
});

test("campaign search combines case-insensitive subjects and status, including empty results", () => {
  assert.deepEqual(filterEmailCampaigns(campaigns, "ALL", "  WINTER ").map((item) => item.id), ["scheduled", "sent"]);
  assert.deepEqual(filterEmailCampaigns(campaigns, "SCHEDULED", "winter").map((item) => item.id), ["scheduled"]);
  assert.deepEqual(filterEmailCampaigns(campaigns, "DRAFT", "winter"), []);
  assert.deepEqual(filterEmailCampaigns([], "ALL", "test"), []);
});

test("switching views keeps the composer mounted and draft audiences initialized", () => {
  const studio = readFileSync(new URL("../app/admin/email-studio/BulkEmailStudio.tsx", import.meta.url), "utf8");
  for (const view of ["compose", "campaigns", "health"]) {
    assert.ok(studio.includes(`hidden={workspaceView !== "${view}"}`));
  }
  assert.match(studio, /initialDraft\?\.selection\.groupIds/);
  assert.match(studio, /initialDraft\?\.selection\.clientIds/);
  assert.match(studio, /initialDraft\.recipientMode/);
  assert.match(studio, /setWorkspaceView\("compose"\)/);
  assert.match(studio, /setComposerView\("editor"\)/);
});

test("shared workspace tabs support keyboard navigation and associated panels", () => {
  const tabs = readFileSync(new URL("../app/admin/components/AdminWorkspaceTabs.tsx", import.meta.url), "utf8");
  for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) assert.ok(tabs.includes(`"${key}"`));
  assert.match(tabs, /aria-selected=/);
  assert.match(tabs, /aria-controls=/);
  assert.match(tabs, /tabIndex=\{value === item\.id \? 0 : -1\}/);
});

test("responsive preview is scoped to composer so fixed dialogs escape containment", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /#email-studio-panel-compose \{ container-type: inline-size; \}/);
  assert.doesNotMatch(styles, /\.email-studio-workspace \{ container-type:/);
  assert.match(styles, /@container \(min-width: 52rem\)/);
  assert.match(styles, /\.email-studio-preview \{ position: sticky;/);
});
