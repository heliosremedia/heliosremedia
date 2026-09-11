import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sql = readFileSync(new URL("../prisma/migrations/20260911140000_blog_workspace_expand/migration.sql", import.meta.url), "utf8");
test("Blog expansion preserves legacy writes, validates ownership and prevents workspace deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "BlogPost" (id TEXT PRIMARY KEY, slug TEXT UNIQUE, content TEXT);
      CREATE TABLE "BlogSeries" (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "BlogPost" VALUES ('legacy', 'legacy', 'Preserve exactly');
      INSERT INTO "BlogSeries" VALUES ('legacy-series', 'Existing schedule');`);
    await db.exec(sql);
    assert.deepEqual((await db.query(`SELECT content, "workspaceId" FROM "BlogPost" WHERE id='legacy'`)).rows, [{ content: "Preserve exactly", workspaceId: null }]);
    // Old application writes remain valid after expansion.
    await db.exec(`INSERT INTO "BlogPost" (id,slug,content) VALUES ('old-app','old-app','Legacy write');
      INSERT INTO "BlogSeries" (id,name) VALUES ('old-series','Legacy series');
      INSERT INTO "BlogPost" (id,slug,content,"workspaceId") VALUES ('owned','owned','New write','b');
      INSERT INTO "BlogSeries" (id,name,"workspaceId") VALUES ('owned-series','New series','a');`);
    await assert.rejects(db.exec(`INSERT INTO "BlogPost" (id,slug,"workspaceId") VALUES ('bad','bad','missing')`), /foreign key/i);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='b'`), /foreign key/i);
    await assert.rejects(db.exec(`INSERT INTO "BlogPost" (id,slug,"workspaceId") VALUES ('duplicate','owned','a')`), /unique/i);
    assert.equal((await db.query(`SELECT * FROM "BlogPost" WHERE "workspaceId"='b'`)).rows.length, 1);
  } finally { await db.close(); }
});
