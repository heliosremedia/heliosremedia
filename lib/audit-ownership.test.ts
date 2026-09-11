import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, console,
  });
  return exports as T;
}

test("audit writes preserve explicit context and leave unknown ownership unclassified", async () => {
  const events: Array<{ workspaceId: string | null }> = [];
  const api = load<{ recordAuditEvent: (event: Record<string, unknown>) => Promise<void> }>("./audit.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: { auditEvent: { create: async ({ data }: { data: { workspaceId: string | null } }) => { events.push(data); } } } },
  });
  await api.recordAuditEvent({ workspaceId: "a", actorId: "moved-user", action: "TEST", summary: "Company A event" });
  await api.recordAuditEvent({ actorId: "moved-user", metadata: { workspaceId: "b" }, action: "TEST", summary: "Unknown context" });
  assert.equal(events[0].workspaceId, "a");
  assert.equal(events[1].workspaceId, null);
});

test("activity log requires administrator access and selects stored company ownership", async () => {
  let role = "EDITOR";
  let reads = 0;
  const page = load<{ default: () => Promise<unknown> }>("../app/admin/activity/page.tsx", {
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
    "@/lib/auth/session": { requireAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { auditEvent: { findMany: async ({ where }: { where: { workspaceId: string; actor?: unknown } }) => {
      assert.equal(where.workspaceId, "a"); assert.equal(where.actor, undefined); reads++; return [];
    } } } },
  });
  await assert.rejects(page.default(), /NOT_FOUND/);
  assert.equal(reads, 0);
  role = "ADMIN";
  await page.default();
  assert.equal(reads, 1);
});

test("audit expansion preserves history and account movement cannot move event ownership", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "AuditEvent" (id TEXT PRIMARY KEY, "actorId" TEXT, "createdAt" TIMESTAMP, summary TEXT);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      INSERT INTO "AdminUser" VALUES ('actor','a');
      INSERT INTO "AuditEvent" VALUES ('legacy','actor',now(),'Preserved');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911233000_audit_event_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "AuditEvent" (id,"actorId","workspaceId",summary) VALUES ('owned','actor','a','Original event');
      UPDATE "AdminUser" SET "workspaceId"='b' WHERE id='actor';
      INSERT INTO "AuditEvent" (id,summary) VALUES ('old-writer','Old writer remains valid');`);
    assert.deepEqual((await db.query(`SELECT id FROM "AuditEvent" WHERE "workspaceId"='a'`)).rows, [{ id: 'owned' }]);
    assert.equal((await db.query(`SELECT id FROM "AuditEvent" WHERE "workspaceId"='b'`)).rows.length, 0);
    assert.deepEqual((await db.query(`SELECT summary,"workspaceId" FROM "AuditEvent" WHERE id='legacy'`)).rows, [{ summary: 'Preserved', workspaceId: null }]);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
  } finally { await db.close(); }
});
