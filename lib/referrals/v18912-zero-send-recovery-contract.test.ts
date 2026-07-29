import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260801060000_recover_verified_sender_zero_send_campaign/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("recovery is pinned to the exact campaign and immutable incident history", () => {
  assert.match(migration, /Helios Client Referral Program — \$50 Referral Reward/);
  assert.match(migration, /"preparedAdvocateCount" = 149/);
  assert.match(migration, /ZERO_SEND_CAMPAIGN_RECOVERED/);
  assert.match(migration, /PROVIDER_FAILURE_SCHEDULE_CONTAINED/);
  assert.match(migration, /V1\.8\.9\.10/);
  assert.match(migration, /V1\.8\.9\.9/);
});

test("recovery requires an approved unauthorized campaign and exactly 149 invitations", () => {
  assert.match(migration, /c\."status" = 'APPROVED'/);
  assert.match(migration, /c\."deliveryScheduledAt" IS NULL/);
  assert.match(migration, /c\."executionAuthorizedAt" IS NULL/);
  assert.match(migration, /all_invites\."kind" = 'INVITATION'\) = 149/);
});

test("recovery refuses any sent or provider-submitted invitation", () => {
  assert.match(migration, /delivered\."status" = 'SENT'/);
  assert.match(migration, /delivered\."sentAt" IS NOT NULL/);
  assert.match(migration, /delivered\."providerMessageId" IS NOT NULL/);
  assert.match(migration, /communication\."sentAt" IS NULL/);
  assert.match(migration, /communication\."providerMessageId" IS NULL/);
});

test("recovery repairs the stored sender and creates one fresh authorization", () => {
  assert.match(migration, /"senderEmail" = 'referrals@mail\.heliosrealestatemedia\.com'/);
  assert.match(migration, /"deliveryScheduledAt" = CURRENT_TIMESTAMP/);
  assert.match(migration, /"executionAuthorizedAt" = CURRENT_TIMESTAMP/);
  assert.match(migration, /VERIFIED_SENDER_ZERO_SEND_RECOVERY_AUTHORIZED/);
  assert.doesNotMatch(migration, /failed\."status"/);
  assert.doesNotMatch(migration, /approved\."status"/);
});
