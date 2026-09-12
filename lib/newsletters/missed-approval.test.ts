import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness() {
  let validClaim = true, owned = true, changed = 1, auditFails = false, approvalsFail = false;
  const writes: string[] = [];
  const edition = { status: "NEEDS_REVIEW", rowVersion: 7, intendedSendAt: new Date("2026-01-01T00:00:00Z"), series: { status: "ACTIVE" } };
  const context = { id: "job", editionId: "edition", claimToken: "token" };
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const query = parts.join("?"); assert.match(query, /FOR UPDATE/);
      if (query.includes('SELECT edition.id')) { assert.deepEqual(values, ["edition", "a", false]); return owned ? [{ id: "edition" }] : []; }
      assert.deepEqual(values, query.includes('"Workspace"') ? ["a"] : ["job", "edition"]); return [{ id: "row" }];
    },
    newsletterEdition: {
      findFirst: async ({ where }: { where: { id: string; series: { workspaceId: string } } }) => { assert.equal(where.id, "edition"); assert.equal(where.series.workspaceId, "a"); return edition; },
      updateMany: async ({ where, data }: { where: { rowVersion: number; status: string; intendedSendAt: Date; series: { workspaceId: string } }; data: { status: string; approvedRevisionId: null; rowVersion: { increment: number } } }) => {
        assert.equal(where.rowVersion, 7); assert.equal(where.status, edition.status); assert.equal(where.intendedSendAt, edition.intendedSendAt); assert.equal(where.series.workspaceId, "a");
        assert.equal(data.status, "MISSED_APPROVAL"); assert.equal(data.approvedRevisionId, null); assert.equal(data.rowVersion.increment, 1); writes.push("edition"); return { count: changed };
      },
    },
    newsletterJob: { findFirst: async ({ where }: { where: { id: string; editionId: string; claimToken: string; type: string; status: string; dueAt: Date; AND: Array<{ dueAt: { lte: Date } }>; leaseExpiresAt: { gt: Date } } }) => {
      assert.equal(where.id, "job"); assert.equal(where.editionId, "edition"); assert.equal(where.claimToken, "token"); assert.equal(where.type, "MISSED_APPROVAL"); assert.equal(where.status, "CLAIMED"); assert.equal(where.dueAt, edition.intendedSendAt); assert.equal(where.AND[0].dueAt.lte.getTime(), where.leaseExpiresAt.gt.getTime()); return validClaim ? { id: "job" } : null;
    } },
    newsletterApproval: { updateMany: async ({ where }: { where: { editionId: string; revokedAt: null } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.revokedAt, null); writes.push("approvals"); if (approvalsFail) throw new Error("Approval write failed"); } },
    auditEvent: { create: async ({ data }: { data: { workspaceId: string; metadata: { jobId: string; providerCalled: boolean } } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.metadata.jobId, "job"); assert.equal(data.metadata.providerCalled, false); writes.push("audit"); if (auditFails) throw new Error("Audit unavailable"); } },
  };
  const modules: Record<string, unknown> = {
    "server-only": {}, "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "./ownership": { resolveNewsletterWorkspace: async (id: string) => { assert.equal(id, "a"); context.claimToken = "changed"; return id; } },
    "@/lib/prisma": { prisma: {
      newsletterEdition: { findUnique: async () => ({ series: { workspaceId: "a" } }) },
      $transaction: async (fn: (db: typeof tx) => Promise<unknown>) => { const before = writes.length; try { return await fn(tx); } catch (error) { writes.splice(before); throw error; } },
    } },
  };
  const exports: { markNewsletterApprovalMissed?: (job: typeof context) => Promise<{ changed: boolean }> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL("./missed-approval.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { edition, writes, call: () => { context.claimToken = "token"; return exports.markNewsletterApprovalMissed!(context); },
    denyClaim: () => { validClaim = false; }, denyOwner: () => { owned = false; }, conflict: () => { changed = 0; }, failAudit: () => { auditFails = true; }, failApprovals: () => { approvalsFail = true; } };
}

test("missed approval captures its claim, locks stored company identity and commits status, revocation and audit together", async () => {
  const h = harness(); assert.equal((await h.call()).changed, true); assert.deepEqual(h.writes, ["edition", "approvals", "audit"]);
});

test("missed approval refuses stale claims and foreign ownership and preserves scheduled or inactive editions", async () => {
  for (const deny of ['denyClaim', 'denyOwner'] as const) { const h = harness(); h[deny](); await assert.rejects(h.call(), /CLAIM_EXPIRED/); assert.equal(h.writes.length, 0); }
  for (const status of ["SCHEDULED", "SENDING", "SENT", "CANCELLED", "MISSED_APPROVAL"]) { const h = harness(); h.edition.status = status; assert.equal((await h.call()).changed, false); assert.equal(h.writes.length, 0); }
  const h = harness(); h.edition.series.status = "PAUSED"; assert.equal((await h.call()).changed, false); assert.equal(h.writes.length, 0);
});

test("missed approval propagates conflicts and transaction failures without reporting success", async () => {
  for (const fail of ['conflict', 'failApprovals', 'failAudit'] as const) { const h = harness(); h[fail](); await assert.rejects(h.call()); assert.equal(h.writes.length, 0); }
});
