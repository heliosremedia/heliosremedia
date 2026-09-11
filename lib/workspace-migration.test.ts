import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../prisma/migrations/20260910050000_workspace_tenant_foundation/migration.sql", import.meta.url), "utf8");
test("tenant migration executes on PostgreSQL with two companies and preserves legacy rows", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "AdminRole" AS ENUM ('OWNER','ADMIN','EDITOR','VIEWER');
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id), role "AdminRole" NOT NULL, active BOOLEAN NOT NULL);
      INSERT INTO "Workspace" VALUES ('company-a'), ('company-b');
      INSERT INTO "AdminUser" VALUES ('alice','company-a','OWNER',true), ('bob','company-b','ADMIN',true), ('inactive','company-a','EDITOR',false);
    `);
    const before = (await db.query('SELECT * FROM "AdminUser" ORDER BY id')).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT * FROM "AdminUser" ORDER BY id')).rows, before);
    assert.deepEqual((await db.query('SELECT "userId", "workspaceId", status FROM "WorkspaceMembership" ORDER BY "userId"')).rows, [
      { userId: 'alice', workspaceId: 'company-a', status: 'ACTIVE' },
      { userId: 'bob', workspaceId: 'company-b', status: 'ACTIVE' },
      { userId: 'inactive', workspaceId: 'company-a', status: 'SUSPENDED' },
    ]);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='REVOKED' WHERE "userId"='alice'`);
    await db.exec(migration.slice(migration.indexOf('INSERT INTO "WorkspaceMembership"')));
    assert.equal((await db.query<{status:string}>(`SELECT status FROM "WorkspaceMembership" WHERE "userId"='alice'`)).rows[0].status, 'REVOKED');
    assert.equal((await db.query('SELECT * FROM "WorkspaceMembership"')).rows.length, 3);
    await assert.rejects(db.exec(`INSERT INTO "WorkspaceMembership" VALUES ('duplicate','company-a','alice','OWNER','ACTIVE',now(),now())`), /unique/i);
    await assert.rejects(db.exec(`INSERT INTO "WorkspaceMembership" VALUES ('orphan','missing','alice','OWNER','ACTIVE',now(),now())`), /foreign key/i);
    await db.exec(`INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,"primary","updatedAt") VALUES ('d1','company-a','a.example',true,now())`);
    await assert.rejects(db.exec(`INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,"updatedAt") VALUES ('d2','company-b','a.example',now())`), /unique/i);
    await assert.rejects(db.exec(`INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,"primary","updatedAt") VALUES ('d3','company-a','alias.example',true,now())`), /unique/i);
    await db.exec(`INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,"primary","updatedAt") VALUES ('d4','company-b','b.example',true,now())`);
    await assert.rejects(db.transaction(async tx => {
      await tx.exec(`UPDATE "AdminUser" SET role='VIEWER' WHERE id='bob'`);
      await tx.exec(`INSERT INTO "WorkspaceMembership" VALUES ('bad','missing','bob','OWNER','ACTIVE',now(),now())`);
    }));
    assert.equal((await db.query<{role:string}>(`SELECT role FROM "AdminUser" WHERE id='bob'`)).rows[0].role, 'ADMIN');
  } finally { await db.close(); }
});
