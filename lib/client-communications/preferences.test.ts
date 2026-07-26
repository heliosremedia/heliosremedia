import assert from "node:assert/strict";
import test from "node:test";
import { hashPreferenceToken, marketingStatusAllowsSend, MARKETING_TOKEN_TTL_DAYS, oneClickUnsubscribeHeaders, validPreferenceTokenFormat } from "./preference-rules.ts";

test("marketing status blocks unsubscribe and suppression only", () => {
  assert.equal(marketingStatusAllowsSend("UNSUBSCRIBED"), false);
  assert.equal(marketingStatusAllowsSend("SUPPRESSED"), false);
  assert.equal(marketingStatusAllowsSend("SUBSCRIBED"), true);
  assert.equal(marketingStatusAllowsSend("UNKNOWN"), true);
});

test("preference token hashes do not expose the token", () => {
  const token = "r".repeat(43);
  const hash = hashPreferenceToken(token);
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
  assert.equal(hashPreferenceToken(token), hash);
});

test("preference token expiry is deliberately bounded", () => {
  assert.equal(MARKETING_TOKEN_TTL_DAYS, 365);
});

test("only opaque bounded tokens are accepted", () => {
  assert.equal(validPreferenceTokenFormat("a".repeat(43)), true);
  assert.equal(validPreferenceTokenFormat("client-123"), false);
  assert.equal(validPreferenceTokenFormat("a".repeat(81)), false);
});

test("marketing sends expose RFC one-click unsubscribe headers", () => {
  assert.deepEqual(oneClickUnsubscribeHeaders("https://helios.test/api/unsubscribe?token=opaque"), {
    "List-Unsubscribe": "<https://helios.test/api/unsubscribe?token=opaque>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});
