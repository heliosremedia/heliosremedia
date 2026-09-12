import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { newsletterRecordedTotals, reviewNewsletterDelivery } from "./delivery-review-core.ts";

const recipient = { id: "recipient", status: "FAILED", providerMessageId: null as string | null, sentAt: null as Date | null, _count: { events: 0, resendWebhookEvents: 0 } };
const accepted = { revisionId: "revision", status: "ACCEPTED", recipientIds: ["recipient"], providerReceiptIds: ["receipt"] };

test("delivery review separates acceptance evidence, unresolved attempts and historical records without authorizing retry", () => {
  const review = (attempts: typeof accepted[], row = recipient) => reviewNewsletterDelivery({ revisionId: "revision", recipients: [row], attempts });
  const valid = review([accepted]);
  assert.equal(valid.automaticRetryAllowed, false); assert.equal(valid.recipients[0].observation, "ACCEPTED_EVIDENCE"); assert.equal(valid.recipients[0].needsRecipientRecordRepair, true);
  assert.equal(review([accepted], { ...recipient, status: "SENT", providerMessageId: "receipt" }).recipients[0].needsRecipientRecordRepair, false);
  assert.equal(review([accepted], { ...recipient, providerMessageId: "different" }).recipients[0].observation, "RECEIPT_CONFLICT");
  assert.equal(review([accepted, { ...accepted, providerReceiptIds: ["second"] }]).recipients[0].observation, "RECEIPT_CONFLICT");
  for (const status of ["PREPARED", "UNCERTAIN"]) {
    const result = review([accepted, { ...accepted, status }]);
    assert.equal(result.recipients[0].observation, "UNCERTAIN"); assert.equal(result.recipients[0].needsRecipientRecordRepair, false);
  }
  assert.equal(review([accepted], { ...recipient, _count: { events: 1, resendWebhookEvents: 0 } }).recipients[0].needsRecipientRecordRepair, false);
  assert.equal(review([accepted], { ...recipient, _count: { events: 0, resendWebhookEvents: 1 } }).recipients[0].needsRecipientRecordRepair, false);
  assert.equal(review([accepted], { ...recipient, providerMessageId: "receipt", status: "FAILED" }).recipients[0].needsRecipientRecordRepair, false);
  assert.equal(review([accepted], { ...recipient, sentAt: new Date() }).recipients[0].needsRecipientRecordRepair, false);
  assert.equal(review([]).recipients[0].observation, "NO_RECORDED_ATTEMPT");
  assert.equal(review([], { ...recipient, status: "SENT" }).recipients[0].observation, "HISTORICAL_SEND_RECORD");
  assert.equal(review([{ ...accepted, status: "REJECTED" }]).recipients[0].observation, "REJECTED_ONLY");
  assert.equal(JSON.stringify(valid).includes('"receipt"'), false);
});

test("invalid attempt evidence blocks repair suggestions instead of silently discarding conflicts", () => {
  for (const attempt of [
    { ...accepted, revisionId: "foreign" }, { ...accepted, recipientIds: ["foreign"] },
    { ...accepted, providerReceiptIds: [] }, { ...accepted, status: "UNKNOWN" },
    { ...accepted, recipientIds: ["recipient", "recipient"], providerReceiptIds: ["one", "two"] },
  ]) {
    const result = reviewNewsletterDelivery({ revisionId: "revision", recipients: [recipient], attempts: [accepted, attempt] });
    assert.equal(result.invalidAttempts, 1); assert.equal(result.recipients[0].observation, "INVALID_EVIDENCE"); assert.equal(result.recipients[0].needsRecipientRecordRepair, false);
  }
});

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("delivery review authorizes before scoped reads and rejects mismatched campaign, revision or attempt ownership", async () => {
  let permitted = true;
  let found = true;
  let revision = true;
  let foreign = 0;
  let owner = "a";
  let reads = 0;
  const actor = { workspaceId: "a", userId: "actor", sessionVersion: 1 };
  const tx = {
    newsletterEdition: { findFirst: async ({ where, select }: { where: { id: string; series: { workspaceId: string } }; select: { delivery: { select: { attempts: { where: { workspaceId: string } } } } } }) => {
      reads++; assert.equal(where.id, "edition"); assert.equal(where.series.workspaceId, "a"); assert.equal(select.delivery.select.attempts.where.workspaceId, "a");
      return found ? { id: "edition", status: "SENDING", rowVersion: 5, delivery: { revisionId: "revision", campaign: { workspaceId: owner, recipients: [recipient] }, attempts: [accepted] } } : null;
    } },
    newsletterRevision: { findFirst: async () => revision ? { id: "revision" } : null },
    newsletterDeliveryAttempt: { count: async () => foreign },
  };
  const api = load<{ getNewsletterDeliveryReview: (id: string, actor: unknown) => Promise<unknown> }>("./delivery-review.ts", {
    "server-only": {}, "./delivery-review-core": { newsletterRecordedTotals, reviewNewsletterDelivery },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async (_tx: unknown, captured: typeof actor) => {
      assert.equal(captured.workspaceId, "a"); actor.workspaceId = "changed"; if (!permitted) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
    } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "RepeatableRead"); return callback(tx); } } },
  });
  const get = () => { actor.workspaceId = "a"; return api.getNewsletterDeliveryReview("edition", actor); };
  await get(); permitted = false; const before = reads; await assert.rejects(get(), /FORBIDDEN/); assert.equal(reads, before); permitted = true;
  found = false; assert.equal(await get(), null); found = true;
  owner = "b"; await assert.rejects(get(), /OWNERSHIP_UNRESOLVED/); owner = "a";
  revision = false; await assert.rejects(get(), /OWNERSHIP_UNRESOLVED/); revision = true;
  foreign = 1; await assert.rejects(get(), /OWNERSHIP_UNRESOLVED/);
});

