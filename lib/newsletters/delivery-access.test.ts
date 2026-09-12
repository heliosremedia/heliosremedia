import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("delivery requires fresh administrator access or the edition's owned, due and unexpired SEND claim", async () => {
  let valid = true;
  let admin = true;
  let busy = false;
  let checks = 0;
  const date = new Date("2026-01-01");
  const tx = {
    $queryRaw: async () => [],
    newsletterJob: { findFirst: async ({ where }: { where: { id?: string; editionId: string; claimToken: string; type: string; status: string; dueAt: Date; AND: { dueAt: { lte: Date } }[]; leaseExpiresAt: { gt: Date }; edition: { series: { workspaceId: string } } } }) => {
      assert.equal(where.editionId, "edition"); assert.equal(where.type, "SEND"); assert.equal(where.status, "CLAIMED");
      if (!where.id) return busy ? { id: "other-job" } : null;
      assert.equal(where.id, "job"); assert.equal(where.claimToken, "claim"); assert.equal(where.dueAt, date);
      assert.ok(where.AND[0].dueAt.lte instanceof Date); assert.ok(where.leaseExpiresAt.gt instanceof Date); assert.equal(where.edition.series.workspaceId, "a");
      return valid ? { id: "job" } : null;
    } },
  };
  const exports: { requireNewsletterDeliveryAccess?: (tx: unknown, id: string, workspaceId: string, date: Date, context: unknown) => Promise<void> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { checks++; if (!admin) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./delivery-access.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const check = (context: unknown) => exports.requireNewsletterDeliveryAccess!(tx, "edition", "a", date, context);
  const background = { kind: "BACKGROUND", jobId: "job", claimToken: "claim" };
  await check(background); valid = false; await assert.rejects(check(background), /CLAIM_EXPIRED/);
  await assert.rejects(check({ kind: "BACKGROUND", jobId: "job" }), /FORBIDDEN/);
  await assert.rejects(check({ kind: "ADMIN", actor: { workspaceId: "b" } }), /FORBIDDEN/); assert.equal(checks, 0);
  const actor = { kind: "ADMIN", actor: { workspaceId: "a" } };
  await check(actor); busy = true; await assert.rejects(check(actor), /BUSY/);
  busy = false; admin = false; await assert.rejects(check(actor), /FORBIDDEN/);
});
