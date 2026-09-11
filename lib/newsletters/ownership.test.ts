import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("background ownership uses stored identity and fails closed on ambiguous legacy data", async () => {
  let enabled = true;
  let rows = [{ id: "other" }];
  let reads = 0;
  const exports: { resolveNewsletterWorkspace?: (id: string | null) => Promise<string> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => { reads++; return rows; } } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./ownership.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  const resolve = exports.resolveNewsletterWorkspace!;
  assert.equal(await resolve("original-company"), "original-company");
  assert.equal(reads, 0);
  await assert.rejects(resolve(null));
  enabled = false;
  assert.equal(await resolve(null), "other");
  rows = [{ id: "other" }, { id: "second" }];
  await assert.rejects(resolve(null));
  rows = [];
  await assert.rejects(resolve(null));
});

test("actual source collector scopes requested IDs and derives company links", async () => {
  const records = ["a", "b"].map(workspaceId => ({ id: `post-${workspaceId}`, workspaceId, title: workspaceId, slug: workspaceId, content: "Copy", excerpt: "Intro", featuredMedia: null }));
  const exports: { collectVerifiedNewsletterSources?: (id: string, selection: unknown) => Promise<Array<{ id: string; url: string }>> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {},
    "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/site": { getSiteUrl: () => { throw new Error("Global site fallback forbidden"); } },
    "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    "@/lib/external-media": { tryResolveExternalMedia: () => null },
    "./source-images": { safeNewsletterImageUrl: (value: string) => value },
    "@/lib/prisma": { prisma: {
      blogPost: { findMany: async ({ where }: { where: { AND: Array<{ workspaceId: string }>; id: { in: string[] } } }) => records.filter(row => row.workspaceId === where.AND[0].workspaceId && where.id.in.includes(row.id)) },
      project: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      service: { findMany: async ({ where }: { where: { workspaceId: string; projects?: unknown } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      siteSettings: { findUnique: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { businessName: "Company A", websiteUrl: "https://company-a.example" }; } },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./content-sources.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
    return modules[id];
  } });
  const result = await exports.collectVerifiedNewsletterSources!("a", { blogPostIds: ["post-a", "post-b"], projectIds: ["foreign-project"], serviceIds: ["foreign-service"], includeWebsiteContent: true });
  assert.equal(result.some(row => row.id === "blog:post-b"), false);
  assert.equal(result.find(row => row.id === "blog:post-a")?.url, "https://company-a.example/blog/a");
});

test("Newsletter admin guard keeps unfinished workflows unavailable to a second company", async () => {
  let session: { role: string; workspaceId: string } | null = null;
  let rows = [{ id: "a" }];
  const exports: { requireNewsletterAdministrator?: () => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "next/server": { NextResponse: Response },
    "@/lib/blog-ownership": {}, "./studio": {}, "./recipients": {},
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./api.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  const guard = exports.requireNewsletterAdministrator!;
  assert.equal(await guard(), null);
  session = { role: "EDITOR", workspaceId: "a" };
  assert.equal(await guard(), null);
  session = { role: "ADMIN", workspaceId: "a" };
  assert.equal(await guard(), session);
  rows = [{ id: "a" }, { id: "b" }];
  assert.equal(await guard(), null);
  rows = [{ id: "b" }];
  assert.equal(await guard(), null);
});