test("delivery review GET uses session ownership, disables caching and bounds failures", async () => {
  let allowed = true;
  let failure = "";
  let missing = false;
  let calls = 0;
  const api = load<{ GET: (request: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/delivery-review/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => allowed ? { workspaceId: "a" } : null, forbiddenNewsletterResponse: () => Response.json({}, { status: 403 }) },
    "@/lib/newsletters/delivery-review": { getNewsletterDeliveryReview: async (id: string, actor: { workspaceId: string }) => {
      calls++; assert.equal(id, "edition"); assert.equal(actor.workspaceId, "a"); if (failure) throw new Error(failure); return missing ? null : { delivery: { automaticRetryAllowed: false } };
    } },
  });
  const get = () => api.GET(new Request("https://studio.example?workspaceId=b"), { params: Promise.resolve({ editionId: "edition" }) });
  const response = await get(); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  allowed = false; const before = calls; assert.equal((await get()).status, 403); assert.equal(calls, before); allowed = true;
  missing = true; assert.equal((await get()).status, 404); missing = false;
  failure = "WORKSPACE_WRITE_FORBIDDEN"; assert.equal((await get()).status, 403);
  failure = "internal details must not escape"; const conflict = await get(); assert.equal(conflict.status, 409); assert.equal((await conflict.text()).includes(failure), false);
});

test("accepted-record repair uses fresh access, scoped version locks, conditional writes and mandatory audit without sending", async () => {
  let allowed = true;
  let locked = true;
  let changed = false;
  let auditFails = false;
  let updates = 0;
  let audits = 0;
  const row = { ...recipient, sentAt: null as Date | null };
  const attempt = { ...accepted, id: "attempt", updatedAt: new Date("2026-09-12T00:00:00Z") };
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      assert.match(sql.join("?"), /FOR UPDATE OF edition/); assert.deepEqual(values, ["edition", 5, "a", false]); return locked ? [{ id: "edition" }] : [];
    },
    newsletterEdition: { findFirst: async () => ({ id: "edition", rowVersion: 5, status: "SENDING", delivery: { campaignId: "campaign", revisionId: "revision", campaign: { workspaceId: "a", recipients: [row] }, attempts: [attempt] } }) },
    newsletterRevision: { findFirst: async () => ({ id: "revision" }) },
    newsletterDeliveryAttempt: { count: async () => 0 },
    campaignRecipient: { updateMany: async ({ where, data }: { where: { id: string; campaignId: string; providerMessageId: string | null; status: string; sentAt: Date | null; events: { none: object }; resendWebhookEvents: { none: object } }; data: { status: string; providerMessageId: string; sentAt: Date } }) => {
      updates++; assert.equal(where.campaignId, "campaign"); assert.equal(where.id, "recipient"); assert.equal(where.providerMessageId, row.providerMessageId); assert.equal(where.status, row.status); assert.equal(where.sentAt, row.sentAt); assert.equal(Object.keys(where.events.none).length, 0); assert.equal(Object.keys(where.resendWebhookEvents.none).length, 0);
      if (changed) return { count: 0 }; Object.assign(row, data); return { count: 1 };
    } },
    auditEvent: { create: async ({ data }: { data: { workspaceId: string; actorId: string; metadata: { providerCalled: boolean; recipientIds: string[] } } }) => {
      audits++; assert.equal(data.workspaceId, "a"); assert.equal(data.actorId, "actor"); assert.equal(data.metadata.providerCalled, false); assert.deepEqual(Array.from(data.metadata.recipientIds), ["recipient"]);
      if (auditFails) throw new Error("Audit unavailable"); return {};
    } },
  };
  const api = load<{ repairNewsletterAcceptedRecords: (id: string, version: number, actor: unknown) => Promise<{ repaired: number; editionStatus: string; automaticRetryAllowed: boolean }> }>("./delivery-review.ts", {
    "server-only": {}, "./delivery-review-core": { newsletterRecordedTotals, reviewNewsletterDelivery },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) } },
  });
  const repair = () => api.repairNewsletterAcceptedRecords("edition", 5, { workspaceId: "a", userId: "actor", sessionVersion: 1 });
  const reset = () => Object.assign(row, recipient, { sentAt: null });
  const result = await repair(); assert.equal(result.repaired, 1); assert.equal(result.editionStatus, "SENDING"); assert.equal(result.automaticRetryAllowed, false); assert.equal(row.providerMessageId, "receipt"); assert.equal(row.sentAt, attempt.updatedAt);
  assert.equal((await repair()).repaired, 0); assert.equal(updates, 1); assert.equal(audits, 1);
  reset(); allowed = false; await assert.rejects(repair(), /FORBIDDEN/); assert.equal(updates, 1); allowed = true;
  locked = false; await assert.rejects(repair(), /REVIEW_CHANGED/); assert.equal(updates, 1); locked = true;
  row.providerMessageId = "conflicting"; assert.equal((await repair()).repaired, 0); reset();
  attempt.status = "UNCERTAIN"; assert.equal((await repair()).repaired, 0); attempt.status = "ACCEPTED";
  row.status = "SKIPPED"; assert.equal((await repair()).repaired, 0); reset();
  changed = true; await assert.rejects(repair(), /REVIEW_CHANGED/); assert.equal(audits, 1); changed = false;
  auditFails = true; await assert.rejects(repair(), /Audit unavailable/);
});

