/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { resolveInquiryEmailConfig, type InquiryEmailEnvironment } from "./inquiry-email-config.ts";

const environment = {
  RESEND_API_KEY: "synthetic-key",
  INQUIRY_EMAIL_FROM: "Helios <website@example.com>",
  INQUIRY_NOTIFICATION_EMAIL: "owner@example.com",
};
const input = {
  inquiryId: "synthetic-inquiry",
  name: "Sample <User>\nName",
  email: "submitter@example.com",
  phone: null,
  message: "Hello <script>ignored</script>",
  sourcePage: "/contact",
  kind: "general contact message",
};

function load(file: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(js, {
    exports,
    require: (name: string) => {
      if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
      return mocks[name];
    },
    process: { env: environment },
    Date, JSON, console, AbortSignal, Request, Response, URL,
    setTimeout: (callback: () => void) => { callback(); return 0; },
    ...globals,
  }, { filename: file });
  return exports;
}

function sender(responses: Array<Response | Error>, env: InquiryEmailEnvironment = environment) {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const loaded = load("./inquiry-notifications.ts", {
    "server-only": {},
    "./inquiry-email-config": { resolveInquiryEmailConfig },
  }, {
    process: { env },
    fetch: async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (!response) throw new Error("Unexpected provider request");
      if (response instanceof Error) throw response;
      return response;
    },
  });
  return { sendInquiryNotification: loaded.sendInquiryNotification, sendInquiryConfirmation: loaded.sendInquiryConfirmation, calls };
}
const accepted = (id = "provider-message") => Response.json({ id });
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test("inquiry configuration uses explicit sender and recipient before fallbacks", () => {
  const config = resolveInquiryEmailConfig({ ...environment, HELIOS_ADMIN_EMAIL: "other@example.com", PORTAL_EMAIL_FROM: "portal@example.com" });
  assert.equal(config.notificationReady, true);
  assert.equal(config.to, "owner@example.com");
  assert.equal(config.from, environment.INQUIRY_EMAIL_FROM);
});

test("missing inquiry settings reuse the configured owner and established sender", () => {
  for (const senderKey of ["PORTAL_EMAIL_FROM", "CAMPAIGN_EMAIL_FROM"] as const) {
    const config = resolveInquiryEmailConfig({ RESEND_API_KEY: "key", HELIOS_ADMIN_EMAIL: "owner@example.com", [senderKey]: "Helios <mail@example.com>" });
    assert.equal(config.notificationReady, true);
    assert.equal(config.to, "owner@example.com");
    assert.equal(config.from, "Helios <mail@example.com>");
  }
});

test("copied environment assignment wrappers are normalized like owner login", () => {
  const config = resolveInquiryEmailConfig({ RESEND_API_KEY: '"key"', HELIOS_ADMIN_EMAIL: 'HELIOS_ADMIN_EMAIL="owner@example.com"', PORTAL_EMAIL_FROM: "'Helios <mail@example.com>'" });
  assert.equal(config.notificationReady, true);
  assert.equal(config.apiKey, "key");
  assert.equal(config.to, "owner@example.com");
});

test("invalid explicit addresses do not silently redirect to fallback recipients", () => {
  for (const address of ["broken", "a@example.com,b@example.com", "a@example.com\r\nBcc: b@example.com", "Name <a@example.com>"]) {
    const config = resolveInquiryEmailConfig({ ...environment, INQUIRY_NOTIFICATION_EMAIL: address, HELIOS_ADMIN_EMAIL: "fallback@example.com" });
    assert.equal(config.notificationReady, false, address);
    assert.equal(config.to, address);
    assert.ok(config.issues.some(issue => issue.includes("recipient")));
  }
});

test("configuration diagnostics identify missing settings without exposing credentials", () => {
  const config = resolveInquiryEmailConfig({});
  assert.equal(config.notificationReady, false);
  assert.equal(config.issues.length, 3);
  const invalid = resolveInquiryEmailConfig({ ...environment, INQUIRY_EMAIL_FROM: "not-a-mailbox" });
  assert.equal(invalid.senderReady, false);
  assert.equal(invalid.notificationReady, false);
});

