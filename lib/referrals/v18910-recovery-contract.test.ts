import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260801040000_recover_zero_send_referral_campaign/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("zero-send recovery is pinned to the exact campaign and schedule", () => {
  assert.match(migration, /Helios Client Referral Program — \$50 Referral Reward/);
  assert.match(migration, /2026-07-29 03:36:00\+00/);
  assert.match(migration, /2026-07-29 03:37:00\+00/);
  assert.match(migration, /"preparedAdvocateCount" = 149/);
  assert.match(migration, /"scheduledAudienceCount" = 149/);
});

test("zero-send recovery requires complete unsent evidence", () => {
  assert.match(migration, /all_invites\."kind" = 'INVITATION'\) = 149/);
  assert.match(migration, /failed\."status" = 'FAILED'\) = 50/);
  assert.match(migration, /sent\."sentAt" IS NOT NULL OR sent\."providerMessageId" IS NOT NULL/);
  assert.match(migration, /communication\."sentAt" IS NULL/);
  assert.match(migration, /communication\."providerMessageId" IS NULL/);
});

test("zero-send recovery preserves the authorized schedule", () => {
  assert.match(migration, /"scheduleConfirmedAt" IS NOT NULL/);
  assert.match(migration, /"executionAuthorizedAt" IS NOT NULL/);
  assert.match(migration, /"scheduledRevisionId" = campaign\."approvedRevisionId"/);
  assert.match(migration, /"scheduledAt" = campaign\."deliveryScheduledAt"/);
  assert.doesNotMatch(migration, /UPDATE "ReferralCampaign"/);
});
