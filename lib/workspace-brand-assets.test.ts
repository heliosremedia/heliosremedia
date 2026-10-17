import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "./workspace-brand-storage.ts";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console, ...globals,
  });
  return exports as T;
}
type BrandApi = typeof import("./workspace-brand-assets");
const key = "workspaces/a/testimonials/image.webp";
const r2 = { r2Config: { accountId: "account", bucketName: "bucket" } };

test("brand attachment requires registry evidence before object access, preserving only scoped legacy images", async () => {
  let asset: { id: string; workspaceId: string; status: string } | null = null;
  let enabled = true;
  let checks = 0;
  let companies = [{ id: "a" }];
  const env = { STUDIO_V2_ASSET_OWNERSHIP_ENABLED: "false" };
  const api = load<BrandApi>("./workspace-brand-assets.ts", {
    "server-only": {}, "@/lib/workspace-write-access": {}, "@/lib/r2": r2, "@/lib/workspace-brand-storage": policy,
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/content-image-storage": { verifyContentImage: async () => { checks++; } },
    "@/lib/prisma": { prisma: {
      workspaceAsset: { findUnique: async ({ where }: { where: { provider_providerNamespace_providerKey: { providerNamespace: string } } }) => { assert.equal(where.provider_providerNamespace_providerKey.providerNamespace, '["account","bucket"]'); return asset; } },
      workspace: { findMany: async () => companies },
    } },
  }, { process: { env } });
  const input = { workspaceId: "a", kind: "testimonials" as const, key };
  await assert.rejects(api.verifyRegisteredBrandImage(input), /INVALID_BRAND_IMAGE/); assert.equal(checks, 0);
  await assert.rejects(api.verifyRegisteredBrandImage({ ...input, key: "workspaces/b/testimonials/image.webp", existingKey: "workspaces/b/testimonials/image.webp" }), /INVALID_BRAND_IMAGE/);
  await api.verifyRegisteredBrandImage({ ...input, key: "testimonials/legacy.webp", existingKey: "testimonials/legacy.webp" }); assert.equal(checks, 0);
  enabled = false; await api.verifyRegisteredBrandImage(input); assert.equal(checks, 1);
  companies = [{ id: "a" }, { id: "b" }]; await assert.rejects(api.verifyRegisteredBrandImage(input), /INVALID_BRAND_IMAGE/);
  companies = [{ id: "a" }]; env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED = "true"; await assert.rejects(api.verifyRegisteredBrandImage(input), /INVALID_BRAND_IMAGE/);
  asset = { id: "asset", workspaceId: "b", status: "UPLOAD_PROVISIONED" };
  await assert.rejects(api.verifyRegisteredBrandImage(input), /INVALID_BRAND_IMAGE/);
  asset.workspaceId = "a";
  for (const status of ["UPLOAD_PENDING", "FAILED", "QUARANTINED", "RETIRED"]) {
    asset.status = status;
    await assert.rejects(api.verifyRegisteredBrandImage({ ...input, existingKey: key }), /INVALID_BRAND_IMAGE/);
  }
  asset.status = "UPLOAD_PROVISIONED"; await api.verifyRegisteredBrandImage(input); assert.equal(checks, 2);
  await api.verifyRegisteredBrandImage({ ...input, existingKey: key }); assert.equal(checks, 2);
});

