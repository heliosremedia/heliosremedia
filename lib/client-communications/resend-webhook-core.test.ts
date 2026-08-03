import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnosticEmails,
  normalizedResendStatus,
  safeEventDate,
} from "./resend-webhook-core.ts";

test("all required Resend lifecycle events normalize honestly", () => {
  assert.equal(normalizedResendStatus("email.sent"), "SENT");
  assert.equal(normalizedResendStatus("email.delivered"), "DELIVERED");
  assert.equal(normalizedResendStatus("email.delivery_delayed"), "DELAYED");
  assert.equal(normalizedResendStatus("email.bounced"), "BOUNCED");
  assert.equal(normalizedResendStatus("email.failed"), "FAILED");
  assert.equal(normalizedResendStatus("email.suppressed"), "SUPPRESSED");
  assert.equal(normalizedResendStatus("email.complained"), "COMPLAINED");
  assert.equal(normalizedResendStatus("unknown"), null);
});

test("diagnostic email fallback normalizes and deduplicates without matching", () => {
  assert.deepEqual(diagnosticEmails([" Client@Example.com ", "client@example.com", "invalid"]), ["client@example.com"]);
});

test("invalid provider timestamps use the received timestamp", () => {
  const received = new Date("2026-08-03T12:00:00.000Z");
  assert.equal(safeEventDate("invalid", received), received);
});
