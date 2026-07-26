import test from "node:test";
import assert from "node:assert/strict";
import { createReferralTestCredentials, hashReferralTestToken, REFERRAL_TEST_TOKEN_TTL_HOURS } from "./tokens.ts";

test("test referral credentials are random, hashed, and isolated from production tokens", () => {
  const first = createReferralTestCredentials();
  const second = createReferralTestCredentials();
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashReferralTestToken(first.token));
  assert.notEqual(first.tokenHash, hashReferralTestToken(second.token));
  assert.equal(REFERRAL_TEST_TOKEN_TTL_HOURS, 48);
});
