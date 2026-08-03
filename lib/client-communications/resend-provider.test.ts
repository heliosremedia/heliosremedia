import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  batchIdempotencyKey,
  chunkMessages,
  deliveryContentHash,
  normalizeResendError,
  resolveDeliveryConfig,
  resendTagValue,
  RESEND_BATCH_LIMIT,
} from "./providers/resend-core.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("delivery configuration requires a key and sender with portal fallback", () => {
  assert.equal(resolveDeliveryConfig({}).configured, false);
  assert.equal(resolveDeliveryConfig({ RESEND_API_KEY: "re_key" }).configured, false);
  assert.deepEqual(resolveDeliveryConfig({
    RESEND_API_KEY: " re_key ",
    PORTAL_EMAIL_FROM: "Helios <studio@mail.heliosrealestatemedia.com>",
  }), {
    apiKey: "re_key",
    from: "Helios <studio@mail.heliosrealestatemedia.com>",
    replyTo: null,
    configured: true,
    senderValid: true,
  });
  assert.equal(resolveDeliveryConfig({
    RESEND_API_KEY: "re_key",
    CAMPAIGN_EMAIL_FROM: "not-an-email",
  }).senderValid, false);
});

test("provider failures normalize without exposing HTML", () => {
  assert.equal(normalizeResendError({ name: "invalid_api_key", statusCode: 401, message: "bad key" }).code, "EMAIL_PROVIDER_AUTHENTICATION");
  assert.equal(normalizeResendError({ name: "invalid_from_address", statusCode: 403, message: "domain not verified" }).code, "EMAIL_PROVIDER_SENDER");
  assert.equal(normalizeResendError({ name: "rate_limit_exceeded", statusCode: 429, message: "slow down" }).retryable, true);
  const edge = normalizeResendError(
    { name: "application_error", statusCode: 403, message: "<html><title>Forbidden</title></html>" },
    { "cf-ray": "safe-request-id" },
  );
  assert.equal(edge.code, "EMAIL_PROVIDER_PERMISSION");
  assert.equal(edge.message.includes("<html>"), false);
  assert.equal(edge.providerRequestId, "safe-request-id");
});

test("batching follows the current Resend limit and maps every message", () => {
  assert.equal(RESEND_BATCH_LIMIT, 100);
  const messages = Array.from({ length: 205 }, (_, index) => ({ to: `person${index}@example.com` }));
  assert.deepEqual(chunkMessages(messages).map((chunk) => chunk.length), [100, 100, 5]);
});

test("Resend tag values sanitize newsletter composite campaign IDs", () => {
  assert.equal(
    resendTagValue("campaign:newsletter:batch-1"),
    "campaign_newsletter_batch-1",
  );
  assert.match(resendTagValue(":::") , /^[A-Fa-f0-9]{64}$/);
  assert.ok(resendTagValue("a".repeat(300)).length <= 256);
});

test("idempotency changes only with revision, batch, or recipient set", () => {
  const input = {
    campaignId: "campaign-1",
    revisionKey: "revision-1",
    batchNumber: 0,
    messages: [{ to: "b@example.com" }, { to: "a@example.com" }],
  };
  const key = batchIdempotencyKey(input);
  assert.equal(key, batchIdempotencyKey({ ...input, messages: [...input.messages].reverse() }));
  assert.notEqual(key, batchIdempotencyKey({ ...input, revisionKey: "revision-2" }));
  assert.notEqual(key, batchIdempotencyKey({ ...input, batchNumber: 1 }));
  assert.ok(key.length <= 256);
});

test("content identity includes rendered payload and unsubscribe URL", () => {
  const base = [{ to: "a@example.com", subject: "Subject", html: "<p>Hello</p>", unsubscribeUrl: "https://example.com/u/1" }];
  assert.equal(deliveryContentHash(base), deliveryContentHash(base));
  assert.notEqual(deliveryContentHash(base), deliveryContentHash([{ ...base[0], html: "<p>Changed</p>" }]));
});

test("all outbound studios use the shared SDK adapter and raw provider fetch is removed", () => {
  const shared = read("lib/client-communications/email.ts");
  const adapter = read("lib/client-communications/providers/resend.ts");
  const newsletter = read("lib/newsletters/delivery.ts");
  const campaign = read("lib/client-communications/campaign-delivery.ts");
  const referral = read("lib/referrals/delivery.ts");
  assert.match(adapter, /import \{ Resend \} from "resend"/);
  assert.match(adapter, /resend\.emails\.send/);
  assert.match(adapter, /resend\.batch\.send/);
  assert.doesNotMatch(shared, /api\.resend\.com|fetch\(/);
  assert.match(newsletter, /source: "newsletter"/);
  assert.match(campaign, /source: "campaign"/);
  assert.match(referral, /source: "referral"/);
});

test("newsletter provider failures remain distinct from integrity failures", () => {
  const delivery = read("lib/newsletters/delivery.ts");
  const route = read("app/api/admin/newsletters/editions/[editionId]/route.ts");
  assert.match(delivery, /Approved newsletter content failed its integrity check/);
  assert.match(route, /EMAIL_PROVIDER_REJECTED/);
  assert.match(route, /Approved content remains intact and delivery can be retried safely/);
});
