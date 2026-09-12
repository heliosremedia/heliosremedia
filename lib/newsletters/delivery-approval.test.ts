import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as guards from "./delivery-approval.ts";
import * as integrity from "./integrity.ts";
import * as recipientIdentity from "./recipient-identity.ts";
import { contentHash } from "./content-hash.ts";

function fixture() {
  const sendAt = new Date("2027-01-01");
  const blocks = [{ type: "HERO", heading: "Approved heading", body: "Approved body" }];
  const hash = contentHash({ subject: "Approved subject", previewText: "Preview", blocks });
  const campaign = { id: "campaign", workspaceId: "a", subject: "Approved subject", previewText: "Preview", body: JSON.stringify({ newsletterEditionId: "edition", revisionId: "revision", blocks }), recipients: [{ id: "recipient", clientId: "client", email: "client@example.test", status: "FAILED" }] };
  const delivery = { editionId: "edition", revisionId: "revision", campaignId: "campaign", contentHash: hash, campaign };
  return {
    id: "edition", currentRevisionNumber: 1, rowVersion: 4, intendedSendAt: sendAt, status: "SCHEDULED", createdById: "actor",
    series: { status: "ACTIVE", workspaceId: "a", senderName: "Company A" }, approvedRevisionId: "revision",
    approvedRevision: { id: "revision", editionId: "edition", revisionNumber: 1, subject: "Approved subject", previewText: "Preview", blocksSnapshot: blocks, contentHash: hash },
    approvals: [{ id: "approval", editionId: "edition", revisionId: "revision", approvedSendAt: sendAt, revokedAt: null as Date | null, recipientSelectionSnapshot: { mode: "ALL", workspaceId: "a" }, estimatedEligibleCount: 1, estimatedExcludedCount: 0 }],
    delivery: null as typeof delivery | null, retry: delivery,
  };
}

test("approval references require the current edition, revision, approval and intended date", () => {
  const mutations = [
    (row: ReturnType<typeof fixture>) => { row.approvedRevision.editionId = "foreign"; },
    (row: ReturnType<typeof fixture>) => { row.approvals[0].editionId = "foreign"; },
    (row: ReturnType<typeof fixture>) => { row.approvals[0].revisionId = "old"; },
    (row: ReturnType<typeof fixture>) => { row.currentRevisionNumber = 2; },
    (row: ReturnType<typeof fixture>) => { row.approvals[0].revokedAt = new Date(); },
    (row: ReturnType<typeof fixture>) => { row.intendedSendAt = new Date("2027-02-01"); },
  ];
  const check = (row: ReturnType<typeof fixture>) => guards.assertNewsletterApprovalReferences({ editionId: row.id, currentRevisionNumber: row.currentRevisionNumber, intendedSendAt: row.intendedSendAt, approvedRevisionId: row.approvedRevisionId, revision: row.approvedRevision, approval: row.approvals[0] });
  check(fixture());
  for (const mutate of mutations) { const row = fixture(); mutate(row); assert.throws(() => check(row), /no longer matches/); }
});

test("retry binding rejects foreign campaigns, altered subjects and hashes while accepting verified legacy hashes", () => {
  const row = fixture();
  const check = () => guards.assertNewsletterDeliveryBinding({ editionId: row.id, revisionId: row.approvedRevisionId, subject: row.approvedRevision.subject, previewText: row.approvedRevision.previewText, verifiedHashes: [row.approvedRevision.contentHash, "a".repeat(64)], delivery: row.retry });
  check(); row.retry.contentHash = "A".repeat(64); check();
  row.retry.contentHash = "bad"; assert.throws(check, /no longer matches/); row.retry.contentHash = row.approvedRevision.contentHash;
  row.retry.campaign.subject = "Unapproved subject"; assert.throws(check, /no longer matches/); row.retry.campaign.subject = row.approvedRevision.subject;
  row.retry.campaign.body = JSON.stringify({ newsletterEditionId: "foreign", revisionId: "revision" }); assert.throws(check, /no longer matches/);
});

