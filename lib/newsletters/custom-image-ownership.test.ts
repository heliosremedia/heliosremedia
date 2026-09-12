import { brandAssetPrefix } from "../workspace-brand-storage.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as sourceImages from "./source-images.ts";

test("managed custom images require owned usable records before object verification", async () => {
  const exports: { verifyNewsletterCustomImage?: (input: { workspaceId: string; url: string; existingUrl?: string }) => Promise<void> } = {};
  let asset: { workspaceId: string; status: string } | null = null;
  let enabled = true;
  let companies = [{ id: "a" }];
  const checks: string[] = [];
  const modules: Record<string, unknown> = {
    "server-only": {}, "./source-images": sourceImages,
    "@/lib/r2": { r2Config: { publicUrl: "https://assets.example/root", accountId: "account", bucketName: "bucket" } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/content-image-storage": { verifyContentImage: async (key: string) => { checks.push(key); } },
    "@/lib/prisma": { prisma: {
      workspaceAsset: { findUnique: async ({ where }: { where: { provider_providerNamespace_providerKey: { providerNamespace: string } } }) => { assert.equal(where.provider_providerNamespace_providerKey.providerNamespace, '["account","bucket"]'); return asset; } },
      workspace: { findMany: async () => companies },
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./custom-image-ownership.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Error, process: { env: {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const verify = exports.verifyNewsletterCustomImage!;
  const url = "https://assets.example/root/workspaces/a/newsletter/image.png";
  await assert.rejects(verify({ workspaceId: "a", url }), /no verified upload/);
  asset = { workspaceId: "b", status: "READY" };
  await assert.rejects(verify({ workspaceId: "a", url }), /not available/);
  asset.workspaceId = "a";
  for (const status of ["FAILED", "QUARANTINED", "RETIRED", "UPLOAD_PENDING"]) {
    asset.status = status;
    await assert.rejects(verify({ workspaceId: "a", url, existingUrl: url }), /not available/);
  }
  assert.equal(checks.length, 0);
  asset.status = "UPLOAD_PROVISIONED";
  await verify({ workspaceId: "a", url });
  assert.deepEqual(checks, ["workspaces/a/newsletter/image.png"]);
  await verify({ workspaceId: "a", url, existingUrl: url });
  assert.equal(checks.length, 1);
  const foreignUrl = url.replace("workspaces/a/", "workspaces/b/");
  await assert.rejects(verify({ workspaceId: "a", url: foreignUrl, existingUrl: foreignUrl }), /not available/);
  await assert.rejects(verify({ workspaceId: "a", url: `${url}?download=1` }), /not available/);
  asset = null;
  const legacy = "https://assets.example/root/email/newsletters/a/image.png";
  await verify({ workspaceId: "a", url: legacy, existingUrl: legacy });
  await assert.rejects(verify({ workspaceId: "a", url: legacy }), /no verified upload/);
  enabled = false;
  await verify({ workspaceId: "a", url: legacy });
  companies = [{ id: "a" }, { id: "b" }];
  await assert.rejects(verify({ workspaceId: "a", url: legacy }), /no verified upload/);
  await verify({ workspaceId: "a", url: "https://external.example/photo.png?width=300" });
  await assert.rejects(verify({ workspaceId: "a", url: "https://assets.example/root/projects/foreign/photo.png" }), /not available/);
});

test("Newsletter presign registers the actor's upload before returning a signed URL", async () => {
  const events: string[] = [];
  let fail = false;
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ workspaceId: "a", userId: "actor" }) },
    "@/lib/r2-upload": {
      validateImageUpload: () => {}, createNewsletterImageKey: () => "workspaces/a/newsletter/image.png",
      createPresignedUploadUrl: async () => { events.push("sign"); return "https://signed.example"; }, getPublicAssetUrl: () => "https://assets.example/image.png",
    },
    "@/lib/workspace-brand-assets": { withBrandUploadAsset: async (input: { workspaceId: string; actorId: string; kind: string; byteSize: number }, provision: () => Promise<string>) => {
      assert.equal(input.workspaceId, "a"); assert.equal(input.actorId, "actor"); assert.equal(input.kind, "newsletter"); assert.equal(input.byteSize, 100);
      events.push("register"); if (fail) throw new Error("Registration failed"); return provision();
    } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../../app/api/admin/newsletters/images/presign/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const request = () => new Request("https://studio.example", { method: "POST", body: JSON.stringify({ fileName: "image.png", fileType: "image/png", fileSize: 100 }) });
  assert.equal((await exports.POST!(request())).status, 200);
  assert.deepEqual(events, ["register", "sign"]);
  events.length = 0; fail = true;
  const response = await exports.POST!(request());
  assert.equal(response.status, 500);
  assert.equal((await response.json()).upload, undefined);
  assert.deepEqual(events, ["register"]);
});


test("Newsletter upload keys reject lossy company normalization", () => {
  const exports: { createNewsletterImageKey?: (workspaceId: string, mime: string) => string } = {};
  const modules: Record<string, unknown> = {
    "@/lib/workspace-brand-storage": { brandAssetPrefix }, "crypto": { randomUUID: () => "12345678-1234" },
    "@aws-sdk/client-s3": {}, "@aws-sdk/s3-request-presigner": {}, "@/lib/r2": {},
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../r2-upload.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const key = exports.createNewsletterImageKey!;
  assert.match(key("a-b", "image/png"), /^workspaces\/a-b\/newsletter\/[a-zA-Z0-9_-]+\.png$/);
  assert.notEqual(key("a-b", "image/png"), key("ab", "image/png"));
  for (const id of ["", "a/b", "a b", "a%2fb", ".."]) assert.throws(() => key(id, "image/png"), /INVALID_BRAND_IMAGE/);
});
