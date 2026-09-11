import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("legal editing requires administrator access and binds document/settings mutations to one company", async () => {
  for (const role of [null, "EDITOR", "ADMIN"]) {
    let writes = 0;
    const exports: { PATCH?: (request: Request) => Promise<Response> } = {};
    const modules: Record<string, unknown> = {
      "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/auth/session": { getAdminSession: async () => role ? { role, workspaceId: "a" } : null },
      "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/site-settings-ownership": { getSiteSettingsWriteTarget: async () => ({ where: { workspaceId: "a" }, createIdentity: { id: "workspace:a", workspaceId: "a" } }) },
      "@/lib/legal-html": { sanitizeLegalHtml: (html: string) => html },
      "@/lib/prisma": { prisma: {
        legalDocument: { upsert: async ({ where, create }: { where: { AND: Array<{ workspaceId: string }> }; create: { workspaceId: string } }) => { assert.equal(where.AND[0].workspaceId, "a"); assert.equal(create.workspaceId, "a"); writes++; return { id: "legal" }; } },
        siteSettings: { upsert: async ({ where, create }: { where: { workspaceId: string }; create: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(create.workspaceId, "a"); writes++; } },
        $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
      } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/legal-documents/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, console, require: (id: string) => modules[id] });
    const response = await exports.PATCH!(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ type: "PRIVACY_POLICY", title: "Privacy", content: "Draft text", published: false }) }));
    assert.equal(response.status, role === "ADMIN" ? 200 : 403);
    assert.equal(writes, role === "ADMIN" ? 2 : 0);
  }
});

test("published legal content excludes a foreign company's document", async () => {
  const exports: { getPublishedLegalDocument?: (type: string) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { legalDocument: { findFirst: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => {
      assert.equal(where.AND[0].workspaceId, "a");
      return [{ workspaceId: "b", content: "Foreign copy" }].find(row => row.workspaceId === where.AND[0].workspaceId) ?? null;
    } } } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./legal-documents.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  assert.equal(await exports.getPublishedLegalDocument!("PRIVACY_POLICY"), null);
});

test("legal migration preserves published text and old writes while restricting workspace deletion", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "LegalDocument" (id TEXT PRIMARY KEY, content TEXT); INSERT INTO "LegalDocument" VALUES ('legacy','Original copy');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911190000_legal_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "LegalDocument" (id,content) VALUES ('old-app','Old writer'); INSERT INTO "LegalDocument" (id,"workspaceId") VALUES ('owned','a');`);
    const row = (await db.query<{ content: string; workspaceId: string | null }>(`SELECT content,"workspaceId" FROM "LegalDocument" WHERE id='legacy'`)).rows[0];
    assert.equal(row.content, "Original copy"); assert.equal(row.workspaceId, null);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
