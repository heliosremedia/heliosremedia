import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260801050000_repair_referral_sender_and_recover/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("sender recovery is pinned to the exact zero-send campaign state", () => {
  assert.match(migration, /Helios Client Referral Program — \$50 Referral Reward/);
  assert.match(migration, /"preparedAdvocateCount" = 149/);
  assert.match(migration, /failed\."status" = 'FAILED'\) = 1/);
  assert.match(migration, /approved\."status" = 'APPROVED'\) = 148/);
  assert.match(migration, /"deliveryScheduledAt" IS NULL/);
  assert.match(migration, /"executionAuthorizedAt" IS NULL/);
});

test("sender recovery requires complete absence of delivery evidence", () => {
  assert.match(migration, /delivered\."status" = 'SENT'/);
  assert.match(migration, /delivered\."sentAt" IS NOT NULL/);
  assert.match(migration, /delivered\."providerMessageId" IS NOT NULL/);
  assert.match(migration, /communication\."sentAt" IS NULL/);
  assert.match(migration, /communication\."providerMessageId" IS NULL/);
});

test("sender recovery replaces the stored sender and creates fresh authorization", () => {
  assert.match(migration, /"senderEmail" = 'referrals@mail\.heliosrealestatemedia\.com'/);
  assert.match(migration, /"deliveryScheduledAt" = CURRENT_TIMESTAMP/);
  assert.match(migration, /"scheduleConfirmedAt" = CURRENT_TIMESTAMP/);
  assert.match(migration, /"executionAuthorizedAt" = CURRENT_TIMESTAMP/);
  assert.match(migration, /"scheduledRevisionId" = campaign\."approvedRevisionId"/);
  assert.match(migration, /"scheduledAudienceCount" = 149/);
});