test("owner email uses Resend wire-format reply_to, escaped content, and a message receipt", async () => {
  const f = sender([accepted()]);
  const result = await f.sendInquiryNotification(input);
  assert.deepEqual(plain(result), { status: "accepted", providerMessageId: "provider-message", providerStatus: 200 });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, "https://api.resend.com/emails");
  const payload = JSON.parse(f.calls[0].options.body as string);
  assert.deepEqual(payload.to, ["owner@example.com"]);
  assert.equal(payload.reply_to, input.email);
  assert.equal(payload.replyTo, undefined);
  assert.doesNotMatch(payload.subject, /[\r\n]/);
  assert.match(payload.html, /&lt;script&gt;/);
  assert.doesNotMatch(payload.html, /<script>/);
  assert.ok(payload.text.includes(input.inquiryId));
  assert.equal((f.calls[0].options.headers as Record<string, string>)["Idempotency-Key"], `inquiry-${input.inquiryId}-notification`);
});

test("submitter confirmation stays separate and replies to the owner", async () => {
  const f = sender([accepted()]);
  await f.sendInquiryConfirmation(input);
  const payload = JSON.parse(f.calls[0].options.body as string);
  assert.deepEqual(payload.to, [input.email]);
  assert.equal(payload.reply_to, "owner@example.com");
  assert.match((f.calls[0].options.headers as Record<string, string>)["Idempotency-Key"], /-confirmation$/);
});

test("missing owner recipient records a configuration failure while confirmation may still send", async () => {
  const f = sender([accepted()], { RESEND_API_KEY: "key", PORTAL_EMAIL_FROM: "portal@example.com" });
  assert.equal((await f.sendInquiryNotification(input)).status, "not_configured");
  assert.equal(f.calls.length, 0);
  assert.equal((await f.sendInquiryConfirmation(input)).status, "accepted");
  const payload = JSON.parse(f.calls[0].options.body as string);
  assert.equal(payload.reply_to, undefined);
  assert.doesNotMatch(payload.html, /reply directly/);
});

test("missing provider credentials never attempts to send", async () => {
  const f = sender([], {});
  assert.equal((await f.sendInquiryNotification(input)).status, "not_configured");
  assert.equal((await f.sendInquiryConfirmation(input)).status, "not_configured");
  assert.equal(f.calls.length, 0);
});

test("permanent provider rejections are not retried or logged with raw personal data", async () => {
  for (const status of [401, 403, 422]) {
    const f = sender([new Response("private-provider-response", { status })]);
    const result = await f.sendInquiryNotification(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.providerStatus, status);
    assert.doesNotMatch(JSON.stringify(result), /private-provider-response/);
    assert.equal(f.calls.length, 1);
  }
});

test("temporary rate limits, service errors and network errors retry with the identical payload and key", async () => {
  for (const response of [new Response("limited", { status: 429 }), new Response("unavailable", { status: 503 }), new Error("timeout after acceptance")]) {
    const f = sender([response, accepted()]);
    assert.equal((await f.sendInquiryNotification(input)).status, "accepted");
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[0].options.body, f.calls[1].options.body);
    assert.deepEqual(plain(f.calls[0].options.headers), plain(f.calls[1].options.headers));
  }
});

test("long provider backoffs are recorded without holding the public form open", async () => {
  const f = sender([new Response("limited", { status: 429, headers: { "retry-after": "30" } })]);
  const result = await f.sendInquiryNotification(input);
  assert.equal(result.status, "rejected");
  assert.equal(result.providerStatus, 429);
  assert.equal(f.calls.length, 1);
});

test("exhausted timeouts and provider outages remain unknown, not delivered", async () => {
  for (const responses of [[new Error("timeout"), new Error("timeout")], [new Response("down", { status: 503 }), new Response("down", { status: 503 })]]) {
    const f = sender(responses);
    assert.equal((await f.sendInquiryNotification(input)).status, "unknown");
    assert.equal(f.calls.length, 2);
  }
});

test("an OK response without a provider receipt is not claimed as accepted", async () => {
  const f = sender([Response.json({})]);
  assert.equal((await f.sendInquiryNotification(input)).status, "unknown");
  assert.equal(f.calls.length, 1);
});

