import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { ReferralPreparationClaim } from "./preparation-claim";

const claim: ReferralPreparationClaim = { workspaceId: "a", storedWorkspaceId: "a", campaignId: "campaign", revisionId: "revision", campaignVersion: 4, attemptId: "attempt", leaseExpiresAt: new Date(Date.now() + 60000) };
function fixture() {
  const state = { tenant: false, rows: [{ id: "a" }], current: { approvedRevision: { snapshot: { workspaceId: "a" } } } as unknown, queries: [] as Array<Record<string, unknown>>, locks: [] as string[] };
  const exports = {} as { lockReferralPreparationClaim: (tx: unknown, input: ReferralPreparationClaim) => Promise<void>; lockReferralPreparationSource: (tx: unknown, input: ReferralPreparationClaim) => Promise<void>; referralPreparationWhere: (input: ReferralPreparationClaim) => Record<string, unknown> };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./preparation-claim.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Error, require: (id: string) => { if (id === "server-only") return {}; assert.equal(id, "@/lib/workspace-context-core"); return { tenantContextEnabled: () => state.tenant }; } });
  const tx = { $queryRaw: async (sql: TemplateStringsArray) => { state.locks.push(sql.join("?")); }, $executeRaw: async (sql: TemplateStringsArray) => { state.locks.push(sql.join("?")); }, workspace: { findMany: async () => state.rows }, referralCampaign: { findFirst: async (query: Record<string, unknown>) => { state.queries.push(query); return state.current; } } };
  return { state, tx, api: exports };
}

test("batch source rechecks owned revision, exact lease and expiry after campaign lock", async () => {
  const f = fixture(); await f.api.lockReferralPreparationClaim(f.tx, claim);
  assert.match(f.state.locks[0], /"Workspace".*FOR UPDATE/); assert.match(f.state.locks[1], /LOCK TABLE "Workspace"/); assert.match(f.state.locks[3], /"ReferralCampaign".*FOR UPDATE/);
  const query = f.state.queries[0] as { where: Record<string, unknown> };
  assert.equal(query.where.workspaceId, "a"); assert.equal(query.where.rowVersion, 4); assert.equal(query.where.launchAttemptId, "attempt");
  assert.equal(query.where.approvedRevisionId, "revision"); assert.equal(query.where.launchRevisionId, "revision");
  assert.equal(JSON.stringify(query.where.approvedRevision), JSON.stringify({ id: "revision", campaignId: "campaign" }));
  const lease = query.where.launchLeaseExpiresAt as { equals: Date; gt: Date };
  assert.equal(lease.equals, claim.leaseExpiresAt); assert.ok(lease.gt instanceof Date);
});

test("batch wrapper preserves tenant-mode and multi-company execution containment", async () => {
  for (const kind of ["tenant", "multiple", "foreign"]) {
    const f = fixture(); if (kind === "tenant") f.state.tenant = true; else f.state.rows = kind === "multiple" ? [{ id: "a" }, { id: "b" }] : [{ id: "b" }];
    await assert.rejects(f.api.lockReferralPreparationClaim(f.tx, claim), /CONTAINED/); assert.equal(f.state.queries.length, 0);
  }
});

test("missing, malformed and foreign revision snapshots reject preparation", async () => {
  for (const current of [null, { approvedRevision: null }, ...[null, [], "bad", { workspaceId: "b" }].map(snapshot => ({ approvedRevision: { snapshot } }))]) {
    const f = fixture(); f.state.current = current;
    await assert.rejects(f.api.lockReferralPreparationSource(f.tx, claim), /CLAIM_EXPIRED/);
  }
});

test("foreign stored owner and null-owner compatibility cannot bypass company admission", async () => {
  const f = fixture(); await assert.rejects(f.api.lockReferralPreparationSource(f.tx, { ...claim, storedWorkspaceId: "b" }), /CLAIM_EXPIRED/);
  f.state.tenant = true; await assert.rejects(f.api.lockReferralPreparationSource(f.tx, { ...claim, storedWorkspaceId: null }), /CLAIM_EXPIRED/);
  f.state.tenant = false; f.state.rows = [{ id: "a" }, { id: "b" }]; await assert.rejects(f.api.lockReferralPreparationSource(f.tx, { ...claim, storedWorkspaceId: null }), /CLAIM_EXPIRED/);
  f.state.rows = [{ id: "a" }]; await f.api.lockReferralPreparationSource(f.tx, { ...claim, storedWorkspaceId: null });
});

test("settlement predicate retains lease identity and approved revision ownership", () => {
  const f = fixture(), where = f.api.referralPreparationWhere(claim);
  assert.equal(where.launchLeaseExpiresAt, claim.leaseExpiresAt); assert.equal(where.status, "LAUNCHING"); assert.equal(where.launchFailedAt, null);
  assert.equal(where.approvedRevisionId, "revision"); assert.equal(where.workspaceId, "a"); assert.equal(where.rowVersion, 4);
});

