import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const script = readFileSync(new URL("../scripts/migrations/backfill-brand-ownership.sql", import.meta.url), "utf8");

test("brand reconciliation is complete, immutable, relationship-safe and repeatable", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "Testimonial" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace");
      CREATE TABLE "TrustedLogo" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace");
      CREATE TABLE "GoogleBusinessReview" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "testimonialId" TEXT);
      INSERT INTO "Testimonial" VALUES ('legacy',NULL),('owned','a');
      INSERT INTO "TrustedLogo" VALUES ('logo',NULL);
      INSERT INTO "GoogleBusinessReview" VALUES ('review','b','legacy');`);
    const reject = async (pattern: RegExp) => {
      await assert.rejects(db.exec(script), pattern);
      await db.exec('ROLLBACK');
      assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "Testimonial" WHERE id='legacy'`)).rows, [{ workspaceId: null }]);
    };
    await reject(/Verified brand ownership mapping/);
    await db.exec(`CREATE TEMP TABLE "BrandOwnershipMapping" (kind TEXT, id TEXT, "workspaceId" TEXT, PRIMARY KEY(kind,id));
      INSERT INTO "BrandOwnershipMapping" VALUES ('Testimonial','legacy','b');`);
    await reject(/Incomplete/);
    await db.exec(`INSERT INTO "BrandOwnershipMapping" VALUES ('TrustedLogo','logo','a'),('Testimonial','owned','b');`);
    await reject(/reassignment/);
    await db.exec(`DELETE FROM "BrandOwnershipMapping" WHERE id='owned';
      UPDATE "BrandOwnershipMapping" SET "workspaceId"='a' WHERE id='legacy';`);
    await reject(/workspace mismatch/);
    await db.exec(`UPDATE "BrandOwnershipMapping" SET "workspaceId"='b' WHERE id='legacy';`);
    await db.exec(script);
    await db.exec(script);
    assert.deepEqual((await db.query(`SELECT id,"workspaceId" FROM "Testimonial" ORDER BY id`)).rows, [
      { id: 'legacy', workspaceId: 'b' }, { id: 'owned', workspaceId: 'a' },
    ]);
    assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "TrustedLogo"`)).rows, [{ workspaceId: 'a' }]);
  } finally { await db.close(); }
});
