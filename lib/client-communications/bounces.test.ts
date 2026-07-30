import assert from "node:assert/strict";
import test from "node:test";
import {
  BOUNCED_BACK_GROUP_NAME,
  bouncedBackNormalizedGroupName,
  bouncedBackSystemKey,
  isBouncedBackSystemKey,
  normalizeBounceEmail,
  providerRecipientMatches,
  sanitizeBounceReason,
} from "./bounce-core.ts";

test("workspace bounce group identity is deterministic and isolated", () => {
  assert.equal(BOUNCED_BACK_GROUP_NAME, "Bounced Back");
  assert.equal(bouncedBackSystemKey("workspace-a"), "BOUNCED_BACK:workspace-a");
  assert.notEqual(bouncedBackSystemKey("workspace-a"), bouncedBackSystemKey("workspace-b"));
  assert.equal(bouncedBackNormalizedGroupName("WORKSPACE-A"), "bounced back:workspace-a");
  assert.equal(isBouncedBackSystemKey("BOUNCED_BACK:workspace-a"), true);
  assert.equal(isBouncedBackSystemKey("UNSUBSCRIBED"), false);
});

test("bounce email normalization and provider recipient matching are safe", () => {
  assert.equal(normalizeBounceEmail(" Client@Example.COM "), "client@example.com");
  assert.equal(normalizeBounceEmail("invalid"), null);
  assert.equal(providerRecipientMatches(["other@example.com", "CLIENT@example.com"], "client@example.com"), true);
  assert.equal(providerRecipientMatches(["other@example.com"], "client@example.com"), false);
});

test("bounce reasons remove controls, normalize whitespace, and remain bounded", () => {
  assert.equal(sanitizeBounceReason(" rejected\u0000 \n by provider "), "rejected by provider");
  assert.equal(sanitizeBounceReason("x".repeat(700))?.length, 500);
  assert.equal(sanitizeBounceReason(null), null);
});
