import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "./workspace-brand-storage.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, URL, Date, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}

test("blog attachments require registered uploads or an owned AI image record before creation", async () => {
  let registered = false;
  let ownedAi = false;
  let writes = 0;
  let objectChecks = 0;
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/blog/route.ts", {
    "@/lib/workspace-brand-assets": { verifyRegisteredBrandImage: async (input: { workspaceId: string; kind: string; key: string }) => { assert.equal(input.workspaceId, "a"); assert.equal(input.kind, "blog"); if (input.key && !registered) throw new Error("INVALID_BRAND_IMAGE"); } },
    "@/lib/workspace-brand-storage": policy, "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.test/${key}` },
    "@/lib/content-image-storage": { verifyContentImage: async () => { objectChecks++; } },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a" }) }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null },
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response },
    "@/app/generated/prisma/client": { BlogPostStatus: { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", SCHEDULED: "SCHEDULED", ARCHIVED: "ARCHIVED" } },
    "@/lib/blog": { slugifyBlogTitle: () => "article" },
    "@/lib/prisma": { prisma: {
      newsletterImageAsset: { findFirst: async ({ where }: { where: { storageKey: string; AND: Array<{ workspaceId: string }> } }) => { assert.equal(where.AND[0].workspaceId, "a"); assert.equal(where.storageKey, "workspaces/a/newsletter-ai/image.webp"); return ownedAi ? { id: "asset" } : null; } },
      blogPost: { create: async ({ data }: { data: { workspaceId: string; featuredImageUrl: string } }) => { assert.equal(data.workspaceId, "a"); assert.match(data.featuredImageUrl, /^https:\/\/assets.test\/workspaces\/a\//); writes++; return { slug: "article" }; } },
    } },
  });
  const call = (key: string) => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ title: "Article", content: "Article body", featuredImageStorageKey: key, featuredImageUrl: "https://forged.test/image.webp", workspaceId: "b" }) }));
  assert.equal((await call("workspaces/b/blog/image.webp")).status, 400); assert.equal(writes, 0);
  assert.equal((await call("workspaces/a/blog/image.webp")).status, 400); assert.equal(writes, 0);
  registered = true; assert.equal((await call("workspaces/a/blog/image.webp")).status, 201); assert.equal(writes, 1);
  assert.equal((await call("workspaces/a/newsletter-ai/image.webp")).status, 400); assert.equal(objectChecks, 0); assert.equal(writes, 1);
  ownedAi = true; assert.equal((await call("workspaces/a/newsletter-ai/image.webp")).status, 201); assert.equal(objectChecks, 1); assert.equal(writes, 2);
});

test("blog upload registers ownership before issuing the signed URL", async () => {
  let signed = 0;
  let registered = false;
  const key = "workspaces/a/blog/image.webp";
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/blog/presign/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null }, "@/lib/auth/session": { getAdminSession: async () => ({ workspaceId: "a", userId: "actor" }) },
    "@/lib/r2-upload": { validateImageUpload() {}, createBlogImageKey: (workspaceId: string) => { assert.equal(workspaceId, "a"); return key; }, getPublicAssetUrl: () => "https://assets.test/image.webp", createPresignedUploadUrl: async () => { assert.equal(registered, true); signed++; return "signed"; } },
    "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { workspaceId: string; key: string; kind: string }, fn: () => Promise<string>) => { assert.equal(input.workspaceId, "a"); assert.equal(input.kind, "blog"); assert.equal(input.key, key); registered = true; return fn(); } },
  });
  const response = await api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ fileType: "image/webp", fileSize: 100, workspaceId: "b" }) }));
  assert.equal(response.status, 200); assert.equal(signed, 1);
});