test("repair POST requires explicit confirmation and passes only the reviewed version and session actor", async () => {
  let calls = 0;
  let failure = "";
  const api = load<{ POST: (request: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/delivery-review/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ workspaceId: "a" }), forbiddenNewsletterResponse: () => Response.json({}, { status: 403 }) },
    "@/lib/newsletters/delivery-review": { repairNewsletterAcceptedRecords: async (id: string, version: number, actor: { workspaceId: string }) => {
      calls++; assert.equal(id, "edition"); assert.equal(version, 5); assert.equal(actor.workspaceId, "a"); if (failure) throw new Error(failure); return { repaired: 1, automaticRetryAllowed: false };
    } },
  });
  const post = (confirmation: string) => api.POST(new Request("https://studio.example", { method: "POST", body: JSON.stringify({ confirmation, expectedVersion: 5, workspaceId: "b" }) }), { params: Promise.resolve({ editionId: "edition" }) });
  assert.equal((await post("wrong")).status, 400); assert.equal(calls, 0);
  assert.equal((await post("REPAIR_ACCEPTED_DELIVERY_RECORDS")).status, 200);
  failure = "WORKSPACE_WRITE_FORBIDDEN"; assert.equal((await post("REPAIR_ACCEPTED_DELIVERY_RECORDS")).status, 403);
  failure = "NEWSLETTER_DELIVERY_REVIEW_CHANGED"; assert.equal((await post("REPAIR_ACCEPTED_DELIVERY_RECORDS")).status, 409);
});

test("recorded totals keep pending and skipped recipients separate from sent and failed records", () => {
  assert.deepEqual(newsletterRecordedTotals(["SENT", "FAILED", "PENDING", "SKIPPED", "SENT"].map(status => ({ status }))), {
    recipientCount: 5, sentCount: 2, failedCount: 1, pendingCount: 1, skippedCount: 1,
  });
  assert.throws(() => newsletterRecordedTotals([{ status: "UNKNOWN" }]), /RECORDS_INVALID/);
});