async function processorFixture(mode: "reject-batch" | "takeover" | "success") {
  const f = fixture();
  const { createHash } = await import("node:crypto");
  const contract = await import("./launch-contract.ts");
  const snapshot = { workspaceId: "a", audience: { eligible: [{ id: "client", displayName: "Synthetic", firstName: "Synthetic", email: "synthetic@example.test" }] } };
  const campaign = { id: "campaign", workspaceId: "a", rowVersion: 4, status: "LAUNCHING", launchAttemptId: "attempt", approvedRevisionId: "revision", launchRevisionId: "revision", approvedRevision: { id: "revision", campaignId: "campaign", snapshot }, expectedAdvocateCount: 1, preparedAdvocateCount: 0, launchBatch: 0, publicTitle: "Synthetic", referralExpirationDays: 10, invitationSubject: "Synthetic", invitationBody: "Synthetic" };
  let lease: Date, tokenWrites = 0, completed = 0, failedSettlements = 0, guards = 0;
  const tx = {
    referralCampaign: {
      findUnique: async () => campaign,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if ("OR" in where) { assert.equal(where.workspaceId, "a"); assert.equal(where.approvedRevisionId, "revision"); lease = data.launchLeaseExpiresAt as Date; return { count: 1 }; }
        assert.equal(where.launchLeaseExpiresAt, lease); assert.equal(where.workspaceId, "a"); assert.equal(where.rowVersion, 4); assert.equal(where.launchRevisionId, "revision");
        if ("launchBatch" in data) { if (mode === "takeover") return { count: 0 }; lease = data.launchLeaseExpiresAt as Date; }
        if ("launchCompletedAt" in data) completed++;
        if (data.launchFailedAt) { failedSettlements++; return { count: mode === "takeover" ? 0 : 1 }; }
        return { count: 1 };
      },
    },
    referralAuditEvent: { create: async () => ({}) },
    referralAdvocate: { upsert: async () => ({ id: "advocate" }), count: async () => 1 },
    referralInvitation: { findMany: async () => [], create: async () => ({ id: "invitation", body: "Synthetic", subject: "Synthetic" }), count: async () => 1 },
    referralLink: { create: async () => ({}) },
    marketingEmailPreference: { upsert: async () => ({ id: "preference" }) },
    marketingEmailPreferenceToken: { create: async () => { tokenWrites++; return {}; } },
    referralCommunication: { create: async () => ({}), count: async () => 1 },
  };
  const exports = {} as { processReferralLaunch: (id: string, attempt: string) => Promise<unknown> };
  const modules: Record<string, unknown> = {
    "server-only": {}, "node:crypto": { createHash }, "@/lib/blog-ownership": {}, "./ownership": { legacyReferralExecutionWorkspace: async () => "a" },
    "./preparation-claim": { referralPreparationWhere: f.api.referralPreparationWhere, lockReferralPreparationClaim: async (transaction: unknown, input: ReferralPreparationClaim) => { assert.equal(transaction, tx); assert.equal(input.leaseExpiresAt, lease); guards++; if (mode === "reject-batch") throw new Error("REFERRAL_PREPARATION_CLAIM_EXPIRED"); } },
    "@/app/generated/prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/prisma": { prisma: { ...tx, $transaction: async (fn: (db: unknown) => Promise<unknown>) => fn(tx) } },
    "@/lib/audit": {}, "@/lib/site": { getSiteUrl: () => "https://synthetic.example.test" },
    "@/lib/client-communications/preferences": { generatePreferenceToken: () => "synthetic", hashPreferenceToken: () => "hash", MARKETING_TOKEN_TTL_DAYS: 10 },
    "./email-renderer": { personalizeReferralCopy: (body: string) => body, renderReferralInvitationEmail: () => "synthetic html" },
    "./tokens": { createReferralCredentials: () => ({ token: "synthetic", tokenHash: "hash", code: "code" }) }, "./launch-contract": contract,
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./launch.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Error, console: { info() {}, error() {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { run: () => exports.processReferralLaunch("campaign", "attempt"), result: () => ({ tokenWrites, completed, failedSettlements, guards }) };
}

test("actual processor guards batch transaction before any token persistence", async () => {
  const f = await processorFixture("reject-batch"); await assert.rejects(f.run(), /CLAIM_EXPIRED/);
  assert.deepEqual(f.result(), { tokenWrites: 0, completed: 0, failedSettlements: 1, guards: 1 });
});

test("actual processor cannot complete or fail a replacement worker after progress lease loss", async () => {
  const f = await processorFixture("takeover"); await assert.rejects(f.run(), /lease changed/);
  assert.deepEqual(f.result(), { tokenWrites: 1, completed: 0, failedSettlements: 1, guards: 1 });
});

test("actual processor carries renewed lease into successful completion", async () => {
  const f = await processorFixture("success"); await f.run();
  assert.deepEqual(f.result(), { tokenWrites: 1, completed: 1, failedSettlements: 0, guards: 1 });
});
