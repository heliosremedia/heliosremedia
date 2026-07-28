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
    deliveryScheduledAt: "2099-07-29T18:00:00Z",
    timezone: "America/Denver",
    approvedRevisionId: "revision-1",
    scheduledRevisionId: "revision-1",
    scheduledAudienceCount: 149,
  }), "SCHEDULED");
  assert.equal(referralOperationalState({
    status: "ACTIVE", sentCount: 0,
    scheduleConfirmedAt: null,
    deliveryScheduledAt: "2026-07-28T22:32:58Z",
  }), "APPROVED_NOT_SCHEDULED");
  assert.equal(referralScheduleIsRunnable({
    campaignStatus: "APPROVED",
    scheduleConfirmedAt: null,
    deliveryScheduledAt: "2026-07-28T17:00:00Z",
    timezone: "America/Denver",
    approvedRevisionId: "revision-1",
    scheduledRevisionId: "revision-1",
    scheduledAudienceCount: 149,
    now: new Date("2026-07-28T18:00:00Z"),
  }), false);
});

test("worker containment rejects incomplete scheduling authority", () => {
  const base = {
    campaignStatus: "APPROVED",
    scheduleConfirmedAt: "2026-07-28T18:00:00Z",
    deliveryScheduledAt: "2026-07-29T18:00:00Z",
    timezone: "America/Denver",
    approvedRevisionId: "revision-1",
    scheduledRevisionId: "revision-1",
    scheduledAudienceCount: 149,
    now: new Date("2026-07-30T18:00:00Z"),
  };
  assert.equal(referralScheduleIsRunnable(base), true);
  assert.equal(referralScheduleIsRunnable({ ...base, timezone: null }), false);
  assert.equal(referralScheduleIsRunnable({ ...base, scheduledRevisionId: "stale" }), false);
  assert.equal(referralScheduleIsRunnable({ ...base, scheduledAudienceCount: 0 }), false);
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
