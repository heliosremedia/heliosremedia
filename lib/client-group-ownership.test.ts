import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("group membership route rejects foreign groups and mixed-company batches before mutations", async () => {
  for (const scenario of ["foreign-group", "foreign-client", "system", "own", "bounce-remove"]) {
    let writes = 0;
    const exports: { PATCH?: (request: Request) => Promise<Response> } = {};
    const modules: Record<string, unknown> = {
      "next/cache": { revalidatePath() {} },
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/audit": { recordAuditEvent: async () => {} },
      "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", workspaceId: "a", userId: "admin" }) },
      "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/client-communications/bounce-core": { bouncedBackSystemKey: (id: string) => `BOUNCED_BACK:${id}`, isBouncedBackSystemKey: (key: string) => key?.startsWith("BOUNCED_BACK:") },
      "@/lib/prisma": { prisma: {
        communicationGroup: { findUnique: async ({ where }: { where: { OR: Array<{ workspaceId?: string }> } }) => {
          assert.equal(where.OR[0].workspaceId, "a");
          return scenario === "foreign-group" ? null : { id: "g", name: "group", systemManaged: ["system", "bounce-remove"].includes(scenario), systemKey: scenario === "bounce-remove" ? "BOUNCED_BACK:a" : "SYSTEM" };
        } },
        communicationClient: { findMany: async ({ where }: { where: { workspaceMemberships: { some: { workspaceId: string } } } }) => {
          assert.equal(where.workspaceMemberships.some.workspaceId, "a");
          return scenario === "foreign-client" ? [{ id: "one" }] : [{ id: "one" }, { id: "two" }];
        } },
        communicationGroupMembership: {
          createMany: async () => { writes++; return { count: 2 }; },
          deleteMany: async () => { writes++; return { count: 2 }; },
        },
      } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/client-groups/memberships/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => modules[id] });
    const response = await exports.PATCH!(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ groupId: "g", clientIds: ["one", "two"], operation: scenario === "bounce-remove" ? "remove" : "add" }) }));
    const allowed = ["own", "bounce-remove"].includes(scenario);
    assert.equal(response.status, allowed ? 200 : scenario === "system" ? 409 : 404, scenario);
    assert.equal(writes, allowed ? 1 : 0, scenario);
  }
});


test("group expand migration preserves old writes and enforces owned workspace references", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "CommunicationGroup" (id TEXT PRIMARY KEY, "systemKey" TEXT);
      INSERT INTO "CommunicationGroup" VALUES ('legacy','MARKETING_UNSUBSCRIBED');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911170000_communication_group_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "CommunicationGroup" (id) VALUES ('old-app');
      INSERT INTO "CommunicationGroup" (id,"workspaceId") VALUES ('new-app','a');`);
    const result = await db.query<{ workspaceId: string | null }>(`SELECT "workspaceId" FROM "CommunicationGroup" WHERE id='legacy'`);
    assert.equal(result.rows[0].workspaceId, null);
    await assert.rejects(db.exec(`INSERT INTO "CommunicationGroup" (id,"workspaceId") VALUES ('foreign','missing')`));
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
