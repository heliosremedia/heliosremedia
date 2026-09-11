import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Error, Date, URL, console, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; }, ...globals });
  return exports as T;
}
const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1, role: "EDITOR" };
const stamp = new Date("2026-09-11T12:00:00Z");

function generation() {
  const control = { allowed: true, current: true, advance: true, revokeAfterFetch: false };
  const counters = { fetches: 0, posts: 0, revisions: 0 };
  const series = { id: "series", workspaceId: "a" as string | null, updatedAt: stamp, nextPublishAt: new Date("2026-09-20"), status: "ACTIVE", contentPillars: ["Photography"], lastPillarIndex: 0, targetAudience: "Agents", cadence: "WEEKLY", leadDays: 7 };
  const tx = {
    $queryRaw: async () => [],
    blogSeries: {
      findFirst: async ({ where }: { where: { workspaceId: string; updatedAt: Date; status: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.updatedAt, stamp); assert.equal(where.status, "ACTIVE"); return control.current ? series : null; },
      updateMany: async ({ where }: { where: { workspaceId: string; updatedAt: Date; nextPublishAt: Date } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.updatedAt, stamp); assert.equal(where.nextPublishAt, series.nextPublishAt); return { count: control.advance ? 1 : 0 }; },
    },
    blogPost: { create: async ({ data }: { data: { workspaceId: string; status: string; scheduledAt?: Date } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.status, "NEEDS_REVIEW"); assert.equal(data.scheduledAt, undefined); counters.posts++; return { id: "post", ...data }; } },
    blogPostRevision: { create: async () => { counters.revisions++; } },
  };
  const api = load<typeof import("./blog-series")>("./blog-series.ts", {
    "server-only": {}, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!control.allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) }, "@/lib/blog": { slugifyBlogTitle: () => "draft" }, "@/lib/blog-series-schedule": { nextBlogSeriesDates: () => ({ nextPublishAt: new Date("2026-09-27"), nextGenerationAt: new Date("2026-09-20") }) },
    "@/lib/prisma": { prisma: {
      blogSeries: { findUniqueOrThrow: async ({ where }: { where: { updatedAt?: Date; workspaceId?: string } }) => { if (where.updatedAt) { assert.equal(where.updatedAt, stamp); assert.equal(where.workspaceId, "a"); } return series; } }, workspace: { findMany: async () => [{ id: "a" }] },
      blogPost: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; } },
      siteSettings: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { businessName: "Company A" }; } },
      $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx),
    } },
  }, { process: { env: { OPENAI_API_KEY: "fake-test-key" } }, AbortSignal: { timeout: () => undefined }, fetch: async () => { counters.fetches++; if (control.revokeAfterFetch) control.allowed = false; return Response.json({ output_text: JSON.stringify({ title: "Draft", content: "Review this draft", sourceLinks: [] }) }); } });
  return { control, counters, series, call: () => api.generateSeriesDraft("series", { kind: "ADMIN", actor }), background: () => api.generateSeriesDraft("series", { kind: "BACKGROUND", workspaceId: "a", claimedAt: stamp }) };
}

test("blog series generation fails before the provider when ownership or current access is unavailable", async () => {
  for (const mode of ["revoked", "changed", "foreign", "ownerless"]) {
    const h = generation();
    if (mode === "revoked") h.control.allowed = false;
    if (mode === "changed") h.control.current = false;
    if (mode === "foreign") h.series.workspaceId = "b";
    if (mode === "ownerless") h.series.workspaceId = null;
    await assert.rejects(h.call(), /WORKSPACE_WRITE_FORBIDDEN|BLOG_SERIES_CHANGED|BLOG_SERIES_OWNERSHIP_REQUIRED/);
    assert.equal(h.counters.fetches, 0); assert.equal(h.counters.posts, 0);
  }
});

test("blog series generation cannot save after revocation or a superseding series revision", async () => {
  const stale = generation(); stale.control.advance = false; await assert.rejects(stale.call(), /BLOG_SERIES_CHANGED/); assert.equal(stale.counters.fetches, 1); assert.equal(stale.counters.posts, 0); assert.equal(stale.counters.revisions, 0);
  const revoked = generation(); revoked.control.revokeAfterFetch = true; await assert.rejects(revoked.call(), /WORKSPACE_WRITE_FORBIDDEN/); assert.equal(revoked.counters.posts, 0);
  const valid = generation(); await valid.call(); assert.equal(valid.counters.fetches, 1); assert.equal(valid.counters.posts, 1); assert.equal(valid.counters.revisions, 1);
});

test("blog-series cron restores retries only for its own unchanged company and claim revision", async () => {
  let writes = 0;
  let claim: Date;
  const due = new Date("2026-09-11");
  const api = load<{ GET: (request: Request) => Promise<Response> }>("../app/api/cron/blog-series/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/prisma": { prisma: { blogSeries: {
      findMany: async () => [{ id: "series", workspaceId: "a", nextGenerationAt: due, updatedAt: stamp }],
      updateMany: async ({ where, data }: { where: { workspaceId: string; updatedAt: Date; nextGenerationAt: Date | null }; data: { updatedAt?: Date; nextGenerationAt: Date | null } }) => {
        assert.equal(where.workspaceId, "a"); writes++;
        if (writes === 1) { assert.equal(where.updatedAt, stamp); claim = data.updatedAt!; assert.equal(data.nextGenerationAt, null); return { count: 1 }; }
        assert.equal(where.updatedAt, claim); assert.equal(where.nextGenerationAt, null); assert.equal(data.nextGenerationAt, due); return { count: 0 };
      },
    } } },
    "@/lib/blog-series": { generateSeriesDraft: async (_id: string, context: { kind: string; claimedAt: Date; workspaceId: string }) => { assert.equal(context.kind, "BACKGROUND"); assert.equal(context.claimedAt, claim); assert.equal(context.workspaceId, "a"); throw new Error("BLOG_SERIES_CHANGED"); } },
  }, { process: { env: { CRON_SECRET: "fake-test-secret" } } });
  assert.equal((await api.GET(new Request("https://example.test/cron"))).status, 401); assert.equal(writes, 0);
  assert.equal((await api.GET(new Request("https://example.test/cron", { headers: { authorization: "Bearer fake-test-secret" } }))).status, 200); assert.equal(writes, 2);
});

test("blog series settings mutations revalidate the current actor before writing", async () => {
  let allowed = false;
  let writes = 0;
  const tx = { blogSeries: { create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); writes++; return {}; }, update: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => { assert.equal(where.AND[0].workspaceId, "a"); writes++; return {}; } } };
  const api = load<Record<"POST" | "PATCH", (request: Request) => Promise<Response>>>("../app/api/admin/blog/series/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => actor }, "@/lib/blog-access": { requireLegacyBlogAccess: async () => null },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) }, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: (fn: (db: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (method: "POST" | "PATCH") => api[method](new Request("https://example.test/api", { method, body: JSON.stringify({ id: "series", name: "Series", purpose: "Teach", targetAudience: "Agents", brandVoice: "Clear", nextPublishAt: "2026-09-20", workspaceId: "b" }) }));
  assert.equal((await call("POST")).status, 403); assert.equal((await call("PATCH")).status, 403); assert.equal(writes, 0);
  allowed = true; assert.equal((await call("POST")).status, 201); assert.equal((await call("PATCH")).status, 200); assert.equal(writes, 2);
});


test("background blog generation uses its stored company and claim without a request actor", async () => {
  const h = generation(); h.control.allowed = false;
  await h.background(); assert.equal(h.counters.posts, 1); assert.equal(h.counters.fetches, 1);
});
