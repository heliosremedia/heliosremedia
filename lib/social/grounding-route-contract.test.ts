import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../../app/api/admin/social/ai/route.ts", import.meta.url), "utf8");

test("Social Studio reviews all generated copy before saving it", () => {
  const reviewAt = route.indexOf("normalizeSocialGroundingReview");
  const saveAt = route.indexOf("await prisma.$transaction");
  assert.ok(reviewAt > 0, "grounding review must be present");
  assert.ok(saveAt > reviewAt, "grounding review must run before the save transaction");
  assert.match(route, /socialDraftText\(drafts\)/);
  assert.match(route, /unsupportedClaims: groundingReview\.unsupportedClaims/);
  assert.match(route, /status: 422/);
  assert.match(route, /name: "social_grounding_review"/);
  assert.match(route, /required: \["grounded", "unsupportedClaims"\]/);
  assert.match(route, /additionalProperties: false/);
  assert.match(route, /OPENAI_SOCIAL_GROUNDING_MODEL\?\.trim\(\) \|\| "gpt-4\.1-mini"/);
  assert.match(route, /max_output_tokens: 500/);
});

test("Social Studio treats empty facts as no factual support", () => {
  assert.match(route, /An empty facts field never supports a claim/);
  assert.match(route, /Property-specific attributes must be supported by a non-empty VERIFIED FACTS key/);
});
\n\ntest("Social Studio never feeds a previously generated brief back as verified direction", () => {
  assert.doesNotMatch(route, /campaign\.objective \|\| campaign\.purpose/);
  assert.doesNotMatch(route, /campaign\.primaryMessage \|\| campaign\.purpose/);
});

test("Social Studio has enough execution time for generation and verification", () => {\n  assert.match(route, /export const maxDuration = 120/);\n  assert.match(route, /AbortSignal\\.timeout\\(70_000\\)/);\n  assert.match(route, /AbortSignal\\.timeout\\(40_000\\)/);\n  assert.match(route, /safeGenerationError\\(error\\)/);\n});\n