test("brand upload cannot grant or write a key before registering immutable ownership", async () => {
  const events: string[] = [];
  let collision = false;
  let stale = false;
  let forbidden = false;
  const authorize = async (_tx: unknown, actor: { workspaceId: string; userId: string; sessionVersion: number }) => {
    assert.equal(actor.workspaceId, "a"); assert.equal(actor.userId, "actor"); assert.equal(actor.sessionVersion, 7);
    if (forbidden) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
  };
  const api = load<BrandApi>("./workspace-brand-assets.ts", {
    "server-only": {}, "@/lib/workspace-write-access": { requireLockedWorkspaceEditor: authorize, requireLockedWorkspaceAdministrator: authorize }, "@/lib/r2": r2, "@/lib/workspace-brand-storage": policy, "@/lib/workspace-context-core": {}, "@/lib/content-image-storage": {},
    "@/lib/prisma": { prisma: { $transaction: async function (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> { return fn(this); }, workspaceAsset: {
      create: async ({ data }: { data: { workspaceId: string; provider: string; providerKey: string; byteSize: bigint } }) => {
        events.push("register"); assert.equal(data.workspaceId, "a"); assert.equal(data.provider, "R2"); assert.equal(data.providerKey, key); assert.equal(data.byteSize, BigInt(100)); if (collision) throw new Error("duplicate provider identity"); return { id: "asset" };
      },
      updateMany: async ({ where, data }: { where: { id: string; workspaceId: string; status: string }; data: { status: string } }) => {
        assert.equal(where.workspaceId, "a"); assert.equal(where.id, "asset"); assert.equal(where.status, "UPLOAD_PENDING"); events.push(data.status); return { count: stale ? 0 : 1 };
      },
    } } },
  });
  const input = { workspaceId: "a", actorId: "actor", sessionVersion: 7, kind: "testimonials" as const, key, byteSize: 100 };
  const provision = async () => { events.push("provision"); return "signed-url"; };
  assert.equal(await api.withBrandUploadAsset(input, provision), "signed-url");
  assert.deepEqual(events.splice(0), ["register", "provision", "UPLOAD_PROVISIONED"]);
  collision = true; await assert.rejects(api.withBrandUploadAsset(input, provision), /duplicate/); assert.deepEqual(events.splice(0), ["register"]);
  collision = false; await assert.rejects(api.withBrandUploadAsset(input, async () => { throw new Error("provider failed"); }), /provider failed/); assert.deepEqual(events.splice(0), ["register", "FAILED"]);
  stale = true; await assert.rejects(api.withBrandUploadAsset(input, provision), /INVALID_BRAND_IMAGE/); assert.deepEqual(events.splice(0), ["register", "provision", "UPLOAD_PROVISIONED", "FAILED"]);
  await assert.rejects(api.withBrandUploadAsset({ ...input, key: "workspaces/b/testimonials/image.webp" }, provision), /INVALID_BRAND_IMAGE/);
  await assert.rejects(api.withBrandUploadAsset({ ...input, byteSize: -1 }, provision), /INVALID_BRAND_IMAGE/);
  assert.deepEqual(events, []);
  forbidden = true;
  await assert.rejects(api.withBrandUploadAsset(input, provision), /WORKSPACE_WRITE_FORBIDDEN/);
  assert.deepEqual(events, []);
});

for (const kind of ["testimonials", "trusted-logos"] as const) {
  test(`${kind} presign handler binds server company/key before signing and rejects viewers`, async () => {
    let role = "VIEWER";
    let registered = false;
    let signed = 0;
    const ownedKey = `workspaces/a/${kind}/image.webp`;
    const api = load<{ POST: (request: Request) => Promise<Response> }>(`../app/api/admin/${kind}/presign/route.ts`, {
      "next/server": { NextResponse: Response },
      "@/lib/auth/session": { getAdminSession: async () => ({ role, userId: "actor", sessionVersion: 7, workspaceId: "a" }) },
      "@/lib/r2-upload": {
        validateImageUpload() {}, createTestimonialImageKey: () => ownedKey, createTrustedLogoKey: () => ownedKey,
        getPublicAssetUrl: (value: string) => `https://assets.example.test/${value}`,
        createPresignedUploadUrl: async (value: string) => { assert.equal(registered, true); assert.equal(value, ownedKey); signed++; return "signed-url"; },
      },
      "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { sessionVersion: number; workspaceId: string; key: string; actorId: string }, fn: () => Promise<string>) => {
        assert.equal(input.sessionVersion, 7); assert.equal(input.workspaceId, "a"); assert.equal(input.actorId, "actor"); assert.equal(input.key, ownedKey); registered = true; return fn();
      } },
    });
    const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ fileName: "image.webp", fileType: "image/webp", fileSize: 100, workspaceId: "b", key: "workspaces/b/foreign.webp" }) }));
    assert.equal((await call()).status, 403); assert.equal(signed, 0);
    role = "EDITOR"; const response = await call(); assert.equal(response.status, 200); assert.equal((await response.json()).upload.key, ownedKey); assert.equal(signed, 1);
  });
}

test("server logo upload registers the server-generated key before writing bytes", async () => {
  let registered = false;
  let writes = 0;
  const ownedKey = "workspaces/a/trusted-logos/image.webp";
  class PutObjectCommand { input: Record<string, unknown>; constructor(input: Record<string, unknown>) { this.input = input; } }
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/trusted-logos/upload/route.ts", {
    "@aws-sdk/client-s3": { PutObjectCommand }, "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", userId: "actor", sessionVersion: 7, workspaceId: "a" }) },
    "@/lib/r2-upload": { validateImageUpload() {}, createTrustedLogoKey: () => ownedKey, getPublicAssetUrl: () => "https://assets.example.test/image.webp" },
    "@/lib/r2": { ...r2, r2Client: { send: async (command: PutObjectCommand) => { assert.equal(registered, true); assert.equal(command.input.Key, ownedKey); writes++; } } },
    "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { sessionVersion: number; workspaceId: string; key: string }, fn: () => Promise<unknown>) => { assert.equal(input.sessionVersion, 7); assert.equal(input.workspaceId, "a"); assert.equal(input.key, ownedKey); registered = true; return fn(); } },
  }, { File, Buffer });
  const form = new FormData(); form.set("image", new File(["image"], "image.webp", { type: "image/webp" }));
  const response = await api.POST(new Request("https://example.test/api", { method: "POST", body: form }));
  assert.equal(response.status, 200); assert.equal(writes, 1);
});