test("totals reconciliation requires owned locked evidence, no claimed work, conditional aggregate writes and an atomic audit", async () => {
  let allowed = true;
  let locked = true;
  let busy = false;
  let changed = false;
  let auditFails = false;
  let updates = 0;
  let audits = 0;
  const attempt = { ...accepted, id: "attempt", updatedAt: new Date() };
  const campaign = { workspaceId: "a", rowVersion: 3, recipientCount: 0, sentCount: 0, failedCount: 0,
    recipients: [{ ...recipient, status: "SENT", providerMessageId: "receipt", sentAt: new Date() }],
  };
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const query = sql.join("?"); assert.match(query, /FOR UPDATE/);
      if (query.includes('SELECT edition.id')) { assert.deepEqual(values, ["edition", 5, "a", false]); return locked ? [{ id: "edition" }] : []; }
      if (query.includes('"EmailCampaign"')) assert.deepEqual(values, ["campaign", "a"]);
      else assert.deepEqual(values, ["campaign"]);
      return [{ id: "row" }];
    },
    newsletterEdition: { findFirst: async () => ({ id: "edition", status: "SENDING", rowVersion: 5, delivery: { campaignId: "campaign", revisionId: "revision", campaign, attempts: [attempt] } }) },
    newsletterRevision: { findFirst: async () => ({ id: "revision" }) },
    newsletterDeliveryAttempt: { count: async () => 0 },
    newsletterJob: { findFirst: async ({ where }: { where: { editionId: string; status: string } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.status, "CLAIMED"); return busy ? { id: "job" } : null; } },
    emailCampaign: { updateMany: async ({ where, data }: { where: { workspaceId: string; id: string; rowVersion: number; sentCount: number }; data: { recipientCount: number; sentCount: number; failedCount: number; rowVersion: { increment: number } } }) => {
      updates++; assert.equal(where.workspaceId, "a"); assert.equal(where.id, "campaign"); assert.equal(where.rowVersion, campaign.rowVersion); assert.equal(where.sentCount, campaign.sentCount);
      assert.deepEqual(Object.keys(data).sort(), ["failedCount", "recipientCount", "rowVersion", "sentCount"]);
      if (changed) return { count: 0 };
      Object.assign(campaign, { recipientCount: data.recipientCount, sentCount: data.sentCount, failedCount: data.failedCount, rowVersion: campaign.rowVersion + 1 }); return { count: 1 };
    } },
    auditEvent: { create: async ({ data }: { data: { workspaceId: string; metadata: { providerCalled: boolean; previous: { sentCount: number }; totals: { sentCount: number } } } }) => {
      audits++; assert.equal(data.workspaceId, "a"); assert.equal(data.metadata.providerCalled, false); assert.equal(data.metadata.previous.sentCount, 0); assert.equal(data.metadata.totals.sentCount, 1);
      if (auditFails) throw new Error("Audit unavailable"); return {};
    } },
  };
  const api = load<{ reconcileNewsletterDeliveryTotals: (id: string, version: number, actor: unknown) => Promise<{ changed: boolean; editionStatus: string; automaticRetryAllowed: boolean }> }>("./delivery-review.ts", {
    "server-only": {}, "./delivery-review-core": { newsletterRecordedTotals, reviewNewsletterDelivery },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) } },
  });
  const reconcile = () => api.reconcileNewsletterDeliveryTotals("edition", 5, { workspaceId: "a", userId: "actor", sessionVersion: 1 });
  const result = await reconcile(); assert.equal(result.changed, true); assert.equal(result.editionStatus, "SENDING"); assert.equal(result.automaticRetryAllowed, false);
  assert.equal((await reconcile()).changed, false); assert.equal(updates, 1); assert.equal(audits, 1);
  campaign.sentCount = 0;
  allowed = false; await assert.rejects(reconcile(), /FORBIDDEN/); allowed = true;
  locked = false; await assert.rejects(reconcile(), /REVIEW_CHANGED/); locked = true;
  busy = true; await assert.rejects(reconcile(), /BUSY/); busy = false;
  attempt.status = "PREPARED"; await assert.rejects(reconcile(), /RECONCILIATION_REQUIRED/); attempt.status = "ACCEPTED";
  assert.equal(updates, 1);
  changed = true; await assert.rejects(reconcile(), /REVIEW_CHANGED/); assert.equal(audits, 1); changed = false;
  auditFails = true; await assert.rejects(reconcile(), /Audit unavailable/);
});

test("totals POST uses trusted actor and reviewed version while ignoring submitted aggregate values", async () => {
  let calls = 0;
  const api = load<{ POST: (request: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/delivery-review/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ workspaceId: "a" }), forbiddenNewsletterResponse: () => Response.json({}, { status: 403 }) },
    "@/lib/newsletters/delivery-review": { reconcileNewsletterDeliveryTotals: async (id: string, version: number, actor: { workspaceId: string }) => {
      calls++; assert.equal(id, "edition"); assert.equal(version, 5); assert.equal(actor.workspaceId, "a"); return { changed: true, automaticRetryAllowed: false };
    } },
  });
  const response = await api.POST(new Request("https://studio.example", { method: "POST", body: JSON.stringify({ confirmation: "RECONCILE_DELIVERY_TOTALS", expectedVersion: 5, workspaceId: "b", sentCount: 999 }) }), { params: Promise.resolve({ editionId: "edition" }) });
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal((await response.json()).automaticRetryAllowed, false);
});
