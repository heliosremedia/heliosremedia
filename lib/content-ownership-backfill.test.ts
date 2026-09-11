import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const backfill = readFileSync(new URL("../scripts/migrations/backfill-content-ownership.sql", import.meta.url), "utf8");
test("explicit ownership backfill is atomic, rejects conflicting references and preserves content", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "BlogPost" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "seriesId" TEXT, "featuredMediaId" TEXT, content TEXT, "featuredImageStorageKey" TEXT);
      CREATE TABLE "BlogSeries" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "NewsletterImageAsset" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "storageKey" TEXT);
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "Project" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
      CREATE TABLE "Media" (id TEXT PRIMARY KEY, "projectId" TEXT);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      INSERT INTO "BlogSeries" VALUES ('series',NULL);
      INSERT INTO "BlogPost" VALUES ('post',NULL,'series','image','Preserve this text',NULL);
      INSERT INTO "NewsletterSeries" VALUES ('newsletter',NULL);
      INSERT INTO "Project" VALUES ('project','b');
      INSERT INTO "Media" VALUES ('image','project');`);
    await assert.rejects(db.exec(backfill), /Verified content ownership mapping is required/);
    await db.exec('ROLLBACK');
    await db.exec(`CREATE TEMP TABLE "ContentOwnershipMapping" (kind TEXT NOT NULL,id TEXT NOT NULL,"workspaceId" TEXT NOT NULL,PRIMARY KEY(kind,id));
      INSERT INTO "ContentOwnershipMapping" VALUES ('BlogSeries','series','b'),('BlogPost','post','b');`);
    await assert.rejects(db.exec(backfill), /Incomplete content ownership mapping/);
    await db.exec('ROLLBACK');
    assert.equal((await db.query<{ workspaceId: string | null }>(`SELECT "workspaceId" FROM "BlogPost"`)).rows[0].workspaceId, null);
    await db.exec(`INSERT INTO "ContentOwnershipMapping" VALUES ('NewsletterSeries','newsletter','a');
      UPDATE "ContentOwnershipMapping" SET "workspaceId"='a' WHERE kind='BlogPost';`);
    await assert.rejects(db.exec(backfill), /post and series ownership mismatch/);
    await db.exec('ROLLBACK');
    await db.exec(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='a' WHERE kind='BlogSeries';`);
    await assert.rejects(db.exec(backfill), /featured media ownership mismatch/);
    await db.exec('ROLLBACK');
    await db.exec(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='b' WHERE kind IN ('BlogPost','BlogSeries');`);
    await db.exec(`INSERT INTO "NewsletterImageAsset" VALUES ('generated',NULL,'legacy-ai.webp');
      UPDATE "BlogPost" SET "featuredImageStorageKey"='legacy-ai.webp';
      INSERT INTO "ContentOwnershipMapping" VALUES ('NewsletterImageAsset','generated','a');`);
    await assert.rejects(db.exec(backfill), /generated image ownership mismatch/);
    await db.exec('ROLLBACK');
    await db.exec(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='b' WHERE kind='NewsletterImageAsset';`);
    await db.exec(backfill);
    assert.deepEqual((await db.query(`SELECT "workspaceId", content FROM "BlogPost"`)).rows, [{ workspaceId: 'b', content: 'Preserve this text' }]);
    await db.exec(backfill); // idempotent verified mapping
    await db.exec(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='a' WHERE kind='BlogPost';`);
    await assert.rejects(db.exec(backfill), /changes existing ownership/);
    await db.exec('ROLLBACK');
  } finally { await db.close(); }
});
