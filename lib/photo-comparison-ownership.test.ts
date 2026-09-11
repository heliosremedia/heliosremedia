import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as brand from "./workspace-brand-storage.ts";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console, ...globals,
  });
  return exports as T;
}
const storage = load<typeof import("./photo-comparison-storage")>("./photo-comparison-storage.ts", { "@/lib/workspace-brand-storage": brand });
const publicUrl = (key: string) => `https://assets.example.test/${key}`;

test("photo image policy binds keys to company and preserves only unchanged legacy references", () => {
  const image = storage.resolvePhotoComparisonImage("a", { key: "workspaces/a/photo-comparison/image.webp", url: "https://foreign.example.test/image.webp" }, null, publicUrl);
  assert.equal(image.url, "https://assets.example.test/workspaces/a/photo-comparison/image.webp");
  for (const key of ["workspaces/b/photo-comparison/image.webp", "site/photo-comparison/b/image.webp"]) {
    const existing = { key, url: publicUrl(key) };
    assert.throws(() => storage.resolvePhotoComparisonImage("a", existing, existing, publicUrl), /INVALID_BRAND_IMAGE/);
    assert.equal(storage.photoComparisonImageMatchesWorkspace("a", existing), false);
  }
  const legacy = { key: "site/photo-comparison/a/image.webp", url: publicUrl("site/photo-comparison/a/image.webp") };
  assert.equal(storage.resolvePhotoComparisonImage("a", legacy, legacy, publicUrl).url, legacy.url);
  assert.throws(() => storage.resolvePhotoComparisonImage("a", legacy, null, publicUrl), /INVALID_BRAND_IMAGE/);
  assert.throws(() => storage.resolvePhotoComparisonImage("a", { key: null, url: "https://foreign.example.test/image.webp" }, null, publicUrl), /INVALID_BRAND_IMAGE/);
  assert.equal(storage.photoComparisonImageMatchesWorkspace("a", { key: null, url: "https://assets.example.test/workspaces%2Fb%2Fphoto-comparison/image.webp" }), false);
});

function photoModule(prisma: unknown, enabled: () => boolean) {
  return load<typeof import("./photo-comparison")>("./photo-comparison.ts", {
    "server-only": {}, "@/lib/prisma": { prisma }, "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/workspace-context-core": { tenantContextEnabled: enabled }, "@/lib/photo-comparison-storage": storage,
  });
}

test("new photo-comparison tenants receive no Helios images, pricing or published default page", async () => {
  let enabled = true;
  let companies = [{ id: "a" }];
  let page: Record<string, unknown> | null = null;
  const api = photoModule({ workspace: { findMany: async () => companies }, photoComparisonPage: { findUnique: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return page; } } }, () => enabled);
  let result = await api.getPhotoComparisonPage("a");
  assert.equal(result.active, false); assert.equal(result.pairs.length, 0); assert.equal(result.detailImageUrl, ""); assert.equal(result.content.ctaBody, "");
  enabled = false; result = await api.getPhotoComparisonPage("a");
  assert.equal(result.active, true); assert.equal(result.pairs.length, 3); assert.match(result.content.ctaBody, /\$195/);
  companies = [{ id: "a" }, { id: "b" }]; result = await api.getPhotoComparisonPage("a"); assert.equal(result.active, false); assert.equal(result.content.ctaBody, "");
  page = { active: true, content: { heroHeading: "Company A" }, detailImageUrl: "https://assets.example.test/workspaces/b/photo-comparison/foreign.webp", pairs: [{ id: "foreign", standardImageStorageKey: "workspaces/b/photo-comparison/one.webp", standardImageUrl: "foreign", editorialImageStorageKey: null, editorialImageUrl: "/image.webp" }] };
  result = await api.getPhotoComparisonPage("a"); assert.equal(result.content.heroHeading, "Company A"); assert.equal(result.content.ctaBody, ""); assert.equal(result.active, false); assert.equal(result.detailImageUrl, ""); assert.equal(result.pairs.length, 0);
});

