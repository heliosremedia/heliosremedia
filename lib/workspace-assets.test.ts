import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, Date, URL, console, ...globals,
  });
  return exports as T;
}
const stream = { isCloudflareStreamUid: (uid: string) => /^[a-f0-9]{32}$/i.test(uid), getCloudflareStreamEmbedUrl: (uid: string) => `https://iframe.videodelivery.net/${uid}` };
const uid = "a".repeat(32);
type AssetApi = typeof import("./workspace-assets");

test("Stream attachment trusts stored owner and status, never a submitted UID alone", async () => {
  let asset: { id: string; workspaceId: string; status: string } | null = null;
  let enabled = true;
  let companies = [{ id: "a" }];
  const env = { CLOUDFLARE_STREAM_ACCOUNT_ID: "account", STUDIO_V2_ASSET_OWNERSHIP_ENABLED: "false" };
  const api = load<AssetApi>("./workspace-assets.ts", {
    "server-only": {}, "@/lib/cloudflare-stream": stream,
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/prisma": { prisma: {
      workspaceAsset: { findUnique: async ({ where }: { where: { provider_providerNamespace_providerKey: { providerNamespace: string; providerKey: string } } }) => {
        assert.equal(where.provider_providerNamespace_providerKey.providerNamespace, "account"); assert.equal(where.provider_providerNamespace_providerKey.providerKey, uid); return asset;
      } }, workspace: { findMany: async () => companies },
    } },
  }, { process: { env } });
  await assert.rejects(api.resolveStreamAssetForAttachment("a", uid), /INVALID_STREAM_ASSET/);
  enabled = false;
  assert.equal(await api.resolveStreamAssetForAttachment("a", uid), null);
  companies = [{ id: "a" }, { id: "b" }];
  await assert.rejects(api.resolveStreamAssetForAttachment("a", uid), /INVALID_STREAM_ASSET/);
  companies = [{ id: "a" }]; env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED = "true";
  await assert.rejects(api.resolveStreamAssetForAttachment("a", uid), /INVALID_STREAM_ASSET/);
  env.STUDIO_V2_ASSET_OWNERSHIP_ENABLED = "false";
  asset = { id: "asset", workspaceId: "b", status: "UPLOAD_PROVISIONED" };
  await assert.rejects(api.resolveStreamAssetForAttachment("a", uid), /INVALID_STREAM_ASSET/);
  asset.workspaceId = "a";
  for (const status of ["UPLOAD_PENDING", "FAILED", "QUARANTINED", "RETIRED"]) {
    asset.status = status;
    await assert.rejects(api.resolveStreamAssetForAttachment("a", uid), /INVALID_STREAM_ASSET/);
  }
  for (const status of ["UPLOAD_PROVISIONED", "READY"]) {
    asset.status = status;
    assert.equal(await api.resolveStreamAssetForAttachment("a", uid), "asset");
  }
  await assert.rejects(api.resolveStreamAssetForAttachment("a", "url-or-foreign-key"), /INVALID_STREAM_ASSET/);
});

test("upload intents verify the project and bind a provider ID only once", async () => {
  let own = false;
  let created = 0;
  let row = { providerKey: null as string | null, status: "UPLOAD_PENDING" };
  let stale = false;
  const api = load<AssetApi>("./workspace-assets.ts", {
    "server-only": {}, "@/lib/cloudflare-stream": stream, "@/lib/workspace-context-core": {},
    "@/lib/prisma": { prisma: {
      project: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return own ? { id: "project" } : null; } },
      workspaceAsset: {
        create: async ({ data }: { data: { workspaceId: string; byteSize: bigint; provenance: { projectId: string; actorId: string } } }) => {
          assert.equal(data.workspaceId, "a"); assert.equal(data.byteSize, BigInt(100)); assert.equal(data.provenance.projectId, "project"); assert.equal(data.provenance.actorId, "actor"); created++; return { id: "asset" };
        },
        findFirst: async ({ where }: { where: { workspaceId: string; providerNamespace: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.providerNamespace, "account"); return row; },
        updateMany: async ({ where, data }: { where: { workspaceId: string; status: string; providerKey: null }; data: typeof row }) => {
          assert.equal(where.workspaceId, "a"); assert.equal(where.status, "UPLOAD_PENDING"); assert.equal(where.providerKey, null);
          if (stale) return { count: 0 }; row = data; return { count: 1 };
        },
      },
    } },
  });
  const input = { workspaceId: "a", projectId: "project", actorId: "actor", providerNamespace: "account", byteSize: 100, expiresAt: new Date() };
  await assert.rejects(api.beginStreamUploadAsset(input), /INVALID_ASSET_UPLOAD/); assert.equal(created, 0);
  own = true; await api.beginStreamUploadAsset(input); assert.equal(created, 1);
  const binding = { assetId: "asset", workspaceId: "a", providerNamespace: "account", uid };
  await api.bindStreamUploadAsset(binding); await api.bindStreamUploadAsset(binding);
  await assert.rejects(api.bindStreamUploadAsset({ ...binding, uid: "b".repeat(32) }), /INVALID_STREAM_ASSET/);
  row = { providerKey: null, status: "UPLOAD_PENDING" }; stale = true;
  await assert.rejects(api.bindStreamUploadAsset(binding), /INVALID_STREAM_ASSET/);
});

