import assert from "node:assert/strict";
import test from "node:test";
import { deliveryEnabled, failureStatus } from "./delivery-policy.ts";

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
