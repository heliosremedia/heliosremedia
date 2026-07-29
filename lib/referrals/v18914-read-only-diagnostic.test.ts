import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  "app/api/admin/referrals/campaigns/[campaignId]/route.ts",
  "utf8",
);
const workspace = fs.readFileSync(
  "app/admin/referral-studio/components/CampaignWorkspace.tsx",
  "utf8",
);

test("delivery diagnostic is tenant-scoped and read-only", () => {
  assert.match(route, /createdBy: \{ workspaceId: session\.workspaceId \}/);
  assert.match(route, /deliveryDiagnostic: \{/);
  assert.match(route, /readOnly: true/);
  assert.doesNotMatch(workspace, /deliveryDiagnostic[\s\S]{0,200}(fetch|POST|PUT|DELETE)/);
});

test("delivery diagnostic exposes eligibility evidence without recipient data", () => {
  assert.match(route, /authorizationChecks/);
  assert.match(route, /invitationStatusCounts/);
  assert.match(route, /communicationKindStatusCounts/);
  assert.match(route, /dueScheduledCommunications/);
  assert.match(route, /communicationDeliveryEvidence/);
  assert.match(route, /recentAuditActions/);
  assert.doesNotMatch(route, /recentDiagnosticAudits[\s\S]{0,150}(metadata|summary|recipientEmail|providerMessageId): true/);
  assert.match(workspace, /Recipient and provider identifiers are intentionally excluded/);
});

test("diagnostic panel has no campaign action controls", () => {
  const panelStart = workspace.indexOf("Read-only delivery diagnostic");
  const panel = workspace.slice(panelStart, workspace.indexOf("</details>", panelStart));
  assert.doesNotMatch(panel, /Retry|Reschedule|Send Campaign|onClick/);
  assert.match(panel, /cannot retry, schedule, send, or modify campaign records/);
});
