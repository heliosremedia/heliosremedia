import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("ownership compatibility excludes ownerless rows unless the installation has one matching company", async () => {
  let enabled = true;
  let rows = [{ id: "a" }];
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
  };
  const exports: { getContentOwnershipScope?: (id: string) => Promise<unknown> } = {};
  const source = readFileSync(new URL("./blog-ownership.ts", import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  const scope = async (id: string) => JSON.parse(JSON.stringify(await exports.getContentOwnershipScope!(id)));
  assert.deepEqual(await scope("a"), { workspaceId: "a" });
  enabled = false;
  assert.deepEqual(await scope("a"), { OR: [{ workspaceId: "a" }, { workspaceId: null }] });
  assert.deepEqual(await scope("b"), { workspaceId: "b" });
  rows = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(await scope("a"), { workspaceId: "a" });
  await assert.rejects(exports.getContentOwnershipScope!(""));
});

test("Newsletter ownership expansion preserves legacy rows and never follows a creator's workspace", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, "createdById" TEXT, name TEXT);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('editor','a');
      INSERT INTO "NewsletterSeries" VALUES ('legacy','editor','Existing');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911150000_newsletter_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "NewsletterSeries" (id,"createdById",name,"workspaceId") VALUES ('owned','editor','New','a');
      UPDATE "AdminUser" SET "workspaceId"='b' WHERE id='editor';
      INSERT INTO "NewsletterSeries" (id,name) VALUES ('old-app','Old writer');`);
    assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "NewsletterSeries" WHERE id='owned'`)).rows, [{ workspaceId: "a" }]);
    assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "NewsletterSeries" WHERE id='legacy'`)).rows, [{ workspaceId: null }]);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
    await assert.rejects(db.exec(`UPDATE "NewsletterSeries" SET "workspaceId"='missing' WHERE id='owned'`), /foreign key/i);
  } finally { await db.close(); }
});
