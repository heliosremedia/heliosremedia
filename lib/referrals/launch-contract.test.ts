import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_LAUNCH_BATCH_SIZE,
  referralCommunicationIdempotencyKey,
  referralLaunchClaimMode,
  referralLaunchBatches,
  referralLaunchIsComplete,
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