function delivery(notification: () => Promise<unknown>, confirmation: () => Promise<unknown>, auditFails = false) {
  const activities: any[] = [];
  const errors: any[] = [];
  const loaded = load("./inquiry-delivery.ts", {
    "server-only": {},
    "@/lib/prisma": { prisma: { inquiryActivity: { create: async ({ data }: any) => { if (auditFails) throw new Error("audit down"); activities.push(data); } } } },
    "./inquiry-notifications": { sendInquiryNotification: notification, sendInquiryConfirmation: confirmation },
  }, { console: { error: (...args: unknown[]) => errors.push(args) } });
  return { deliverInquiryEmails: loaded.deliverInquiryEmails, activities, errors };
}

test("delivery persists independent notification and confirmation statuses in inquiry Activity", async () => {
  const f = delivery(async () => ({ status: "rejected", reason: "Sender rejected.", providerStatus: 403 }), async () => ({ status: "accepted", providerMessageId: "receipt" }));
  await f.deliverInquiryEmails(input);
  assert.equal(f.activities.length, 2);
  const owner = f.activities.find(a => a.metadata.kind === "notification");
  assert.equal(owner.action, "INQUIRY_EMAIL_REJECTED");
  assert.match(owner.summary, /Owner notification was rejected/);
  const customer = f.activities.find(a => a.metadata.kind === "confirmation");
  assert.equal(customer.metadata.providerMessageId, "receipt");
  assert.match(customer.summary, /Inbox delivery is not yet confirmed/);
  assert.equal(f.errors.length, 1);
  assert.doesNotMatch(JSON.stringify(f.errors), /submitter@example.com|Sample|synthetic-key/);
});

test("unexpected send exceptions are visible and do not suppress the other email", async () => {
  const f = delivery(async () => { throw new Error("exception with private data"); }, async () => ({ status: "accepted", providerMessageId: "receipt" }));
  await f.deliverInquiryEmails(input);
  assert.equal(f.activities.length, 2);
  assert.equal(f.activities.find(a => a.metadata.kind === "notification").action, "INQUIRY_EMAIL_UNKNOWN");
  assert.doesNotMatch(JSON.stringify(f.errors), /private data/);
});

test("a failed audit write does not fail the already saved inquiry", async () => {
  const f = delivery(async () => ({ status: "accepted" }), async () => ({ status: "accepted" }), true);
  await assert.doesNotReject(() => f.deliverInquiryEmails(input));
  assert.equal(f.errors.length, 2);
});

function route(deliver: (input: any) => Promise<void>) {
  let saved = false;
  const events: string[] = [];
  const loaded = load("../app/api/inquiries/route.ts", {
    "node:crypto": { createHmac },
    "next/server": { NextResponse: Response },
    "@/lib/prisma": { prisma: {
      inquiry: { count: async () => 0, create: async () => { saved = true; events.push("saved"); return { id: input.inquiryId }; } },
      service: { findMany: async () => [] },
    } },
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "synthetic-workspace" },
    "@/lib/inquiry-delivery": { deliverInquiryEmails: async (data: any) => { assert.equal(saved, true); events.push("delivery"); await deliver(data); } },
  }, { console: { error: () => {} } });
  const request = (overrides: Record<string, unknown> = {}) => new Request("https://example.com/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sample", email: input.email, consent: true, renderedAt: Date.now() - 5000, ctaName: "General Contact", ...overrides }),
  });
  return { POST: loaded.POST, events, request };
}

test("public submission saves first, awaits notification processing and still succeeds on delivery errors", async () => {
  const f = route(async (data) => { assert.equal(data.kind, "general contact message"); assert.equal(data.inquiryId, input.inquiryId); throw new Error("email unavailable"); });
  const response = await f.POST(f.request());
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, inquiryId: input.inquiryId });
  assert.deepEqual(f.events, ["saved", "delivery"]);
});

test("invalid submissions never save an inquiry or send email", async () => {
  const f = route(async () => { throw new Error("must not deliver"); });
  assert.equal((await f.POST(f.request({ email: "invalid" }))).status, 400);
  assert.deepEqual(f.events, []);
});

test("the protected pipeline shows configuration health and no secrets", () => {
  const source = readFileSync(new URL("../app/admin/inquiries/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getInquiryEmailConfig/);
  assert.match(source, /Inquiry email alerts need attention/);
  assert.match(source, /emailConfig\.issues/);
  assert.doesNotMatch(source, /emailConfig\.apiKey|JSON\.stringify\(emailConfig/);
});
