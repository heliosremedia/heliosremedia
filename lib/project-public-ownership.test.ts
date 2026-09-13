import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("public project query binds slug and preview to the resolved company and filters hero relations", async () => {
  const exports: { testGetProject?: (slug: string, preview?: string) => Promise<unknown> } = {};
  const queries: Array<{ where: { workspaceId: string; slug: string; id?: string }; select: Record<string, { where: { project: { workspaceId: string }; visibility: string } }> }> = [];
  const modules: Record<string, unknown> = {
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/project-preview": { validateProjectPreview: async (_slug: string, token: string) => token ? { projectId: "foreign-project" } : null },
    "@/lib/prisma": { prisma: { project: { findFirst: async (query: typeof queries[number]) => {
      queries.push(query);
      const rows = [{ id: "own-project", workspaceId: "a", slug: "home" }, { id: "foreign-project", workspaceId: "b", slug: "foreign" }];
      return rows.find(row => row.workspaceId === query.where.workspaceId && row.slug === query.where.slug && (!query.where.id || row.id === query.where.id)) ?? null;
    } } } },
  };
  const source = readFileSync(new URL("../app/(public)/portfolio/[slug]/page.tsx", import.meta.url), "utf8") + "\nexport { getProject as testGetProject };";
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (id: string) => modules[id] ?? {} });
  assert.ok(await exports.testGetProject!("home"));
  assert.equal(await exports.testGetProject!("foreign"), null);
  assert.equal(await exports.testGetProject!("foreign", "valid-foreign-preview"), null);
  for (const query of queries) {
    for (const relation of ["heroMedia", "socialImageMedia"]) {
      assert.equal(query.select[relation].where.project.workspaceId, "a");
      assert.equal(query.select[relation].where.visibility, "VISIBLE");
    }
  }
});

test("thumbnail repair reads and writes only the authenticated workspace", async () => {
  let updated = 0;
  const exports: { POST?: () => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", workspaceId: "a" }) },
    "@/lib/prisma": { prisma: {
      project: {
        findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return [{ id: "project", heroMedia: { id: "foreign", projectId: "other" }, media: [{ id: "own-media" }] }]; },
        updateMany: async ({ where, data }: { where: { workspaceId: string }; data: { thumbnailMediaId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(data.thumbnailMediaId, "own-media"); updated++; return { count: 1 }; },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/projects/repair-thumbnails/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => modules[id] });
  assert.equal((await exports.POST!()).status, 200);
  assert.equal(updated, 1);
});
