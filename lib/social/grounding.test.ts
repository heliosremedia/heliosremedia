import assert from "node:assert/strict";
import test from "node:test";
import { deterministicallyGroundSocialDrafts, normalizeSocialGroundingReview, socialDraftText } from "./grounding.ts";

test("grounding reviews fail closed when their shape contradicts itself", () => {
  assert.deepEqual(normalizeSocialGroundingReview({ grounded: true, unsupportedClaims: ["one-acre homesite"] }), {
    grounded: false,
    unsupportedClaims: ["one-acre homesite"],
  });
  assert.deepEqual(normalizeSocialGroundingReview({ grounded: false, unsupportedClaims: [] }), {
    grounded: false,
    unsupportedClaims: ["The verifier flagged unsupported content without identifying a specific claim."],
  });
  assert.equal(normalizeSocialGroundingReview({ grounded: "yes", unsupportedClaims: [] }), null);
});

test("grounding reviews preserve bounded unsupported claims", () => {
  assert.deepEqual(normalizeSocialGroundingReview({
    grounded: false,
    unsupportedClaims: [" one-acre homesite ", "resort-inspired outdoor spaces"],
  }), {
    grounded: false,
    unsupportedClaims: ["one-acre homesite", "resort-inspired outdoor spaces"],
  });
  assert.deepEqual(normalizeSocialGroundingReview({ grounded: true, unsupportedClaims: [] }), {
    grounded: true,
    unsupportedClaims: [],
  });
});

test("social draft text includes campaign and platform copy for review", () => {
  const text = socialDraftText({
    campaignBrief: { positioning: "Show the property craft", themes: ["Visual storytelling"] },
    INSTAGRAM: { caption: "A one-acre homesite", hashtags: ["#Windsor"] },
  });
  assert.match(text, /Show the property craft/);
  assert.match(text, /A one-acre homesite/);
  assert.match(text, /#Windsor/);
});

test("deterministic grounding removes unsupported property marketing claims", () => {
  const result = deterministicallyGroundSocialDrafts({
    FACEBOOK: {
      caption: "The Acadia Estate is a luxury home set on a rare one-acre homesite in Acadia at Raindance. Professional media helps a listing read clearly.",
      hashtags: ["#WindsorCO", "#LuxuryHome"],
    },
  }, { title: "The Acadia Estate", city: "Windsor", state: "Colorado" });
  const copy = JSON.stringify(result.value);
  assert.doesNotMatch(copy, /luxury|one-acre|Raindance|LuxuryHome/i);
  assert.match(copy, /Professional media/);
  assert.ok(result.removedClaims.length >= 2);
});

test("deterministic grounding keeps high-risk terms when explicitly verified", () => {
  const result = deterministicallyGroundSocialDrafts({ caption: "A luxury home on a one-acre homesite." }, {
    propertyType: "Luxury home", lotSize: "one-acre homesite",
  });
  assert.match(JSON.stringify(result.value), /luxury home on a one-acre homesite/i);
  assert.deepEqual(result.removedClaims, []);
});
