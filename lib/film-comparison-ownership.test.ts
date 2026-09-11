import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { filmPosterMatchesWorkspace } from "./film-poster.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console,
  });
  return exports as T;
}

test("film classification rejects viewers, foreign relations and new unverified posters before mutations", async () => {
  let role = "VIEWER";
  let own = false;
  let offeringOwn = true;
  let writes = 0;
  let cleared = 0;
  let existing: { id: string; workspaceId: string; posterOverrideUrl: string | null; offering: { workspaceId: string } } | null = null;
  const tx = {
    $queryRaw: async (_query: unknown, workspaceId: string) => { assert.equal(workspaceId, "a"); return [{ id: "a" }]; },
    media: { findFirst: async ({ where }: { where: { projectId: string; project: { workspaceId: string } } }) => { assert.equal(where.projectId, "project"); assert.equal(where.project.workspaceId, "a"); return own ? { id: "media", comparisonPlacement: existing } : null; } },
    videoOffering: { findFirst: async ({ where }: { where: { workspaceId: string; active: boolean } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.active, true); return offeringOwn ? { id: "offering" } : null; } },
    videoComparisonPlacement: {
      updateMany: async ({ where }: { where: { workspaceId: string; media: { project: { workspaceId: string } } } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.media.project.workspaceId, "a"); cleared++; return { count: 1 }; },
      create: async ({ data }: { data: { workspaceId: string; mediaId: string } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.mediaId, "media"); writes++; return { id: "created" }; },
      update: async ({ where }: { where: { workspaceId: string; id: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.id, "placement"); writes++; return { id: "placement" }; },
      deleteMany: async ({ where }: { where: { workspaceId: string; offering: { workspaceId: string }; media: { project: { workspaceId: string } } } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.offering.workspaceId, "a"); assert.equal(where.media.project.workspaceId, "a"); writes++; return { count: 1 }; },
    },
  };
  const api = load<{ PATCH: (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> }>("../app/api/admin/projects/[projectId]/film-comparison/route.ts", {
    "@/lib/film-poster": { filmPosterMatchesWorkspace },
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (patch: Record<string, unknown> = {}) => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ mediaId: "media", offeringId: "offering", featuredExample: true, workspaceId: "b", ...patch }) }), { params: Promise.resolve({ projectId: "project" }) });
  assert.equal((await call()).status, 403); role = "EDITOR"; assert.equal((await call()).status, 404);
  own = true; existing = { id: "placement", workspaceId: "b", posterOverrideUrl: null, offering: { workspaceId: "a" } };
  assert.equal((await call()).status, 409); assert.equal((await call({ offeringId: null })).status, 409);
  existing.workspaceId = "a"; existing.offering.workspaceId = "b"; assert.equal((await call()).status, 409);
  existing = null; offeringOwn = false; assert.equal((await call()).status, 409);
  offeringOwn = true; assert.equal((await call({ posterOverrideUrl: "https://foreign.example.test/image.webp" })).status, 400);
  assert.equal(writes, 0); assert.equal(cleared, 0);
  assert.equal((await call()).status, 200); assert.equal(writes, 1); assert.equal(cleared, 1);
  existing = { id: "placement", workspaceId: "a", posterOverrideUrl: "https://existing.example.test/image.webp", offering: { workspaceId: "a" } };
  assert.equal((await call({ posterOverrideUrl: existing.posterOverrideUrl })).status, 200);
  assert.equal((await call({ offeringId: null })).status, 200); assert.equal(writes, 3);
});

