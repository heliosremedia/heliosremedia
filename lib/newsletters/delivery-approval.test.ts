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

function deliveryHarness(row: ReturnType<typeof fixture>, claim = true) {
  let recipients = 0;
  let providerCalls = 0;
  let tokens = 0;
  let creations = 0;
  const exports: { deliverApprovedNewsletter?: (id: string) => Promise<{ status: string; sent: number }> } = {};
  const tx = {
    newsletterEdition: { updateMany: async ({ where }: { where: { rowVersion: number; intendedSendAt: Date; series: { workspaceId: string }; approvals: { some: { id: string; revisionId: string; revokedAt: null } } } }) => {
      assert.equal(where.rowVersion, 4); assert.equal(where.intendedSendAt.getTime(), row.intendedSendAt.getTime()); assert.equal(where.series.workspaceId, "a"); assert.equal(where.approvals.some.id, "approval"); assert.equal(where.approvals.some.revisionId, "revision"); assert.equal(where.approvals.some.revokedAt, null); return { count: claim ? 1 : 0 };
    } },
    emailCampaign: { create: async () => { creations++; return row.retry.campaign; } },
    newsletterDelivery: { create: async () => ({ id: "delivery" }) },
  };
  const modules: Record<string, unknown> = {
    "server-only": {}, "node:crypto": crypto, "./delivery-approval": guards, "./recipient-identity": recipientIdentity,
    "@/lib/client-communications/campaign-ownership": { resolveCampaignWorkspace: async () => "a" },
    "@/lib/newsletters/ownership": { requireNewsletterApprovalWorkspace: async () => "a" },
    "@/lib/newsletters/integrity": integrity,
    "@/lib/newsletters/recipients": { resolveEligibleNewsletterRecipients: async () => { recipients++; return { eligible: [{ id: "client", email: "client@example.test", normalizedEmail: "client@example.test", displayName: "Client" }] }; } },
    "@/lib/client-communications/preferences": { createPreferenceToken: async () => { tokens++; return "test-token"; } },
    "@/lib/site": { getSiteUrl: () => "https://company-a.example" },
    "@/lib/newsletters/email-renderer": { renderNewsletterEmail: ({ blocks }: { blocks: { body: string }[] }) => { assert.equal(blocks[0].body, "Approved body"); return "<p>Approved body</p>"; } },
    "@/lib/client-communications/email": { sendCampaignBatch: async (input: { campaignId: string; revisionKey: string; messages: { subject: string }[] }) => {
      providerCalls++; assert.match(input.campaignId, /^campaign:newsletter:[a-f0-9]{24}$/); assert.equal(input.revisionKey, "revision"); assert.equal(input.messages[0].subject, "Approved subject"); return [{ id: "fake-message" }];
    } },
    "@/lib/prisma": { prisma: {
      $transaction: async (operation: unknown) => typeof operation === "function" ? operation(tx) : Promise.all(operation as Promise<unknown>[]),
      newsletterEdition: { findUnique: async () => row, update: async () => ({}) },
      emailCampaign: { update: async () => ({}) }, newsletterDelivery: { update: async () => ({}) },
      campaignRecipient: { update: async () => ({}), updateMany: async () => ({ count: 0 }) },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./delivery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { send: () => exports.deliverApprovedNewsletter!("edition"), counts: () => ({ recipients, providerCalls, tokens, creations }) };
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
    assert.deepEqual(h.counts(), { recipients: 1, providerCalls: 1, tokens: 1, creations: retry ? 0 : 1 });
  }
});