class FakeEmailDeliveryError extends Error {
  provider = null;
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

function deliveryHarness(row: ReturnType<typeof fixture>, claim = true, denyAt = 0, excludeAt = 0, persistenceFails = false, incompleteReceipt = false, providerError?: Error) {
  let recipients = 0;
  let providerCalls = 0;
  let tokens = 0;
  let creations = 0;
  let checks = 0;
  const skipped: string[] = [];
  let markedFailed = 0;
  const actor = { workspaceId: "a", userId: "actor", sessionVersion: 1 };
  const exports: { deliverApprovedNewsletter?: (id: string, context: unknown) => Promise<{ status: string; sent: number }> } = {};
  const tx = {
    newsletterEdition: { updateMany: async ({ where }: { where: { rowVersion: number; intendedSendAt: Date; series: { workspaceId: string }; approvals: { some: { id: string; revisionId: string; revokedAt: null } } } }) => {
      if (where.rowVersion === 5) return { count: 1 };
      assert.equal(where.rowVersion, 4); assert.equal(where.intendedSendAt.getTime(), row.intendedSendAt.getTime()); assert.equal(where.series.workspaceId, "a"); assert.equal(where.approvals.some.id, "approval"); assert.equal(where.approvals.some.revisionId, "revision"); assert.equal(where.approvals.some.revokedAt, null); return { count: claim ? 1 : 0 };
    }, findFirst: async () => ({ id: row.id }) },
    newsletterJob: { updateMany: async () => ({ count: 1 }) },
    emailCampaign: { update: async () => ({}), create: async () => { creations++; return row.retry.campaign; } },
    newsletterDelivery: { update: async () => ({}), create: async () => ({ id: "delivery" }) },
  };
  const modules: Record<string, unknown> = {
    "./delivery-access": { requireNewsletterDeliveryAccess: async (_tx: unknown, id: string, workspaceId: string, date: Date, context: { actor: typeof actor }) => {
      checks++; assert.equal(id, "edition"); assert.equal(workspaceId, "a"); assert.equal(context.actor.workspaceId, "a"); assert.equal(date.getTime(), row.intendedSendAt.getTime());
      actor.workspaceId = "changed-after-start";
      if (checks === denyAt) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
    } },
    "server-only": {}, "node:crypto": crypto, "./delivery-approval": guards, "./recipient-identity": recipientIdentity,
    "@/lib/client-communications/campaign-ownership": { resolveCampaignWorkspace: async () => "a" },
    "@/lib/newsletters/ownership": { requireNewsletterApprovalWorkspace: async () => "a" },
    "@/lib/newsletters/integrity": integrity,
    "@/lib/newsletters/recipients": { resolveEligibleNewsletterRecipients: async () => { recipients++; return { eligible: row.retry.campaign.recipients.filter((_recipient, index) => recipients !== excludeAt || index !== row.retry.campaign.recipients.length - 1).map(recipient => ({ id: recipient.clientId, email: recipient.email, normalizedEmail: recipient.email, displayName: "Client" })) }; } },
    "@/lib/client-communications/preferences": { createPreferenceToken: async () => { tokens++; return "test-token"; } },
    "@/lib/site": { getSiteUrl: () => "https://company-a.example" },
    "@/lib/newsletters/email-renderer": { renderNewsletterEmail: ({ blocks }: { blocks: { body: string }[] }) => { assert.equal(blocks[0].body, "Approved body"); return "<p>Approved body</p>"; } },
    "@/lib/client-communications/email": { EmailDeliveryError: FakeEmailDeliveryError, sendCampaignBatch: async (input: { campaignId: string; revisionKey: string; messages: { subject: string }[] }) => {
      providerCalls++; if (providerError) throw providerError; assert.match(input.campaignId, /^campaign:newsletter:[a-f0-9]{24}$/); assert.equal(input.revisionKey, "revision"); assert.equal(input.messages[0].subject, "Approved subject"); return incompleteReceipt ? [] : input.messages.map(() => ({ id: "fake-message" }));
    } },
    "@/lib/prisma": { prisma: {
      $transaction: async (operation: unknown) => typeof operation === "function" ? operation(tx) : Promise.all(operation as Promise<unknown>[]),
      newsletterEdition: { findUnique: async () => row, update: async () => ({}) },
      emailCampaign: { update: async () => ({}) }, newsletterDelivery: { update: async () => ({}) },
      campaignRecipient: { update: async () => { if (persistenceFails) throw new Error("Database unavailable after acceptance"); return {}; }, updateMany: async ({ where, data }: { where: { campaignId: string; id: { in: string[] }; status: { in: string[] } }; data: { status: string } }) => {
        if (data.status === "FAILED") markedFailed++;
        if (data.status === "SKIPPED") { assert.equal(where.campaignId, "campaign"); assert.deepEqual(Array.from(where.status.in), ["PENDING", "FAILED"]); skipped.push(...where.id.in); }
        return { count: where.id.in.length };
      } },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./delivery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { send: () => exports.deliverApprovedNewsletter!("edition", { kind: "ADMIN", actor }), skipped: () => skipped, markedFailed: () => markedFailed, counts: () => ({ recipients, providerCalls, tokens, creations }) };
}

test("actual delivery rejects invalid approval/retry links before recipients or provider effects", async () => {
  for (const scenario of ["revision", "campaign", "claim"]) {
    const row = fixture();
    if (scenario === "revision") row.approvedRevision.editionId = "foreign";
    if (scenario === "campaign") { row.delivery = row.retry; row.delivery.revisionId = "other-revision"; }
    const h = deliveryHarness(row, scenario !== "claim");
    await assert.rejects(h.send(), /no longer matches|already claimed/);
    assert.deepEqual(h.counts(), { recipients: scenario === "claim" ? 1 : 0, providerCalls: 0, tokens: 0, creations: 0 });
  }
});

test("approved first delivery and retry retain payloads and idempotency with a fake provider", async () => {
  for (const scenario of ["first", "retry", "legacy-retry"]) {
    const retry = scenario !== "first";
    const row = fixture(); if (retry) { row.delivery = row.retry; row.status = "SEND_FAILED"; }
    if (scenario === "legacy-retry") {
      const legacyHash = crypto.createHash("sha256").update(JSON.stringify({ subject: row.approvedRevision.subject, previewText: row.approvedRevision.previewText, blocks: row.approvedRevision.blocksSnapshot })).digest("hex");
      row.approvedRevision.contentHash = legacyHash; row.retry.contentHash = legacyHash;
    }
    const h = deliveryHarness(row);
    const result = await h.send();
    assert.equal(result.status, "SENT"); assert.equal(result.sent, 1);
    assert.deepEqual(h.counts(), { recipients: 2, providerCalls: 1, tokens: 1, creations: retry ? 0 : 1 });
  }
});


test("delivery authorization is fresh before eligibility, claim and provider execution", async () => {
  for (const retry of [false, true]) for (const denyAt of [1, 2, 3]) {
    const row = fixture(); if (retry) { row.delivery = row.retry; row.status = "SEND_FAILED"; }
    const h = deliveryHarness(row, true, denyAt);
    await assert.rejects(h.send(), /FORBIDDEN/);
    assert.equal(h.counts().providerCalls, 0); assert.equal(h.counts().tokens, 0);
    assert.equal(h.counts().recipients, denyAt === 1 ? 0 : 1);
    assert.equal(h.counts().creations, !retry && denyAt === 3 ? 1 : 0);
  }
});

test("active sends cannot be retried and a lost retry claim never calls the provider", async () => {
  const row = fixture(); row.delivery = row.retry; row.status = "SENDING";
  const active = deliveryHarness(row);
  await assert.rejects(active.send(), /safely retryable/); assert.equal(active.counts().providerCalls, 0);
  row.status = "SEND_FAILED";
  const lost = deliveryHarness(row, false);
  await assert.rejects(lost.send(), /already claimed/); assert.equal(lost.counts().providerCalls, 0); assert.equal(lost.counts().creations, 0);
});


test("delivery refreshes recipient eligibility between batches and skips removed recipients before token creation", async () => {
  const row = fixture(); row.delivery = row.retry; row.status = "SEND_FAILED";
  row.retry.campaign.recipients = Array.from({ length: 101 }, (_, index) => ({ id: `recipient-${index}`, clientId: `client-${index}`, email: `client-${index}@example.test`, status: "FAILED" }));
  const h = deliveryHarness(row, true, 0, 3);
  const result = await h.send();
  assert.equal(result.sent, 100); assert.equal(result.status, "SENT");
  assert.deepEqual(h.counts(), { recipients: 3, providerCalls: 1, tokens: 100, creations: 0 });
  assert.deepEqual(h.skipped(), ["recipient-100"]);
});

test("eligibility removed before the first batch prevents tokens and provider calls", async () => {
  const row = fixture(); const h = deliveryHarness(row, true, 0, 2);
  const result = await h.send(); assert.equal(result.sent, 0);
  assert.deepEqual(h.counts(), { recipients: 2, providerCalls: 0, tokens: 0, creations: 1 });
  assert.deepEqual(h.skipped(), ["recipient"]);
});


test("provider acceptance with failed persistence or incomplete receipts requires reconciliation instead of retry", async () => {
  for (const incompleteReceipt of [false, true]) {
    const h = deliveryHarness(fixture(), true, 0, 0, !incompleteReceipt, incompleteReceipt);
    await assert.rejects(h.send(), /RECONCILIATION_REQUIRED/);
    assert.equal(h.counts().providerCalls, 1); assert.equal(h.markedFailed(), 0);
  }
});


test("uncertain provider errors remain held while configuration failures are retryable without provider acceptance", async () => {
  const unknown = deliveryHarness(fixture(), true, 0, 0, false, false, new Error("Request timed out"));
  await assert.rejects(unknown.send(), /RECONCILIATION_REQUIRED/); assert.equal(unknown.markedFailed(), 0);
  for (const code of ["EMAIL_PROVIDER_NOT_CONFIGURED", "EMAIL_PROVIDER_SENDER"]) {
    const h = deliveryHarness(fixture(), true, 0, 0, false, false, new FakeEmailDeliveryError(code));
    assert.equal((await h.send()).status, "SEND_FAILED"); assert.equal(h.markedFailed(), 1);
  }
});
