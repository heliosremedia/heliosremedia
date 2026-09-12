import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { reviewNewsletterDelivery } from "./delivery-review-core.ts";

const recipient = { id: "recipient", status: "FAILED", providerMessageId: null as string | null };
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
    "server-only": {}, "./delivery-review-core": { reviewNewsletterDelivery },
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
