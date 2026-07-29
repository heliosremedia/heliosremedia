import assert from "node:assert/strict";
import test from "node:test";
import { authenticateReferralCron } from "./cron-auth.ts";

test("accepts Vercel's exact Bearer authorization contract", () => {
  assert.deepEqual(authenticateReferralCron("Bearer exact-secret", "exact-secret"), {
    authenticated: true,
    reason: null,
  });
  assert.equal(authenticateReferralCron("bearer exact-secret", "exact-secret").authenticated, true);
});

test("rejects missing configuration and missing authorization without exposing values", () => {
  assert.deepEqual(authenticateReferralCron("Bearer anything", undefined), {
    authenticated: false,
    reason: "SECRET_MISSING",
  });
  assert.deepEqual(authenticateReferralCron(null, "exact-secret"), {
    authenticated: false,
    reason: "AUTHORIZATION_MISSING",
  });
});

test("rejects malformed, incorrect, and whitespace-modified credentials", () => {
  for (const header of [
    "exact-secret",
    "Basic exact-secret",
    "Bearer incorrect",
    "Bearer  exact-secret",
    "Bearer exact-secret ",
    "Bearer",
  ]) {
    assert.deepEqual(authenticateReferralCron(header, "exact-secret"), {
      authenticated: false,
      reason: "BEARER_MISMATCH",
    });
  }
});

test("compares the configured value exactly instead of trimming only one side", () => {
  assert.equal(authenticateReferralCron("Bearer exact-secret", " exact-secret").authenticated, false);
  assert.equal(authenticateReferralCron("Bearer  exact-secret", " exact-secret").authenticated, true);
});
