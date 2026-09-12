import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}
function harness() {
  let authorized = true, owned = true, expired = true, otherClaim = false, running = 1, conflict = "", auditFails = false;
  const changes: string[] = [];
  const snapshot = { workspaceId: "a", seriesId: "series", execution: { kind: "BACKGROUND", jobId: "job", editionVersion: 6 } };
  const run = { id: "run", status: "RUNNING", instructionsSnapshot: snapshot };
  const edition = { id: "edition", seriesId: "series", status: "GENERATING", rowVersion: 6, generationRuns: [run] };
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      assert.match(sql.join("?"), /FOR UPDATE/);
      if (sql.join("").includes('SELECT edition.id')) { assert.deepEqual(values, ["edition", "a", false]); return owned ? [{ id: "edition" }] : []; }
      assert.deepEqual(values, ["edition"]); return [{ id: "row" }];
    },
    newsletterEdition: {
      findFirst: async ({ where }: { where: { series: { workspaceId: string } } }) => { assert.equal(where.series.workspaceId, "a"); return edition; },
      updateMany: async ({ where, data }: { where: { rowVersion: number; status: string; series: { workspaceId: string } }; data: { status: string; approvedRevisionId: null; rowVersion: { increment: number } } }) => {
        assert.equal(where.rowVersion, 6); assert.equal(where.status, "GENERATING"); assert.equal(where.series.workspaceId, "a"); assert.equal(data.status, "NEEDS_REVIEW"); assert.equal(data.approvedRevisionId, null); assert.equal(data.rowVersion.increment, 1); changes.push("edition"); return { count: conflict === "edition" ? 0 : 1 };
      },
    },
    newsletterGenerationRun: {
      count: async () => running,
      updateMany: async ({ where }: { where: { id: string; editionId: string; status: string } }) => { assert.equal(where.id, "run"); assert.equal(where.editionId, "edition"); assert.equal(where.status, "RUNNING"); changes.push("run"); return { count: conflict === "run" ? 0 : 1 }; },
    },
    newsletterJob: {
      findFirst: async ({ where }: { where: { id?: unknown; editionId: string; status: string; type?: string; leaseExpiresAt?: { lte: Date } } }) => {
        assert.equal(where.editionId, "edition"); assert.equal(where.status, "CLAIMED");
        if (where.type) { assert.equal(where.type, "GENERATE"); assert.equal(where.id, snapshot.execution.jobId); assert.ok(where.leaseExpiresAt?.lte instanceof Date); return expired ? { id: "job" } : null; }
        return otherClaim ? { id: "other" } : null;
      },
      updateMany: async ({ where, data }: { where: { id?: string; editionId: string; type: string; status: string; leaseExpiresAt?: { lte: Date } }; data: { status: string; claimToken?: null; leaseExpiresAt?: null } }) => {
        assert.equal(where.editionId, "edition"); assert.equal(where.type, "GENERATE");
        if (where.status === "CLAIMED") { assert.equal(where.id, "job"); assert.ok(where.leaseExpiresAt?.lte); assert.equal(data.claimToken, null); assert.equal(data.leaseExpiresAt, null); assert.equal(data.status, "FAILED"); changes.push("job"); return { count: conflict === "job" ? 0 : 1 }; }
        assert.equal(where.status, "PENDING"); assert.equal(data.status, "CANCELLED"); changes.push("pending"); return { count: 1 };
      },
    },
    newsletterApproval: { updateMany: async ({ where }: { where: { editionId: string; revokedAt: null } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.revokedAt, null); changes.push("approvals"); } },
    auditEvent: { create: async ({ data }: { data: { workspaceId: string; actorId: string; metadata: { providerCalled: boolean } } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.actorId, "actor"); assert.equal(data.metadata.providerCalled, false); changes.push("audit"); if (auditFails) throw new Error("Audit unavailable"); } },
  };
  const api = load<{ recoverNewsletterGeneration: (id: string, version: number, runId: string, actor: unknown) => Promise<{ editionStatus: string; automaticRetryAllowed: boolean }>; getNewsletterGenerationRecovery: (id: string, actor: unknown) => Promise<{ eligible: boolean }> }>("./generation-recovery.ts", {
    "server-only": {}, "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { if (!authorized) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) } },
  });
  const actor = { workspaceId: "a", userId: "actor", sessionVersion: 1 };
  return { snapshot, edition, run, changes, review: () => api.getNewsletterGenerationRecovery("edition", actor), recover: (version = 6, runId = "run") => api.recoverNewsletterGeneration("edition", version, runId, actor),
    deny: () => { authorized = false; }, foreign: () => { owned = false; }, live: () => { expired = false; }, busy: () => { otherClaim = true; }, duplicate: () => { running = 2; }, conflict: (value: string) => { conflict = value; }, failAudit: () => { auditFails = true; } };
}