test("photo page handler scopes replacement, rejects foreign images and conflicting saves", async () => {
  let role = "VIEWER";
  let writes = 0;
  let verifies = 0;
  const updatedAt = new Date("2026-09-11T12:00:00.000Z");
  let currentTime = updatedAt;
  const base = photoModule({}, () => false);
  const existing = { active: true, updatedAt, content: base.defaultPhotoComparisonContent, detailImageStorageKey: null, detailImageUrl: "/photo-finishes/editorial-detail.jpg", detailImageAlt: "Detail", pairs: base.defaultPhotoComparisonPairs };
  const tx = {
    $queryRaw: async (_query: unknown, workspaceId: string) => { assert.equal(workspaceId, "a"); return [{ id: "a" }]; },
    photoComparisonPage: {
      findUnique: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { updatedAt: currentTime }; },
      upsert: async ({ where, create }: { where: { workspaceId: string }; create: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(create.workspaceId, "a"); writes++; return { id: "page-a" }; },
      findUniqueOrThrow: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.id, "page-a"); assert.equal(where.workspaceId, "a"); return { ...existing, pairs: [{ ...existing.pairs[0], id: "saved-pair" }] }; },
    },
    photoComparisonPair: {
      deleteMany: async ({ where }: { where: { pageId: string } }) => { assert.equal(where.pageId, "page-a"); },
      createMany: async ({ data }: { data: Array<{ pageId: string }> }) => { assert.ok(data.every((pair) => pair.pageId === "page-a")); },
    },
  };
  const api = load<{ PATCH: (request: Request) => Promise<Response> }>("../app/api/admin/photo-comparison/route.ts", {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/photo-comparison": { ...base, getPhotoComparisonPage: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return existing; } },
    "@/lib/photo-comparison-storage": storage, "@/lib/r2-upload": { getPublicAssetUrl: publicUrl },
    "@/lib/workspace-brand-assets": { verifyRegisteredBrandImage: async ({ workspaceId }: { workspaceId: string }) => { assert.equal(workspaceId, "a"); verifies++; } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (patch: Record<string, unknown> = {}) => api.PATCH(new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ ...existing, workspaceId: "b", ...patch }) }));
  assert.equal((await call()).status, 403); assert.equal(writes, 0);
  role = "EDITOR";
  assert.equal((await call({ pairs: [{ ...existing.pairs[0], standardImageStorageKey: "site/photo-comparison/b/foreign.webp", standardImageUrl: "https://foreign.example.test/image.webp" }] })).status, 400);
  assert.equal(verifies, 0); assert.equal(writes, 0);
  assert.equal((await call({ updatedAt: "2026-01-01T00:00:00.000Z" })).status, 409);
  currentTime = new Date(updatedAt.getTime() + 1000); assert.equal((await call()).status, 409); assert.equal(writes, 0);
  currentTime = updatedAt; const response = await call(); assert.equal(response.status, 200); assert.equal((await response.json()).page.pairs[0].id, "saved-pair"); assert.equal(writes, 1);
});

test("photo presign requires editor permission and stores server-owned upload intent", async () => {
  let role = "VIEWER";
  let registered = false;
  let signed = 0;
  const key = "workspaces/a/photo-comparison/detail.webp";
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/photo-comparison/presign/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role, userId: "actor", workspaceId: "a" }) },
    "@/lib/r2-upload": { createPhotoComparisonImageKey: (workspaceId: string) => { assert.equal(workspaceId, "a"); return key; }, getPublicAssetUrl: publicUrl, createPresignedUploadUrl: async () => { assert.equal(registered, true); signed++; return "signed-url"; } },
    "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { workspaceId: string; kind: string; key: string }, fn: () => Promise<string>) => { assert.equal(input.workspaceId, "a"); assert.equal(input.kind, "photo-comparison"); assert.equal(input.key, key); registered = true; return fn(); } },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ kind: "detail", fileType: "image/webp", fileSize: 100, workspaceId: "b" }) }));
  assert.equal((await call()).status, 403); assert.equal(signed, 0); role = "EDITOR";
  assert.equal((await call()).status, 200); assert.equal(signed, 1);
});
