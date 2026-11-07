import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEnabled, failureStatus, liveConfigurationApproved, deliveryRequestKey, requireDeliveryWindow } from "./delivery-policy.ts";

test("timeouts, network errors, server failures and idempotency conflicts cannot auto-retry", () => {
  for (const error of [null, {}, { provider: { status: null, providerType: "timeout" } }, { provider: { status: 500, providerType: "internal_server_error" } }, { provider: { status: 409, providerType: "concurrent_idempotent_requests" } }, { provider: { status: 400, providerType: "invalid_idempotent_request" } }]) assert.equal(failureStatus(error), "UNCERTAIN");
});
test("explicit single-request rejection and preflight configuration failure can retry", () => {
  for (const status of [400, 401, 403, 422, 429]) assert.equal(failureStatus({ provider: { status, providerType: "rejected" } }), "FAILED");
  assert.equal(failureStatus({ code: "EMAIL_PROVIDER_NOT_CONFIGURED" }), "FAILED");
  assert.equal(failureStatus({ code: "EMAIL_PROVIDER_SENDER", provider: null }), "FAILED");
});
test("live delivery needs both data approval and explicit rollout enablement", () => {
  assert.equal(deliveryEnabled({}), false);
  assert.equal(deliveryEnabled({ MONTHLY_SUMMARIES_LIVE_ENABLED: "true" }), false);
  assert.equal(deliveryEnabled({ MONTHLY_SUMMARIES_DATA_APPROVED: "true" }), false);
  assert.equal(deliveryEnabled({ MONTHLY_SUMMARIES_LIVE_ENABLED: "true", MONTHLY_SUMMARIES_DATA_APPROVED: "true" }), true);
});

test("V3 delivery tolerates an existing legacy key but requires both rollout approvals", () => {
  const approved = { HDPH_V3_TOKEN: "token", HDPH_API_KEY: "legacy", MONTHLY_SUMMARIES_LIVE_ENABLED: "true", MONTHLY_SUMMARIES_DATA_APPROVED: "true" };
  assert.equal(liveConfigurationApproved(approved), true);
  assert.equal(liveConfigurationApproved({ ...approved, HDPH_V3_TOKEN: " " }), false);
  assert.equal(liveConfigurationApproved({ ...approved, MONTHLY_SUMMARIES_DATA_APPROVED: "false" }), false);
  assert.equal(liveConfigurationApproved({ ...approved, MONTHLY_SUMMARIES_LIVE_ENABLED: "false" }), false);
});
test("manual sends and resends work while paused, scheduled sends do not", () => {
  assert.doesNotThrow(() => requireDeliveryWindow("MANUAL", false, null));
  assert.doesNotThrow(() => requireDeliveryWindow("RESEND", false, null));
  assert.throws(() => requireDeliveryWindow("LIVE", false, null), /paused/);
  const now = new Date("2026-11-07T16:00:00Z");
  for (const kind of ["MANUAL", "RESEND", "LIVE"] as const) assert.throws(() => requireDeliveryWindow(kind, true, new Date(+now + 1000), now), /Generation/);
});
test("manual and scheduled initial sends share an idempotency key; deliberate resends are distinct", () => {
  assert.equal(deliveryRequestKey("MANUAL", "report", "hash", "one"), deliveryRequestKey("LIVE", "report", "hash", "two"));
  assert.equal(deliveryRequestKey("RESEND", "report", "hash", "one"), deliveryRequestKey("RESEND", "report", "hash", "one"));
  assert.notEqual(deliveryRequestKey("RESEND", "report", "hash", "one"), deliveryRequestKey("RESEND", "report", "hash", "two"));
});
