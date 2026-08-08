import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSocialGroundingReview, socialDraftText } from "./grounding.ts";

test("grounding reviews fail closed when their shape contradicts itself", () => {
  assert.equal(normalizeSocialGroundingReview({ grounded: true, unsupportedClaims: ["one-acre homesite"] }), null);
  assert.equal(normalizeSocialGroundingReview({ grounded: false, unsupportedClaims: [] }), null);
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
