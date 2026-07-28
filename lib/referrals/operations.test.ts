import assert from "node:assert/strict";
import test from "node:test";
import {
  referralOperationalState,
  referralScheduleIsRunnable,
  referralSequenceSummary,
} from "./operations.ts";

test("approved prepared campaigns without confirmation are not active", () => {
  assert.equal(referralOperationalState({ status: "APPROVED", sentCount: 0 }), "APPROVED_NOT_SCHEDULED");
});

test("schedule state requires both confirmation and a delivery timestamp", () => {
  assert.equal(referralOperationalState({
    status: "APPROVED", sentCount: 0,
    scheduleConfirmedAt: "2026-07-28T18:00:00Z",
    deliveryScheduledAt: "2026-07-29T18:00:00Z",
  }), "SCHEDULED");
  assert.equal(referralScheduleIsRunnable({
    campaignStatus: "APPROVED",
    scheduleConfirmedAt: null,
    deliveryScheduledAt: "2026-07-28T17:00:00Z",
    now: new Date("2026-07-28T18:00:00Z"),
  }), false);
});

test("sequence totals distinguish advocates from messages", () => {
  assert.deepEqual(referralSequenceSummary({
    advocateCount: 149, followUpEnabled: true, followUpCount: 3,
  }), { steps: 4, followUps: 3, estimatedMessages: 596 });
});

test("paused and stalled states override scheduling labels", () => {
  assert.equal(referralOperationalState({ status: "PAUSED", sentCount: 0 }), "PAUSED");
  assert.equal(referralOperationalState({ status: "LAUNCHING", sentCount: 0, stalled: true }), "STALLED");
});
