import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttribution } from "./attribution.ts";

test("unambiguous attribution is confirmed", () => {
  assert.equal(resolveAttribution({
    campaignId: "campaign", advocateId: "advocate", expired: false, selfReferral: false, existingClient: false,
  }).status, "CONFIRMED");
});

test("duplicates, existing clients, self-referrals, expiry, and competing advocates require review", () => {
  const result = resolveAttribution({
    campaignId: "campaign", advocateId: "advocate", expired: true, selfReferral: true,
    existingClient: true, duplicateSubmissionId: "duplicate", competingAdvocateIds: ["a", "b"],
  });
  assert.equal(result.status, "NEEDS_REVIEW");
  assert.equal(result.reasons.length, 5);
});
