import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as brandPolicy from "./workspace-brand-storage.ts";

function load(path: string, modules: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, Error, console: { error() {} }, require: (id: string) => modules[id] ?? {} });
  return exports;
}

test("settings targets never reassign a foreign default and allocate distinct tenant row IDs", async () => {
  let enabled = true;
  let rows = [{ id: "a" }];
  const loaded = load("./site-settings-ownership.ts", {
    "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
  });
  const a = await loaded.getSiteSettingsWriteTarget("a") as { where: { workspaceId: string }; createIdentity: { id: string } };
  const b = await loaded.getSiteSettingsWriteTarget("b") as typeof a;
  assert.equal(a.where.workspaceId, "a"); assert.notEqual(a.createIdentity.id, b.createIdentity.id); assert.notEqual(a.createIdentity.id, "default");
  enabled = false;
  const legacy = await loaded.getSiteSettingsWriteTarget("a") as { where: { id: string; OR: Array<{ workspaceId: string | null }> } };
  assert.equal(legacy.where.id, "default"); assert.equal(legacy.where.OR[0].workspaceId, "a"); assert.equal(legacy.where.OR[1].workspaceId, null);
  rows = [{ id: "a" }, { id: "b" }]; await assert.rejects(loaded.getSiteSettingsWriteTarget("a"));
  rows = [{ id: "b" }]; await assert.rejects(loaded.getSiteSettingsWriteTarget("a"));
  await assert.rejects(loaded.getSiteSettingsWriteTarget(""));
});

test("all settings presigns enforce local administrator access", async () => {
  for (const kind of ["brand-logo", "brand-monogram", "favicon", "social-image", "homepage-images", "hero-media"]) {
    for (const session of [null, { role: "EDITOR" }]) {
      const loaded = load(`../app/api/admin/site-settings/${kind}/presign/route.ts`, {
        "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
        "@/lib/auth/session": { getAdminSession: async () => session },
      });
      const response = await loaded.POST(new Request("http://localhost", { method: "POST", body: "{}" })) as Response;
      assert.equal(response.status, 403, kind);
    }
  }
});

test("full settings save rejects foreign keys before storage access and derives owned URLs without deleting assets", async () => {
  for (const company of ["a", "b"]) {
    let writes = 0;
    let checks = 0;
    const loaded = load("../app/api/admin/site-settings/route.ts", {
      "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", workspaceId: "a" }) },
      "@/lib/site-settings-ownership": { getSiteSettingsWriteTarget: async () => ({ where: { workspaceId: "a" }, createIdentity: { id: "workspace:a", workspaceId: "a" } }) },
      "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
      "@/lib/workspace-brand-storage": brandPolicy,
      "@/lib/site-hero-ownership": { resolveSiteHeroUrl: () => ({ url: null, key: null }) },
      "@/lib/r2-upload": { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
      "@/lib/content-image-storage": { verifyContentImage: async (key: string | null) => { if (key) checks++; }, deleteContentImage: async () => { throw new Error("Deletion is forbidden"); } },
      "@/lib/prisma": { prisma: { siteSettings: {
        findUnique: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return null; },
        upsert: async ({ where, update }: { where: { workspaceId: string }; update: { brandLogoUrl: string; workspaceId?: string } }) => {
          assert.equal(where.workspaceId, "a"); assert.equal(update.workspaceId, undefined); assert.equal(update.brandLogoUrl, "https://assets.example/workspaces/a/site-brand/logo.png"); writes++; return {};
        },
      } } },
    });
    const body = { businessName: "Company A", phoneDisplay: "+15555555555", phoneE164: "+15555555555", bookingMode: "ONLINE", locationLabel: "City", serviceArea: "Area", defaultSeoTitle: "Company A", defaultSeoDescription: "Description", standardPrinciples: [], approachCards: [], headerNavigation: [], footerNavigation: [], brandLogoStorageKey: `workspaces/${company}/site-brand/logo.png`, brandLogoUrl: "https://forged.example/logo.png" };
    const response = await loaded.PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) })) as Response;
    assert.equal(response.status, company === "a" ? 200 : 400);
    assert.equal(writes, company === "a" ? 1 : 0); assert.equal(checks, writes);
  }
});

test("hero URL ownership accepts canonical own uploads and rejects foreign or disguised paths", async () => {
  const loaded = load("./site-hero-ownership.ts", { "./workspace-brand-storage": brandPolicy });
  const resolve = loaded.resolveSiteHeroUrl as unknown as (...args: unknown[]) => { key: string | null };
  const publicUrl = (key: string) => `https://assets.example/${key}`;
  assert.equal(resolve("a", "video", publicUrl("workspaces/a/site-hero/video-id.mp4"), null, publicUrl).key, "workspaces/a/site-hero/video-id.mp4");
  for (const value of ["workspaces/b/site-hero/video-id.mp4", "workspaces/a/site-hero/video-id.mp4?foreign", "workspaces/a/site-hero/../b.mp4"]) {
    assert.throws(() => resolve("a", "video", publicUrl(value), publicUrl(value), publicUrl));
  }
  assert.equal(resolve("a", "poster", "/legacy.jpg", "/legacy.jpg", publicUrl).key, null);
});
