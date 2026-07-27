import assert from "node:assert/strict";
import test from "node:test";
import { publishingIdempotencyKey, retryDelayMs, sanitizeProviderMessage } from "./publishing-core.ts";
import { createOAuthState, decryptSocialToken, encryptSocialToken, verifyOAuthState } from "./token-crypto.ts";

test("publishing key is stable per approved revision and schedule", () => {
  const time = new Date("2026-07-27T18:00:00Z");
  assert.equal(publishingIdempotencyKey("v1","c1",4,time), publishingIdempotencyKey("v1","c1",4,time));
  assert.notEqual(publishingIdempotencyKey("v1","c1",4,time), publishingIdempotencyKey("v1","c1",5,time));
});
test("retry delay is bounded exponential backoff", () => {
  assert.equal(retryDelayMs(1, 0), 22_500);
  assert.equal(retryDelayMs(2, 0), 45_000);
  assert.ok(retryDelayMs(20, 1) <= 4_500_000);
});
test("provider errors are sanitized", () => {
  assert.doesNotMatch(sanitizeProviderMessage("access_token=secret-value failed"), /secret-value/);
});
test("tokens are authenticated-encrypted and OAuth states cannot be substituted", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY="test-only-key-that-is-never-used-in-production";
  const encrypted=encryptSocialToken({accessToken:"private-token"});
  assert.doesNotMatch(encrypted,/private-token/);
  assert.equal(decryptSocialToken(encrypted).accessToken,"private-token");
  const state=createOAuthState();
  assert.equal(verifyOAuthState(state,state),true);
  assert.equal(verifyOAuthState(state,createOAuthState()),false);
});