for (const route of ["brand-logo", "brand-monogram", "favicon", "social-image", "homepage-images", "hero-media"] as const) {
  test(`website ${route} upload registers the authenticated owner before returning a signed URL`, async () => {
    const kind = route === "hero-media" ? "site-hero" : route === "homepage-images" ? "site-homepage" : "site-brand";
    const ownedKey = `workspaces/a/${kind}/${route === "hero-media" ? "video-id.mp4" : "image.png"}`;
    let registered = false;
    let allow = true;
    let signed = 0;
    const keyFor = (workspaceId: string) => { assert.equal(workspaceId, "a"); return ownedKey; };
    const api = load<{ POST: (request: Request) => Promise<Response> }>(`../app/api/admin/site-settings/${route}/presign/route.ts`, {
      "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", userId: "actor", sessionVersion: 7, workspaceId: "a" }) },
      "@/lib/r2-upload": {
        createBrandLogoKey: keyFor, createBrandMonogramKey: keyFor, createFaviconKey: keyFor, createDefaultSocialImageKey: keyFor, createHomepageSectionImageKey: keyFor, createSiteHeroKey: keyFor,
        validateImageUpload() {}, getPublicAssetUrl: (key: string) => `https://assets.test/${key}`,
        createPresignedUploadUrl: async (key: string) => { assert.equal(registered, true); assert.equal(key, ownedKey); signed++; return "signed-url"; },
      },
      "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { sessionVersion: number; workspaceId: string; actorId: string; kind: string; key: string; byteSize: number }, fn: () => Promise<string>) => {
        assert.equal(input.sessionVersion, 7); assert.equal(input.workspaceId, "a"); assert.equal(input.actorId, "actor"); assert.equal(input.kind, kind); assert.equal(input.key, ownedKey); assert.equal(input.byteSize, 100);
        if (!allow) throw new Error("INVALID_BRAND_IMAGE"); registered = true; return fn();
      } },
    }, { console: { error() {} } });
    const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ kind: route === "hero-media" ? "video" : "helios-standard", fileType: route === "hero-media" ? "video/mp4" : "image/png", fileName: "image.png", fileSize: 100, workspaceId: "b" }) }));
    let response = await call(); assert.equal(response.status, 200); assert.equal((await response.json()).upload.key, ownedKey); assert.equal(signed, 1);
    allow = false; response = await call(); assert.ok(response.status >= 400); assert.equal(signed, 1); assert.equal((await response.json()).upload, undefined);
  });
}

test("hero registry permits only explicit video and poster formats in the owned namespace", async () => {
  let checks = 0;
  let owner = "a";
  let status = "UPLOAD_PROVISIONED";
  const api = load<BrandApi>("./workspace-brand-assets.ts", {
    "server-only": {}, "@/lib/workspace-write-access": {}, "@/lib/r2": r2, "@/lib/workspace-brand-storage": policy, "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
    "@/lib/content-image-storage": { verifyContentImage: async () => { checks++; } },
    "@/lib/prisma": { prisma: { workspaceAsset: { findUnique: async () => ({ id: "asset", workspaceId: owner, status }) } } },
  });
  for (const filename of ["video-id.mp4", "video-id.webm", "poster-id.webp", "poster-id.avif"]) await api.verifyRegisteredBrandImage({ workspaceId: "a", kind: "site-hero", key: `workspaces/a/site-hero/${filename}` });
  assert.equal(checks, 4);
  for (const filename of ["video-id.svg", "poster-id.mp4", "image.png", "../video-id.mp4"]) await assert.rejects(api.verifyRegisteredBrandImage({ workspaceId: "a", kind: "site-hero", key: `workspaces/a/site-hero/${filename}` }), /INVALID_BRAND_IMAGE/);
  owner = "b"; await assert.rejects(api.verifyRegisteredBrandImage({ workspaceId: "a", kind: "site-hero", key: "workspaces/a/site-hero/video-id.mp4" }), /INVALID_BRAND_IMAGE/);
  owner = "a"; status = "QUARANTINED"; await assert.rejects(api.verifyRegisteredBrandImage({ workspaceId: "a", kind: "site-hero", key: "workspaces/a/site-hero/video-id.mp4", existingKey: "workspaces/a/site-hero/video-id.mp4" }), /INVALID_BRAND_IMAGE/); assert.equal(checks, 4);
});

