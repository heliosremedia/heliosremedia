import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadRoute(name: string, session: unknown, prisma: unknown) {
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const modules: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/prisma": { prisma },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/api/admin/${name}/route.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, console: { error() {} }, require: (id: string) => modules[id] });
  return exports;
}

test("every FAQ mutation rejects unauthenticated and viewer access before database work", async () => {
  for (const name of ["faqs", "faq-categories"]) for (const session of [null, { role: "VIEWER" }]) {
    const handlers = loadRoute(name, session, {});
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.equal((await handlers[method](new Request("http://localhost", { method, body: "{}" }))).status, 403);
    }
  }
});

test("FAQ creation and moves reject foreign destination and source categories", async () => {
  for (const scenario of ["foreign-destination", "foreign-source"]) {
    let writes = 0;
    const handlers = loadRoute("faqs", { role: "EDITOR", workspaceId: "a" }, {
      faqCategory: { findUnique: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => {
        assert.equal(where.AND[0].workspaceId, "a"); return scenario === "foreign-destination" ? null : { id: "category" };
      } },
      faq: {
        findUnique: async ({ where }: { where: { category: { workspaceId: string } } }) => { assert.equal(where.category.workspaceId, "a"); return null; },
        create: async () => { writes++; }, update: async () => { writes++; },
      },
    });
    const body = JSON.stringify({ action: "update", categoryId: "category", faqId: "faq", question: "Question?", answer: "Answer" });
    const response = await handlers.PATCH(new Request("http://localhost", { method: "PATCH", body }));
    assert.equal(response.status, scenario === "foreign-destination" ? 400 : 404);
    if (scenario === "foreign-destination") assert.equal((await handlers.POST(new Request("http://localhost", { method: "POST", body }))).status, 400);
    assert.equal(writes, 0);
  }
});

test("FAQ migration preserves historical categories and old writes with restricting ownership", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "FaqCategory" (id TEXT PRIMARY KEY); INSERT INTO "FaqCategory" VALUES ('legacy');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911180000_faq_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "FaqCategory" (id) VALUES ('old-app'); INSERT INTO "FaqCategory" (id,"workspaceId") VALUES ('own','a');`);
    assert.equal((await db.query<{ workspaceId: string | null }>(`SELECT "workspaceId" FROM "FaqCategory" WHERE id='legacy'`)).rows[0].workspaceId, null);
    await assert.rejects(db.exec(`INSERT INTO "FaqCategory" VALUES ('bad','missing')`));
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
