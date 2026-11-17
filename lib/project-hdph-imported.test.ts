import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "./project-hdph-import.ts";
const source = readFileSync("app/api/admin/projects/hdph-import/route.ts", "utf8");
function fixture(allowed = true) {
  const reads: unknown[] = [];
  const exports: { GET?: (request: Request) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (data: unknown, options: ResponseInit) => new Response(JSON.stringify(data), options) } },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "OWNER", workspaceId: "workspace-a" }) },
    "@/lib/prisma": { prisma: { project: { findFirst: async (query: unknown) => { reads.push(query); return allowed ? { id: "project-a" } : null; } }, media: { findMany: async (query: unknown) => { reads.push(query); return [{ externalId: "hdph:12:34" }]; } } } },
    "@/lib/project-hdph-reader": { projectHdphReader: () => ({ site: async () => { reads.push("provider"); return { siteId: 12, photos: [{ mediaId: 34, name: "Old" }, { mediaId: 35, name: "New" }] }; } }) },
    "@/lib/project-hdph-import": policy,
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (name: string) => modules[name] || {}, URL, Response, Set });
  return { reads, get: () => exports.GET!(new Request("https://studio.test/api?siteId=12&targetProjectId=project-a")) };
}
test("lookup marks imported source IDs only inside validated target workspace/draft", async () => {
  const f = fixture(); const response = await f.get(); const body = await response.json();
  assert.equal(body.photos[0].alreadyImported, true); assert.equal(body.photos[1].alreadyImported, false);
  assert.equal(JSON.stringify(f.reads[0]), JSON.stringify({ where: { id: "project-a", workspaceId: "workspace-a", status: "DRAFT" }, select: { id: true } }));
  assert.match(JSON.stringify(f.reads[2]), /"projectId":"project-a"/);
  assert.match(JSON.stringify(f.reads[2]), /hdph:12:/);
});
test("other-workspace/missing draft cannot enumerate imported media", async () => {
  const f = fixture(false); assert.equal((await f.get()).status, 404); assert.equal(f.reads.length, 1);
});
test("UI disables imported tiles and server dedupe remains project scoped", () => {
  const ui = readFileSync("app/admin/projects/HDPhotoHubImport.tsx", "utf8");
  assert.match(ui, /disabled=\{disabled \|\| photo.alreadyImported\}/);
  assert.match(ui, /photos.filter\(photo => !photo.alreadyImported\)/);
  assert.match(ui, /Select all new photos/);
  assert.match(source, /digest\(`\$\{projectId\}:\$\{siteId\}:\$\{mediaId\}`\)/);
  assert.match(source, /alreadyImported: true/);
});