for (const [route, kind] of [["about", "about"], ["team-members", "team"]] as const) {
  test(`${route} upload registers company ownership and withholds unsigned failures`, async () => {
    let allow = true;
    let registered = false;
    let signed = 0;
    const ownedKey = `workspaces/a/${kind}/image.webp`;
    const keyFor = (workspaceId: string) => { assert.equal(workspaceId, "a"); return ownedKey; };
    const api = load<{ POST: (request: Request) => Promise<Response> }>(`../app/api/admin/${route}/presign/route.ts`, {
      "next/server": { NextResponse: Response }, "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", userId: "actor", sessionVersion: 7, workspaceId: "a" }) },
      "@/lib/r2-upload": { createAboutPageImageKey: keyFor, createTeamMemberPortraitKey: keyFor, getPublicAssetUrl: () => "https://assets.test/image.webp", createPresignedUploadUrl: async () => { assert.equal(registered, true); signed++; return "signed-url"; } },
      "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { sessionVersion: number; workspaceId: string; actorId: string; kind: string; key: string }, fn: () => Promise<string>) => {
        assert.equal(input.sessionVersion, 7); assert.equal(input.workspaceId, "a"); assert.equal(input.actorId, "actor"); assert.equal(input.kind, kind); assert.equal(input.key, ownedKey);
        if (!allow) throw new Error("INVALID_BRAND_IMAGE"); registered = true; return fn();
      } },
    }, { console: { error() {} } });
    const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ kind: "hero", fileType: "image/webp", fileSize: 100, workspaceId: "b" }) }));
    assert.equal((await call()).status, 200); assert.equal(signed, 1); allow = false;
    const response = await call(); assert.equal(response.status, 500); assert.equal((await response.json()).upload, undefined); assert.equal(signed, 1);
  });
}

test("email campaign upload uses server company and administrator admission before signing", async () => {
  let role = "OWNER", denied = false, registered = false, signs = 0;
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/admin/email-images/presign/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, userId: "actor", workspaceId: "a", sessionVersion: 7 }) },
    "@/lib/r2-upload": {
      validateImageUpload() {}, createEmailCampaignImageKey: (workspaceId: string) => { assert.equal(workspaceId, "a"); return "workspaces/a/email-campaign/image.png"; },
      getPublicAssetUrl: (key: string) => `https://assets.example.test/${key}`,
      createPresignedUploadUrl: async () => { assert.equal(registered, true); signs++; return "synthetic-url"; },
    },
    "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { workspaceId: string; actorId: string; sessionVersion: number; kind: string; key: string; byteSize: number }, fn: () => Promise<string>) => {
      assert.equal(input.workspaceId, "a"); assert.equal(input.actorId, "actor"); assert.equal(input.sessionVersion, 7);
      assert.equal(input.kind, "email-campaign"); assert.equal(input.key, "workspaces/a/email-campaign/image.png"); assert.equal(input.byteSize, 100);
      if (denied) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); registered = true; return fn();
    } },
  });
  const call = () => api.POST(new Request("https://b.example.test/api", { method: "POST", body: JSON.stringify({ fileType: "image/png", fileSize: 100, workspaceId: "b", key: "email/campaigns/foreign.png" }) }));
  assert.equal((await call()).status, 200); assert.equal(signs, 1);
  denied = true; const response = await call(); assert.equal(response.status, 403); assert.equal((await response.json()).upload, undefined); assert.equal(signs, 1);
  role = "EDITOR"; assert.equal((await call()).status, 403); assert.equal(signs, 1);
});