test("generation recovery requires current owned execution evidence and returns only expired background work to review", async () => {
  const h = harness(); assert.equal((await h.review()).eligible, true); assert.equal(h.changes.length, 0);
  const result = await h.recover(); assert.equal(result.editionStatus, "NEEDS_REVIEW"); assert.equal(result.automaticRetryAllowed, false);
  assert.deepEqual(h.changes, ["edition", "run", "job", "pending", "approvals", "audit"]);
});

test("generation recovery rejects foreign, live, ambiguous, administrator and stale executions before writes", async () => {
  for (const action of ['deny', 'foreign', 'live', 'busy', 'duplicate'] as const) { const h = harness(); h[action](); await assert.rejects(h.recover()); assert.equal(h.changes.length, 0); }
  const mutations = [(h: ReturnType<typeof harness>) => { Object.assign(h.run, { instructionsSnapshot: {} }); }, (h: ReturnType<typeof harness>) => { h.snapshot.workspaceId = "b"; }, (h: ReturnType<typeof harness>) => { h.snapshot.execution.kind = "ADMIN"; }, (h: ReturnType<typeof harness>) => { h.snapshot.execution.editionVersion = 5; }, (h: ReturnType<typeof harness>) => { h.snapshot.seriesId = "foreign"; }, (h: ReturnType<typeof harness>) => { h.run.status = "SUCCEEDED"; }, (h: ReturnType<typeof harness>) => { h.edition.status = "SENT"; }];
  for (const mutate of mutations) { const h = harness(); mutate(h); assert.equal((await h.review()).eligible, false); await assert.rejects(h.recover()); assert.equal(h.changes.length, 0); }
  for (const [version, run] of [[5, 'run'], [6, 'foreign']] as const) { const h = harness(); await assert.rejects(h.recover(version, run)); assert.equal(h.changes.length, 0); }
});

test("generation recovery fails on conditional-write and mandatory-audit errors", async () => {
  for (const entity of ['edition', 'run', 'job']) { const h = harness(); h.conflict(entity); await assert.rejects(h.recover(), /RECOVERY_CHANGED/); assert.equal(h.changes.includes('audit'), false); }
  const h = harness(); h.failAudit(); await assert.rejects(h.recover(), /Audit unavailable/);
});

test("recovery API uses session ownership and requires explicit reviewed identity", async () => {
  let allowed = true, calls = 0;
  const api = load<{ POST: (request: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/generation-recovery/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => allowed ? { workspaceId: "a" } : null, forbiddenNewsletterResponse: () => Response.json({}, { status: 403 }) },
    "@/lib/newsletters/generation-recovery": { recoverNewsletterGeneration: async (id: string, version: number, run: string, actor: { workspaceId: string }) => { calls++; assert.equal(id, "edition"); assert.equal(version, 6); assert.equal(run, "run"); assert.equal(actor.workspaceId, "a"); return { automaticRetryAllowed: false }; } },
  });
  const post = (confirmation: string) => api.POST(new Request('https://synthetic.invalid', { method: 'POST', body: JSON.stringify({ confirmation, expectedVersion: 6, runId: 'run', workspaceId: 'foreign' }) }), { params: Promise.resolve({ editionId: 'edition' }) });
  assert.equal((await post('wrong')).status, 400); assert.equal(calls, 0);
  allowed = false; assert.equal((await post('RETURN_EXPIRED_GENERATION_TO_REVIEW')).status, 403); assert.equal(calls, 0); allowed = true;
  const result = await post('RETURN_EXPIRED_GENERATION_TO_REVIEW'); assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'private, no-store'); assert.equal(calls, 1);
});
