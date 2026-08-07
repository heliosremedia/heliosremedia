import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync(
  "app/api/admin/referrals/campaigns/[campaignId]/route.ts",
  "utf8",
);
const launch = fs.readFileSync("lib/referrals/launch.ts", "utf8");
const scheduling = fs.readFileSync("lib/referrals/scheduling.ts", "utf8");

test("workspace preparation count follows the current approved revision", () => {
  assert.match(route, /currentRevisionInvitationCount/);
  assert.match(route, /preparedAdvocateCount: currentRevisionInvitationCount/);
});

test("zero-delivery stale preparation is cancelled before rebuilding", () => {
  assert.match(launch, /supersedesPreparedRevision/);
  assert.match(launch, /STALE_PREPARATION_SUPERSEDED/);
  assert.match(launch, /failureCode: "SUPERSEDED_REVISION"/);
  assert.match(launch, /revokedAt: now/);
  assert.match(launch, /deliveryEvidence > 0 \|\| staleSubmissions > 0/);
});

test("scheduling updates only the currently approved revision", () => {
  const currentRevisionFilters = scheduling.match(
    /invitation: \{ approvedRevisionId: campaign\.approvedRevisionId \}/g,
  );
  assert.ok((currentRevisionFilters?.length ?? 0) >= 2);
});
