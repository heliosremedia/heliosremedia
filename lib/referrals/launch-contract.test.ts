import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_LAUNCH_BATCH_SIZE,
  referralCommunicationIdempotencyKey,
  referralLaunchClaimMode,
  referralLaunchBatches,
  referralLaunchIsComplete,
  referralLaunchIsStalled,
  referralRecoveryMode,
  missingReferralRecipients,
} from "./launch-contract.ts";

test("uses bounded 20-recipient launch batches", () => {
  const audience = Array.from({ length: 149 }, (_, index) => index);
  const batches = referralLaunchBatches(audience);
  assert.equal(REFERRAL_LAUNCH_BATCH_SIZE, 20);
  assert.equal(batches.length, 8);
  assert.deepEqual(batches.map(batch => batch.length), [20, 20, 20, 20, 20, 20, 20, 9]);
});

test("a small audience remains in one short batch", () => {
  assert.deepEqual(referralLaunchBatches(["a", "b"]), [["a", "b"]]);
});

test("rejects unsafe batch sizes", () => {
  assert.throws(() => referralLaunchBatches([1], 0), /Invalid/);
  assert.throws(() => referralLaunchBatches([1], 51), /Invalid/);
});

test("communication idempotency keys remain stable", () => {
  assert.equal(referralCommunicationIdempotencyKey("invite-1"), "referral:invite-1:invitation");
  assert.equal(referralCommunicationIdempotencyKey("invite-1", 2), "referral:invite-1:follow-up:2");
});

test("completion requires every invitation and communication", () => {
  assert.equal(referralLaunchIsComplete({
    expectedAdvocates: 149, preparedInvitations: 149, preparedCommunications: 298, followUpCount: 1,
  }), true);
  assert.equal(referralLaunchIsComplete({
    expectedAdvocates: 149, preparedInvitations: 148, preparedCommunications: 298, followUpCount: 1,
  }), false);
  assert.equal(referralLaunchIsComplete({
    expectedAdvocates: 149, preparedInvitations: 149, preparedCommunications: 297, followUpCount: 1,
  }), false);
});

test("only approved campaigns can be claimed and failed launches can be retried", () => {
  assert.equal(referralLaunchClaimMode("APPROVED", false), "INITIAL");
  assert.equal(referralLaunchClaimMode("LAUNCHING", false), "IN_PROGRESS");
  assert.equal(referralLaunchClaimMode("LAUNCHING", true), "RETRY");
  for (const status of ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]) {
    assert.equal(referralLaunchClaimMode(status, false), "REJECTED");
  }
});

test("retry skips recipients already committed by earlier batches", () => {
  const audience = [{ id: "one" }, { id: "two" }, { id: "three" }];
  assert.deepEqual(missingReferralRecipients(audience, ["one", "two"]), [{ id: "three" }]);
});

test("stalled launch requires an expired lease and no recent progress", () => {
  const now = new Date("2026-07-28T18:00:00Z");
  assert.equal(referralLaunchIsStalled({
    status: "LAUNCHING",
    launchStartedAt: "2026-07-28T17:30:00Z",
    launchLeaseExpiresAt: "2026-07-28T17:35:00Z",
    lastProgressAt: "2026-07-28T17:31:00Z",
    preparedAdvocateCount: 0,
    now,
  }), true);
  assert.equal(referralLaunchIsStalled({
    status: "LAUNCHING",
    launchStartedAt: "2026-07-28T17:30:00Z",
    launchLeaseExpiresAt: "2026-07-28T18:02:00Z",
    preparedAdvocateCount: 0,
    now,
  }), false);
});

test("recovery never treats partial delivery as a safe return to approved", () => {
  assert.equal(referralRecoveryMode({ status: "LAUNCHING", sentCount: 0, preparedCommunicationCount: 0 }), "ZERO_DELIVERY");
  assert.equal(referralRecoveryMode({ status: "LAUNCHING", sentCount: 0, preparedCommunicationCount: 20 }), "PARTIAL_PREPARATION");
  assert.equal(referralRecoveryMode({ status: "LAUNCHING", sentCount: 1, preparedCommunicationCount: 20 }), "PARTIAL_DELIVERY");
});
