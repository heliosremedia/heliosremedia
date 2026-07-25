import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionEdition,
  mayApprove,
  maySend,
  statusAfterApprovedEditionMutation,
} from "./state-machine.ts";

test("AI generation cannot approve an edition", () => {
  assert.equal(canTransitionEdition("GENERATING", "APPROVED"), false);
  assert.equal(mayApprove("GENERATING"), false);
});

test("only a scheduled edition with active approval may send", () => {
  assert.equal(maySend("SCHEDULED", true), true);
  assert.equal(maySend("SCHEDULED", false), false);
  assert.equal(maySend("NEEDS_REVIEW", true), false);
});

test("editing approved content revokes approval state", () => {
  assert.equal(statusAfterApprovedEditionMutation({ status: "APPROVED", contentChanged: true }), "NEEDS_REVIEW");
  assert.equal(statusAfterApprovedEditionMutation({ status: "SCHEDULED", recipientsChanged: true }), "NEEDS_REVIEW");
});

test("sent editions have no outgoing state transitions", () => {
  assert.equal(canTransitionEdition("SENT", "NEEDS_REVIEW"), false);
});
