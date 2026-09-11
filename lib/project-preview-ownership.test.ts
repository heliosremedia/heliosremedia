import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { normalizeWorkspaceHostname } from "./workspace-context-core.ts";

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console, ...globals,
  });
  return exports as T;
}

test("preview creation and revocation require editor access and the project company", async () => {
  let role = "VIEWER";
  let own = false;
  let created = 0;
  let audits = 0;
  const tx = {
    $queryRaw: async (_query: unknown, projectId: string, workspaceId: string) => {
      assert.equal(projectId, "target"); assert.equal(workspaceId, "a"); return own ? [{ id: projectId }] : [];
    },
    project: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { slug: "listing", title: "Listing" }; } },
    projectPreviewLink: { create: async ({ data }: { data: { tokenHash: string } }) => { assert.equal(data.tokenHash, "hash"); created++; return { id: "preview" }; } },
  };
  const api = load<Record<"POST" | "DELETE", (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response>>>("../app/api/admin/projects/[projectId]/previews/route.ts", {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a", userId: "actor", email: "actor@example.test" }) },
    "@/lib/audit": { recordAuditEvent: async () => { audits++; } },
    "@/lib/prisma": { prisma: {
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      projectPreviewLink: { updateMany: async ({ where }: { where: { project: { workspaceId: string }; projectId: string } }) => {
        assert.equal(where.project.workspaceId, "a"); assert.equal(where.projectId, "target"); return { count: own ? 1 : 0 };
      } },
    } },
    "@/lib/project-preview": { createPreviewToken: () => "secret-token", hashPreviewToken: () => "hash" },
    "@/lib/project-preview-url": { getWorkspacePreviewUrl: async (workspaceId: string, path: string) => { assert.equal(workspaceId, "a"); return `https://a.example.test${path}`; } },
  });
  const call = (method: "POST" | "DELETE") => api[method](new Request("https://studio.example.test/api?previewId=preview", { method, ...(method === "POST" ? { body: JSON.stringify({ days: 7, workspaceId: "b" }) } : {}) }), { params: Promise.resolve({ projectId: "target" }) });
  for (const method of ["POST", "DELETE"] as const) assert.equal((await call(method)).status, 403);
  role = "EDITOR";
  for (const method of ["POST", "DELETE"] as const) assert.equal((await call(method)).status, 404);
  assert.equal(created, 0); assert.equal(audits, 0);
  own = true;
  const response = await call("POST");
  assert.equal(response.status, 201);
  assert.match((await response.json()).preview.url, /^https:\/\/a\.example\.test\/portfolio\/listing\?preview=/);
  assert.equal((await call("DELETE")).status, 200);
  assert.equal(created, 1); assert.equal(audits, 2);
});

test("preview validation never touches another company's token and rechecks revocation", async () => {
  let present = false;
  let revoked = false;
  let touches = 0;
  const api = load<{ validateProjectPreview: (slug: string, token: string, workspaceId: string) => Promise<unknown> }>("./project-preview.ts", {
    "server-only": {}, "node:crypto": crypto,
    "@/lib/prisma": { prisma: { projectPreviewLink: {
      findFirst: async ({ where }: { where: { project: { slug: string; workspaceId: string } } }) => { assert.equal(where.project.workspaceId, "a"); return present ? { id: "preview", projectId: "own" } : null; },
      updateMany: async ({ where }: { where: { project: { workspaceId: string }; revokedAt: null; expiresAt: unknown } }) => {
        assert.equal(where.project.workspaceId, "a"); assert.equal(where.revokedAt, null); assert.ok(where.expiresAt); touches++; return { count: revoked ? 0 : 1 };
      },
    } } },
  });
  const token = crypto.randomBytes(32).toString("base64url");
  assert.equal(await api.validateProjectPreview("listing", token, "a"), null);
  assert.equal(touches, 0);
  present = true; revoked = true;
  assert.equal(await api.validateProjectPreview("listing", token, "a"), null);
  revoked = false;
  assert.ok(await api.validateProjectPreview("listing", token, "a"));
  assert.equal(await api.validateProjectPreview("listing", token, ""), null);
});