test("email campaign registry requires administrator guard and company key before provider work", async () => {
  let grants = 0, creates = 0, denied = false;
  const tx = { workspaceAsset: { create: async () => { creates++; return { id: "asset" }; } } };
  const api = load<BrandApi>("./workspace-brand-assets.ts", {
    "server-only": {}, "@/lib/r2": r2, "@/lib/workspace-brand-storage": policy, "@/lib/workspace-context-core": {}, "@/lib/content-image-storage": {},
    "@/lib/workspace-write-access": {
      requireLockedWorkspaceEditor: () => { throw new Error("Editor threshold must not admit campaign uploads"); },
      requireLockedWorkspaceAdministrator: async (actual: unknown) => { assert.equal(actual, tx); if (denied) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); },
    },
    "@/lib/prisma": { prisma: { $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx), workspaceAsset: { updateMany: async () => ({ count: 1 }) } } },
  });
  const input = { workspaceId: "a", actorId: "actor", sessionVersion: 7, kind: "email-campaign" as const, key: "workspaces/a/email-campaign/image.png", byteSize: 100 };
  const provision = async () => { grants++; return "synthetic-url"; };
  await api.withBrandUploadAsset(input, provision); assert.equal(creates, 1); assert.equal(grants, 1);
  denied = true; await assert.rejects(api.withBrandUploadAsset(input, provision), /WORKSPACE_WRITE_FORBIDDEN/);
  await assert.rejects(api.withBrandUploadAsset({ ...input, key: "workspaces/b/email-campaign/image.png" }, provision), /INVALID_BRAND_IMAGE/);
  await assert.rejects(api.withBrandUploadAsset({ ...input, key: "email/campaigns/image.png" }, provision), /INVALID_BRAND_IMAGE/);
  assert.equal(creates, 1); assert.equal(grants, 1);
});

test("actual campaign key generator partitions identical filenames by company", () => {
  const api = load<typeof import('./r2-upload')>('./r2-upload.ts', {
    '@/lib/workspace-brand-storage': policy, crypto: { randomUUID: () => '12345678-synthetic' },
    '@aws-sdk/client-s3': {}, '@aws-sdk/s3-request-presigner': {}, '@/lib/r2': r2,
  });
  const a = api.createEmailCampaignImageKey('a', 'image/png');
  const b = api.createEmailCampaignImageKey('b', 'image/png');
  assert.match(a, /^workspaces\/a\/email-campaign\/[a-zA-Z0-9_-]+\.png$/);
  assert.match(b, /^workspaces\/b\/email-campaign\/[a-zA-Z0-9_-]+\.png$/);
  assert.notEqual(a, b);
  assert.throws(() => api.createEmailCampaignImageKey('../b', 'image/png'), /INVALID_BRAND_IMAGE/);
});

test("commit image validation locks current registry authority without provider work, including an absent legacy row", async () => {
  let asset: { id: string; workspaceId: string; status: string } | null = { id: "asset", workspaceId: "a", status: "READY" };
  let insertAfterMiss = false;
  const locks: string[] = [];
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => {
      const sql = parts.join("?"); locks.push(sql);
      if (sql.startsWith("SELECT")) {
        const result = asset ? [{ id: asset.id }] : [];
        if (insertAfterMiss) asset = { id: "inserted", workspaceId: "b", status: "READY" };
        return result;
      }
      return [];
    },
    workspaceAsset: { findUnique: async () => asset },
    workspace: { findMany: async () => [{ id: "a" }] },
  };
  const api = load<BrandApi>("./workspace-brand-assets.ts", {
    "server-only": {}, "@/lib/workspace-write-access": {}, "@/lib/r2": r2, "@/lib/workspace-brand-storage": policy,
    "@/lib/workspace-context-core": { tenantContextEnabled: () => true },
    "@/lib/content-image-storage": { verifyContentImage: () => { throw new Error("Provider forbidden in transaction"); } },
    "@/lib/prisma": { prisma: { workspaceAsset: { findUnique: () => { throw new Error("Must use transaction"); } } } },
  });
  const input = { workspaceId: "a", kind: "testimonials" as const, key };
  const locked = tx as unknown as Parameters<BrandApi['lockRegisteredBrandImage']>[0];
  await api.lockRegisteredBrandImage(locked, input); assert.match(locks.pop()!, /FOR SHARE/);
  asset.status = "QUARANTINED"; await assert.rejects(api.lockRegisteredBrandImage(locked, input), /INVALID_BRAND_IMAGE/);
  asset.status = "READY"; asset.workspaceId = "b"; await assert.rejects(api.lockRegisteredBrandImage(locked, input), /INVALID_BRAND_IMAGE/);
  asset = null; const legacy = { ...input, key: "testimonials/legacy.webp", existingKey: "testimonials/legacy.webp" };
  await api.lockRegisteredBrandImage(locked, legacy); assert.match(locks.pop()!, /LOCK TABLE "Workspace", "WorkspaceAsset" IN SHARE MODE/);
  insertAfterMiss = true; await assert.rejects(api.lockRegisteredBrandImage(locked, legacy), /INVALID_BRAND_IMAGE/);
  assert.match(locks.pop()!, /LOCK TABLE/);
});
