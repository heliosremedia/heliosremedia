import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as brandPolicy from "./workspace-brand-storage.ts";

function load(path: string, modules: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, URL, console: { error() {} }, require: (id: string) => modules[id] ?? {} });
  return exports;
}

test("About and team mutation routes reject missing permissions locally", async () => {
  for (const [path, methods] of [["about/route.ts", ["PATCH"]], ["about/presign/route.ts", ["POST"]], ["team-members/route.ts", ["POST", "PATCH", "DELETE"]], ["team-members/presign/route.ts", ["POST"]]] as const) {
    const loaded = load(`../app/api/admin/${path}`, {
      "@/lib/auth/session": { getAdminSession: async () => null },
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    });
    for (const method of methods) {
      const response = await loaded[method](new Request("http://localhost", { method, body: "{}" })) as Response;
      assert.equal(response.status, 403, path);
    }
  }
});

test("tenant About defaults contain no Helios founder copy or fallback images", async () => {
  let tenantMode = true;
  const loaded = load("./about-page.ts", {
    "@/lib/workspace-context-core": { tenantContextEnabled: () => tenantMode },
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { aboutPageContent: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return null; } } } },
  });
  const empty = await loaded.getAboutPageContent() as { founderEnabled: boolean; heroImageUrl: string | null };
  assert.equal(empty.heroImageUrl, null); assert.equal(empty.founderEnabled, false); assert.doesNotMatch(JSON.stringify(empty), /Helios|Jake|standard-8/);
  tenantMode = false;
  assert.match(JSON.stringify(await loaded.getAboutPageContent()), /Helios/);
});

test("team portrait creation rejects foreign keys before storage and derives owned URLs", async () => {
  for (const company of ["a", "b"]) {
    let writes = 0;
    let checks = 0;
    const loaded = load("../app/api/admin/team-members/route.ts", {
      "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a" }) },
      "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/workspace-brand-storage": brandPolicy,
      "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
      "@/lib/content-image-storage": { verifyContentImage: async () => { checks++; } },
      "@/lib/team-members": { teamMemberCategories: ["PRODUCTION"], teamMemberSelect: {} },
      "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/prisma": { prisma: { teamMember: { aggregate: async () => ({ _max: { displayOrder: null } }), create: async ({ data }: { data: { workspaceId: string; portraitUrl: string } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.portraitUrl, "https://assets.example/workspaces/a/team/portrait.jpg"); writes++; return { id: "profile" }; } } } },
    });
    const response = await loaded.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ name: "Person", title: "Photographer", biography: "Biography", portraitStorageKey: `workspaces/${company}/team/portrait.jpg`, portraitUrl: "https://forged.example/image.jpg" }) })) as Response;
    assert.equal(response.status, company === "a" ? 201 : 400); assert.equal(writes, company === "a" ? 1 : 0); assert.equal(checks, writes);
  }
});

test("About/team expansion preserves old content and supports independent singleton rows", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "AboutPageContent" (id TEXT PRIMARY KEY); CREATE TABLE "TeamMember" (id TEXT PRIMARY KEY);
      INSERT INTO "AboutPageContent" VALUES ('default'); INSERT INTO "TeamMember" VALUES ('legacy');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911220000_about_team_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "AboutPageContent" VALUES ('workspace:a','a'),('workspace:b','b'); INSERT INTO "TeamMember" (id) VALUES ('old-app');`);
    assert.equal((await db.query<{ workspaceId: string | null }>(`SELECT "workspaceId" FROM "AboutPageContent" WHERE id='default'`)).rows[0].workspaceId, null);
    await assert.rejects(db.exec(`INSERT INTO "AboutPageContent" VALUES ('duplicate','a')`));
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