test("preview URLs require an unambiguous active company domain in tenant mode", async () => {
  let enabled = true;
  let domains = [] as Array<{ hostname: string; primary: boolean }>;
  const api = load<{ getWorkspacePreviewUrl: (id: string, path: string) => Promise<string> }>("./project-preview-url.ts", {
    "server-only": {}, "@/lib/site": { getAbsoluteUrl: (path: string) => `https://legacy.example.test${path}` },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled, normalizeWorkspaceHostname },
    "@/lib/prisma": { prisma: {
      workspace: { findMany: async () => [{ id: "a" }] },
      workspaceDomain: { findMany: async ({ where }: { where: { workspaceId: string; purpose: string; status: string } }) => {
        assert.equal(where.workspaceId, "a"); assert.equal(where.purpose, "PUBLIC_SITE"); assert.equal(where.status, "ACTIVE"); return domains;
      } },
    } },
  });
  const path = "/portfolio/listing?preview=token";
  await assert.rejects(api.getWorkspacePreviewUrl("a", path), /PREVIEW_DOMAIN_REQUIRED/);
  domains = [{ hostname: "a.example.test", primary: true }];
  assert.equal(await api.getWorkspacePreviewUrl("a", path), `https://a.example.test${path}`);
  domains.push({ hostname: "alias.example.test", primary: true });
  await assert.rejects(api.getWorkspacePreviewUrl("a", path), /PREVIEW_DOMAIN_REQUIRED/);
  enabled = false;
  assert.equal(await api.getWorkspacePreviewUrl("a", path), `https://legacy.example.test${path}`);
});

test("media mutation permissions and scoped deletion retain unverified storage references", async () => {
  let role = "VIEWER";
  let own = false;
  let deletes = 0;
  const api = load<Record<"POST" | "PATCH" | "DELETE", (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response>>>("../app/api/admin/projects/[projectId]/media/route.ts", {
    "@aws-sdk/client-s3": {}, "next/cache": {}, "next/server": { NextResponse: Response },
    "@/lib/workspace-assets": {}, "@/lib/media-collections": {}, "@/lib/cloudflare-stream": {}, "@/lib/external-media": {},
    "@/lib/r2": {}, "@/lib/r2-upload": {}, "@/lib/service-media": {}, "@/lib/project-media-upload": {},
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/prisma": { prisma: { media: {
      findFirst: async ({ where }: { where: { project: { workspaceId: string } } }) => {
        assert.equal(where.project.workspaceId, "a");
        return own ? { id: "media", storageKey: "workspaces/b/foreign.webp", provider: "CLOUDFLARE_STREAM", externalId: "foreign-provider-id" } : null;
      },
      deleteMany: async ({ where }: { where: { project: { workspaceId: string }; projectId: string } }) => {
        assert.equal(where.project.workspaceId, "a"); assert.equal(where.projectId, "target"); deletes++; return { count: 1 };
      },
    } } },
  });
  const call = (method: "POST" | "PATCH" | "DELETE") => api[method](new Request("https://example.test/api", { method, body: JSON.stringify({ mediaId: "media" }) }), { params: Promise.resolve({ projectId: "target" }) });
  for (const method of ["POST", "PATCH", "DELETE"] as const) assert.equal((await call(method)).status, 403);
  role = "EDITOR";
  assert.equal((await call("DELETE")).status, 404);
  assert.equal(deletes, 0);
  own = true;
  const response = await call("DELETE");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).storageCleanupPending, true);
  assert.equal(deletes, 1);
  // Provider and R2 mocks expose no deletion capability, even for corrupt keys.
});

test("Stream provisioning checks editor and project ownership before the unchanged provider request", async () => {
  let role = "VIEWER";
  let own = false;
  let provisions = 0;
  const api = load<{ POST: (request: Request, context: { params: Promise<{ projectId: string }> }) => Promise<Response> }>("../app/api/admin/projects/[projectId]/stream-upload/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/cloudflare-stream": { isCloudflareStreamUid: (uid: string) => /^[a-f0-9]{32}$/i.test(uid) },
    "@/lib/workspace-assets": {
      beginStreamUploadAsset: async () => ({ id: "asset" }),
      bindStreamUploadAsset: async () => {}, failStreamUploadAsset: async () => {},
    },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/prisma": { prisma: { project: { findFirst: async ({ where }: { where: { workspaceId: string } }) => {
      assert.equal(where.workspaceId, "a"); return own ? { id: "target" } : null;
    } } } },
  }, {
    Buffer, process: { env: { CLOUDFLARE_STREAM_ACCOUNT_ID: "test-account", CLOUDFLARE_STREAM_API_TOKEN: "fake-test-token" } },
    fetch: async (_url: string, options: { headers: Record<string, string> }) => {
      provisions++; assert.equal(options.headers["Tus-Resumable"], "1.0.0");
      assert.equal(options.headers["Upload-Length"], "100");
      assert.match(options.headers["Upload-Metadata"], /maxDurationSeconds /);
      return new Response(null, { status: 201, headers: { location: "https://upload.example.test/session", "stream-media-id": "a".repeat(32) } });
    },
  });
  const call = () => api.POST(new Request("https://example.test/api", { method: "POST", headers: { "upload-length": "100", "tus-resumable": "1.0.0" } }), { params: Promise.resolve({ projectId: "target" }) });
  assert.equal((await call()).status, 403);
  role = "EDITOR";
  assert.equal((await call()).status, 404);
  assert.equal(provisions, 0);
  own = true;
  assert.equal((await call()).status, 201);
  assert.equal(provisions, 1);
});
