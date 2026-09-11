import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "./workspace-brand-storage.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, Date, URL, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}
const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1, role: "EDITOR" };
const updatedAt = new Date("2026-09-11T12:00:00Z");

test("manual blog create, save and delete deny stale access and keep owned conditional writes", async () => {
  let allowed = false;
  let writes = 0;
  let revisions = 0;
  let stale = false;
  const own = (where: { AND: Array<{ workspaceId: string }> }) => assert.equal(where.AND[0].workspaceId, "a");
  const current = { id: "post", slug: "article", title: "Old", content: "Old body", sourceLinks: [], featuredImageStorageKey: null, featuredImageUrl: null, updatedAt };
  const tx = {
    media: { findFirst: async ({ where }: { where: { project: { workspaceId: string }; visibility: string } }) => { assert.equal(where.project.workspaceId, "a"); assert.equal(where.visibility, "VISIBLE"); return null; } },
    blogPost: {
      create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); writes++; return current; },
      findUniqueOrThrow: async ({ where }: { where: Parameters<typeof own>[0] }) => { own(where); return current; },
      update: async ({ where }: { where: Parameters<typeof own>[0] & { updatedAt: Date } }) => { own(where); assert.equal(where.updatedAt, updatedAt); if (stale) throw Object.assign(new Error("stale"), { code: "P2025" }); writes++; return current; },
      delete: async ({ where }: { where: Parameters<typeof own>[0] }) => { own(where); writes++; return current; },
    },
    blogPostRevision: { create: async () => { revisions++; } },
  };
  const api = load<Record<"POST" | "PATCH" | "DELETE", (request: Request) => Promise<Response>>>("../app/api/admin/blog/route.ts", {
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async (_tx: unknown, user: typeof actor) => { assert.equal(_tx, tx); assert.equal(user.workspaceId, "a"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/workspace-brand-assets": { verifyRegisteredBrandImage: async () => {} }, "@/lib/workspace-brand-storage": policy, "@/lib/r2-upload": {}, "@/lib/content-image-storage": {},
    "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) }, "@/lib/auth/session": { getAdminSession: async () => actor }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null },
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response }, "@/app/generated/prisma/client": { BlogPostStatus: { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", SCHEDULED: "SCHEDULED", ARCHIVED: "ARCHIVED" } }, "@/lib/blog": { slugifyBlogTitle: () => "article" },
    "@/lib/prisma": { prisma: { blogPost: { findUniqueOrThrow: async ({ where }: { where: Parameters<typeof own>[0] }) => { own(where); return current; } }, $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (method: "POST" | "PATCH" | "DELETE", featuredMediaId?: string) => api[method](new Request("https://example.test/api?postId=post", { method, ...(method === "DELETE" ? {} : { body: JSON.stringify({ postId: "post", title: "Article", content: "Article body", featuredMediaId, workspaceId: "b" }) }) }));
  for (const method of ["POST", "PATCH", "DELETE"] as const) assert.equal((await call(method)).status, 403);
  assert.equal(writes, 0); assert.equal(revisions, 0);
  allowed = true; assert.equal((await call("POST", "foreign")).status, 400); assert.equal(writes, 0);
  assert.equal((await call("POST")).status, 201); assert.equal((await call("PATCH")).status, 200); assert.equal(revisions, 1);
  stale = true; assert.equal((await call("PATCH")).status, 409); assert.equal(writes, 2);
  assert.equal((await call("DELETE")).status, 200); assert.equal(writes, 3);
});

test("revision restore rechecks ownership inside the authorized transaction and refreshes article caches", async () => {
  let allowed = false;
  let available = false;
  let restored = 0;
  let saved = 0;
  const refreshed: string[] = [];
  const tx = {
    blogPostRevision: {
      findFirstOrThrow: async ({ where }: { where: { postId: string; post: { workspaceId: string } } }) => { assert.equal(where.postId, "post"); assert.equal(where.post.workspaceId, "a"); if (!available) throw Object.assign(new Error("missing"), { code: "P2025" }); return { title: "Revision", content: "Previous body" }; },
      create: async () => { saved++; },
    },
    blogPost: {
      findUniqueOrThrow: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => { assert.equal(where.AND[0].workspaceId, "a"); return { id: "post", updatedAt, title: "Current", content: "Body" }; },
      update: async ({ where, data }: { where: { updatedAt: Date; AND: Array<{ workspaceId: string }> }; data: { title: string; manualContent: boolean } }) => { assert.equal(where.updatedAt, updatedAt); assert.equal(where.AND[0].workspaceId, "a"); assert.equal(data.title, "Revision"); assert.equal(data.manualContent, true); restored++; return { slug: "article" }; },
    },
  };
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/blog/revisions/route.ts", {
    "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) }, "@/lib/auth/session": { getAdminSession: async () => actor }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null },
    "next/server": { NextResponse: Response }, "next/cache": { revalidatePath: (path: string) => refreshed.push(path) },
    "@/lib/prisma": { prisma: { $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ postId: "post", revisionId: "revision", workspaceId: "b" }) }));
  assert.equal((await call()).status, 403); allowed = true; assert.equal((await call()).status, 409); assert.equal(restored, 0); assert.equal(saved, 0);
  available = true; assert.equal((await call()).status, 200); assert.equal(restored, 1); assert.equal(saved, 1); assert.ok(refreshed.includes("/blog/article")); assert.ok(refreshed.includes("/sitemap.xml"));
});