test("film classification reads scope placement and offering ownership", async () => {
  const api = load<{ GET: (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> }>("../app/api/admin/projects/[projectId]/film-comparison/route.ts", {
    "@/lib/film-poster": { filmPosterMatchesWorkspace },
    "next/cache": {}, "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "VIEWER", workspaceId: "a" }) },
    "@/lib/prisma": { prisma: {
      project: { findFirst: async () => ({ id: "project" }) }, videoOffering: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      media: { findMany: async ({ where, select }: { where: { project: { workspaceId: string } }; select: { comparisonPlacement: { where: { workspaceId: string; offering: { workspaceId: string } } } } }) => {
        assert.equal(where.project.workspaceId, "a"); assert.equal(select.comparisonPlacement.where.workspaceId, "a"); assert.equal(select.comparisonPlacement.where.offering.workspaceId, "a"); return [];
      } },
    } },
  });
  assert.equal((await api.GET(new Request("https://example.test/api"), { params: Promise.resolve({ projectId: "project" }) })).status, 200);
});

test("offering changes require an editor and retain ownership in the mutation predicate", async () => {
  let role = "VIEWER";
  let present = false;
  let writes = 0;
  const api = load<{ PATCH: (request: Request) => Promise<Response> }>("../app/api/admin/video-offerings/route.ts", {
    "@/lib/film-poster": { filmPosterMatchesWorkspace },
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/prisma": { prisma: { videoOffering: {
      findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return present ? { id: "offering" } : null; },
      update: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.id, "offering"); assert.equal(where.workspaceId, "a"); writes++; return { id: "offering" }; },
    } } },
  });
  const call = () => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ id: "offering", publicName: "Film", positioningStatement: "Statement", publicDescription: "Description", offeringGroup: "CINEMATIC_FILM" }) }));
  assert.equal((await call()).status, 403); role = "EDITOR"; assert.equal((await call()).status, 404); assert.equal(writes, 0);
  present = true; assert.equal((await call()).status, 200); assert.equal(writes, 1);
});

test("public film examples require placement and media project ownership", async () => {
  const jsx = (_type: unknown, props: unknown) => props;
  let reads = 0;
  const api = load<{ default: () => Promise<unknown> }>("../app/films/page.tsx", {
    "@/lib/film-poster": { filmPosterMatchesWorkspace },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": {}, "@/app/components/Footer": {}, "@/app/components/Navbar": {},
    "@/lib/external-media": {}, "@/lib/seo": {}, "@/lib/site-settings": {}, "./FilmOfferingCard": {},
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/prisma": { prisma: { videoOffering: { findMany: async ({ where, include }: { where: { workspaceId: string }; include: { placements: { where: { workspaceId: string; media: { project: { workspaceId: string; status: string } } } } } }) => {
      assert.equal(where.workspaceId, "a"); assert.equal(include.placements.where.workspaceId, "a"); assert.equal(include.placements.where.media.project.workspaceId, "a"); assert.equal(include.placements.where.media.project.status, "PUBLISHED"); reads++; return [];
    } } } },
  });
  await api.default(); assert.equal(reads, 1);
});

test("film ownership preflight rejects mismatches without rewriting relationships", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Project" (id TEXT PRIMARY KEY, "workspaceId" TEXT); CREATE TABLE "Media" (id TEXT PRIMARY KEY, "projectId" TEXT); CREATE TABLE "VideoOffering" (id TEXT PRIMARY KEY, "workspaceId" TEXT); CREATE TABLE "VideoComparisonPlacement" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "mediaId" TEXT, "offeringId" TEXT); INSERT INTO "Project" VALUES (\'project\',\'a\'); INSERT INTO "Media" VALUES (\'media\',\'project\'); INSERT INTO "VideoOffering" VALUES (\'offering\',\'a\'); INSERT INTO "VideoComparisonPlacement" VALUES (\'placement\',\'a\',\'media\',\'offering\');');
    const sql = readFileSync(new URL("../scripts/migrations/check-film-comparison-ownership.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec('UPDATE "VideoOffering" SET "workspaceId"=\'b\';');
    await assert.rejects(db.exec(sql), /workspace mismatch/i);
    assert.equal((await db.query<{ workspaceId: string }>('SELECT "workspaceId" FROM "VideoComparisonPlacement"')).rows[0].workspaceId, "a");
  } finally { await db.close(); }
});


test("film posters reject foreign company/project namespaces and unsafe URLs", () => {
  assert.equal(filmPosterMatchesWorkspace("a", "project", "https://assets.example.test/workspaces/b/image.webp"), false);
  assert.equal(filmPosterMatchesWorkspace("a", "project", "https://assets.example.test/projects/foreign/image.webp"), false);
  assert.equal(filmPosterMatchesWorkspace("a", "project", "javascript:alert(1)"), false);
  assert.equal(filmPosterMatchesWorkspace("a", "project", "//foreign.example.test/image.webp"), false);
  assert.equal(filmPosterMatchesWorkspace("a", "project", "https://assets.example.test/workspaces/a/image.webp"), true);
  assert.equal(filmPosterMatchesWorkspace("a", "project", "/existing-poster.webp"), true);
});
