import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260806170000_recover_zero_delivery_referral_schedule/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const delivery = readFileSync(new URL("./delivery.ts", import.meta.url), "utf8");
const scheduling = readFileSync(new URL("./scheduling.ts", import.meta.url), "utf8");

test("recovery is pinned to the exact unsent production state", () => {
  assert.match(migration, /Helios Client Referral Program — \$50 Referral Reward/);
  assert.match(migration, /"expectedAdvocateCount" = 149/);
  assert.match(migration, /"preparedAdvocateCount" = 149/);
  assert.match(migration, /i\."status" = 'FAILED'[\s\S]*= 149/);
  assert.match(migration, /rc\."kind" = 'FOLLOW_UP'[\s\S]*= 447/);
});

test("recovery refuses any campaign with delivery evidence", () => {
  assert.match(migration, /evidence\."sentAt" IS NOT NULL OR evidence\."providerMessageId" IS NOT NULL/);
  assert.match(migration, /"deliveryScheduledAt" = NULL/);
  assert.match(migration, /"executionAuthorizedAt" = NULL/);
});

test("referral production delivery uses the verified provider sender", () => {
  assert.doesNotMatch(delivery, /from: communication\.campaign\.senderEmail/);
  assert.match(delivery, /same verified provider sender as test delivery/);
});

test("scheduling requires every initial invitation to be schedulable", () => {
  assert.match(scheduling, /schedulableInvitationCount !== expectedInvitations/);
  assert.match(scheduling, /schedulableCommunicationCount !== expectedInvitations/);
  assert.match(scheduling, /safe zero-delivery recovery/);
});
