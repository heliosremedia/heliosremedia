import test from "node:test";
import assert from "node:assert/strict";
import { campaignDraftUpdateIssue, canTransitionReferral, campaignCanExecute, followUpShouldStop, invitationCanExecute, mayEditReferralCampaign } from "./state-machine.ts";

test("referral lifecycle permits intended forward transitions and blocks reward skipping", () => {
  assert.equal(canTransitionReferral("SUBMITTED", "CONTACTED"), true);
  assert.equal(canTransitionReferral("COMPLETED", "REWARD_ELIGIBLE"), true);
  assert.equal(canTransitionReferral("SUBMITTED", "REWARD_ISSUED"), false);
  assert.equal(canTransitionReferral("REWARD_ISSUED", "COMPLETED"), false);
});

test("paused campaigns cannot execute invitations", () => {
  const now = new Date("2026-07-25T18:00:00Z");
  assert.equal(campaignCanExecute("PAUSED", now), false);
  assert.equal(invitationCanExecute("PAUSED", "SCHEDULED", now, now), false);
  assert.equal(invitationCanExecute("ACTIVE", "SCHEDULED", now, now), true);
});

test("only draft referral campaigns may be edited directly", () => {
  assert.equal(mayEditReferralCampaign("DRAFT"), true);
  assert.equal(campaignDraftUpdateIssue("DRAFT", 4, 4), null);
  assert.equal(campaignDraftUpdateIssue("DRAFT", 5, 4), "STALE");
  for (const status of ["APPROVED", "ACTIVE", "PAUSED", "COMPLETED", "EXPIRED", "CANCELLED", "ARCHIVED"]) {
    assert.equal(mayEditReferralCampaign(status), false, `${status} must remain read-only`);
    assert.equal(campaignDraftUpdateIssue(status, 4, 4), "STATUS");
  }
});

test("follow-ups stop after submission, pause, unsubscribe, failure, or campaign expiration", () => {
  const now = new Date("2026-07-25T18:00:00Z");
  const base = { campaignStatus: "ACTIVE", invitationStatus: "SENT", submissionExists: false, now };
  assert.equal(followUpShouldStop(base), false);
  assert.equal(followUpShouldStop({ ...base, submissionExists: true }), true);
  assert.equal(followUpShouldStop({ ...base, campaignStatus: "PAUSED" }), true);
  assert.equal(followUpShouldStop({ ...base, invitationStatus: "UNSUBSCRIBED" }), true);
  assert.equal(followUpShouldStop({ ...base, campaignEndsAt: new Date("2026-07-24T18:00:00Z") }), true);
});