test("provisioning returns an upload URL only after its server-received ID is durably bound", async () => {
  const events: string[] = [];
  let providerId: string | null = uid;
  let bindingFails = false;
  const api = load<{ POST: (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> }>("../app/api/admin/projects/[projectId]/stream-upload/route.ts", {
    "next/server": { NextResponse: Response }, "@/lib/cloudflare-stream": stream,
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a", userId: "actor" }) },
    "@/lib/prisma": { prisma: { project: { findFirst: async () => ({ id: "project" }) } } },
    "@/lib/workspace-assets": {
      beginStreamUploadAsset: async ({ workspaceId }: { workspaceId: string }) => { assert.equal(workspaceId, "a"); events.push("intent"); return { id: "asset" }; },
      bindStreamUploadAsset: async (input: { uid: string; assetId: string }) => { assert.equal(input.uid, uid); assert.equal(input.assetId, "asset"); events.push("bind"); if (bindingFails) throw new Error("binding failed"); },
      failStreamUploadAsset: async () => { events.push("failed"); },
    },
  }, {
    Buffer, process: { env: { CLOUDFLARE_STREAM_ACCOUNT_ID: "account", CLOUDFLARE_STREAM_API_TOKEN: "fake-token" } }, console: { error() {} },
    fetch: async () => { events.push("provider"); return new Response(null, { status: 201, headers: { Location: "https://upload.example.test/not-the-video-id", ...(providerId ? { "stream-media-id": providerId } : {}) } }); },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", headers: { "upload-length": "100", "tus-resumable": "1.0.0" } }), { params: Promise.resolve({ projectId: "project" }) });
  let response = await call(); assert.equal(response.status, 201); assert.equal(response.headers.get("stream-media-id"), uid);
  assert.deepEqual(events.splice(0), ["intent", "provider", "bind"]);
  providerId = null; response = await call(); assert.equal(response.status, 502); assert.equal(response.headers.get("location"), null);
  assert.deepEqual(events.splice(0), ["intent", "provider", "failed"]);
  providerId = uid; bindingFails = true; response = await call(); assert.equal(response.status, 500); assert.equal(response.headers.get("location"), null);
  assert.deepEqual(events, ["intent", "provider", "bind", "failed"]);
});

test("media creation rejects unowned Stream IDs before creating a media row", async () => {
  let allowed = false;
  let creates = 0;
  const api = load<{ POST: (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> }>("../app/api/admin/projects/[projectId]/media/route.ts", {
    "@aws-sdk/client-s3": {}, "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response },
    "@/lib/media-collections": { isMediaCategory: () => true }, "@/lib/cloudflare-stream": stream, "@/lib/external-media": {},
    "@/lib/r2": {}, "@/lib/r2-upload": {}, "@/lib/service-media": { mediaCategoryForServiceSlug: () => "VIDEO" }, "@/lib/project-media-upload": {},
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "EDITOR", workspaceId: "a" }) },
    "@/lib/workspace-assets": { resolveStreamAssetForAttachment: async (workspaceId: string, key: string) => { assert.equal(workspaceId, "a"); assert.equal(key, uid); if (!allowed) throw new Error("INVALID_STREAM_ASSET"); return "asset"; } },
    "@/lib/prisma": { prisma: {
      project: { findFirst: async () => ({ id: "project" }) }, service: { findFirst: async () => ({ id: "service", slug: "video" }) },
      media: { findFirst: async () => null, aggregate: async () => ({ _max: { displayOrder: 0 } }), create: async ({ data }: { data: { assetId: string; projectId: string } }) => { assert.equal(data.assetId, "asset"); assert.equal(data.projectId, "project"); creates++; return { id: "media" }; } },
    } },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ streamUid: uid, originalFilename: "Video", mediaCategory: "VIDEO", workspaceId: "b" }) }), { params: Promise.resolve({ projectId: "project" }) });
  assert.equal((await call()).status, 400); assert.equal(creates, 0);
  allowed = true; assert.equal((await call()).status, 201); assert.equal(creates, 1);
});

test("asset registry expansion preserves old media writes and prevents provider key collisions", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Workspace" ("id" TEXT PRIMARY KEY); CREATE TABLE "Media" ("id" TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES (\'a\'), (\'b\'); INSERT INTO "Media" VALUES (\'legacy\');');
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911235500_workspace_asset_registry/migration.sql", import.meta.url), "utf8"));
    await db.exec('INSERT INTO "Media" ("id") VALUES (\'old-writer\');');
    const insert = (id: string, owner: string, key: string | null) => db.query('INSERT INTO "WorkspaceAsset" ("id", "workspaceId", "provider", "providerNamespace", "providerKey", "provenance", "updatedAt") VALUES ($1,$2,\'CLOUDFLARE_STREAM\',\'account\',$3,\'{}\',NOW())', [id, owner, key]);
    await insert("one", "a", uid);
    await assert.rejects(insert("foreign-claim", "b", uid), /unique/i);
    await assert.rejects(insert("no-owner", "missing", "b".repeat(32)), /foreign key/i);
    await assert.rejects(db.exec('UPDATE "WorkspaceAsset" SET "workspaceId" = \'b\' WHERE "id" = \'one\';'), /immutable/i);
    await assert.rejects(db.exec('UPDATE "WorkspaceAsset" SET "providerKey" = NULL WHERE "id" = \'one\';'), /immutable/i);
    await insert("pending-one", "a", null); await insert("pending-two", "b", null);
    await db.exec('UPDATE "Media" SET "assetId" = \'one\' WHERE "id" = \'legacy\';');
    await assert.rejects(db.exec('DELETE FROM "WorkspaceAsset" WHERE "id" = \'one\';'), /foreign key/i);
    await assert.rejects(db.exec('DELETE FROM "Workspace" WHERE "id" = \'b\';'), /foreign key/i);
    assert.equal((await db.query<{ assetId: string | null }>('SELECT "assetId" FROM "Media" WHERE "id" = \'old-writer\'')).rows[0].assetId, null);
  } finally { await db.close(); }
});
