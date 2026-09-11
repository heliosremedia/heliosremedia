import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "@/app/generated/prisma/client";
import { checkLockedAccountMutation } from "./workspace-account-mutation.ts";

test("locked account authorization reads current PostgreSQL state before allowing a mutation", async () => {
  const db = new PGlite();
  const previous = process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED;
  const session = { userId: "owner", workspaceId: "a", sessionVersion: 1 };
  const change = { role: null, active: null, password: false };
  try {
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = "true";
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "Workspace", role TEXT NOT NULL, active BOOLEAN NOT NULL, "sessionVersion" INTEGER NOT NULL);
      CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "userId" TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('owner','a','OWNER',true,1), ('editor','a','EDITOR',true,1), ('foreign','b','EDITOR',true,1);
      INSERT INTO "WorkspaceMembership" VALUES ('m1','a','owner','OWNER','ACTIVE'), ('m2','a','editor','EDITOR','ACTIVE'), ('m3','b','foreign','EDITOR','ACTIVE');
    `);
    // A narrow SQL adapter exercises the production authorization function with
    // real PostgreSQL reads/locks. It does not simulate the Prisma transport.
    const run = async (target: string, overrides = {}, who = session) => db.transaction(async sql => {
      const tx = {
        $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
          const query = parts.reduce((out, part, i) => out + (i ? '$' + i : '') + part, '');
          return (await sql.query(query, values)).rows;
        },
        adminUser: { findFirst: async ({where}: {where:{id:string;workspaceId:string}}) =>
          (await sql.query('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2', [where.id,where.workspaceId])).rows[0] ?? null },
        workspaceMembership: { findUnique: async ({where}: {where:{workspaceId_userId:{workspaceId:string;userId:string}}}) => {
          const key = where.workspaceId_userId;
          return (await sql.query('SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2', [key.userId,key.workspaceId])).rows[0] ?? null;
        } },
      } as unknown as Prisma.TransactionClient;
      return checkLockedAccountMutation(tx, who, target, {...change,...overrides});
    });
    assert.equal(await run("editor"), null);
    assert.match(await run("foreign") ?? "", /access changed/);
    assert.equal(await run("editor", {transfer:true}), null);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='REVOKED' WHERE "userId"='editor'`);
    assert.match(await run("editor", {transfer:true}) ?? "", /active workspace member/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE',role='OWNER' WHERE "userId"='editor'`);
    assert.match(await run("editor", {active:false}) ?? "", /cannot be deactivated/);
    await db.exec(`UPDATE "WorkspaceMembership" SET role='ADMIN' WHERE "userId"='owner'`);
    assert.match(await run("editor") ?? "", /Only an owner/);
    assert.match(await run("editor", {transfer:true}) ?? "", /current owner/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='REVOKED' WHERE "userId"='owner'`);
    assert.match(await run("editor") ?? "", /administrator access/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE',role='OWNER' WHERE "userId"='owner'; UPDATE "AdminUser" SET "sessionVersion"=2 WHERE id='owner'`);
    assert.match(await run("editor") ?? "", /access changed/);
    process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = "false";
    await db.exec('DROP TABLE "WorkspaceMembership"');
    assert.equal(await run("editor", {}, {...session,sessionVersion:2}), null, "legacy mode does not require migrated tables");
    await db.exec(`UPDATE "AdminUser" SET active=false WHERE id='owner'`);
    assert.match(await run("editor", {}, {...session,sessionVersion:2}) ?? "", /administrator access/);
  } finally {
    if(previous === undefined) delete process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED;
    else process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED = previous;
    await db.close();
  }
});
