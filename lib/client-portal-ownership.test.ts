import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as validation from "./client-portal/validation.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, URL, Date, console,
  });
  return exports as T;
}
const next = { NextResponse: { json: Response.json, redirect: (url: URL) => new Response(null, { status: 307, headers: { location: url.toString() } }) } };
const scopeModule = { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) };

test("portal administration scopes defaults and rejects foreign mutation before changing them", async () => {
  let role = "EDITOR";
  let defaults = 0;
  const model = {
    findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return null; },
    findUnique: async () => null,
    findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; },
    aggregate: async () => ({ _max: { displayOrder: 0 } }),
    updateMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); defaults++; },
    deleteMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { count: 0 }; },
    create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); return data; },
  };
  const tx = { clientPortal: model, $queryRaw: async (_query: unknown, workspaceId: string) => { assert.equal(workspaceId, "a"); return [{ id: "a" }]; } };
  const api = load<Record<"GET" | "POST" | "PATCH" | "DELETE", (request: Request) => Promise<Response>>>("../app/api/admin/client-portals/route.ts", {
    "next/server": next, "next/cache": { revalidatePath() {} },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/blog-ownership": scopeModule, "@/lib/client-portal/validation": validation,
    "@/lib/prisma": { prisma: { clientPortal: model, $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
  });
  const call = (method: "GET" | "POST" | "PATCH" | "DELETE") => api[method](new Request("https://example.test/api?id=foreign", { method, ...(method === "POST" || method === "PATCH" ? { body: JSON.stringify({ id: "foreign", name: "Portal", provider: "EXTERNAL", isDefault: true, workspaceId: "b" }) } : {}) }));
  for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) assert.equal((await call(method)).status, 403);
  role = "ADMIN";
  assert.equal((await call("PATCH")).status, 404);
  assert.equal((await call("DELETE")).status, 404);
  assert.equal(defaults, 0);
  assert.equal((await call("GET")).status, 200);
  assert.equal((await call("POST")).status, 201);
  assert.equal(defaults, 1);
});

test("public portal challenge rejects foreign slugs, contains the provider and preserves external links", async () => {
  let portal: Record<string, unknown> | null = null;
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/client-portal/challenge/route.ts", {
    "next/server": next, "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/blog-ownership": scopeModule, "@/lib/client-portal/ownership": { canUseLegacyPortalProvider: async () => false },
    "@/lib/client-portal/validation": validation, "@/lib/client-portal/email": {}, "@/lib/client-portal/hdphotohub": {}, "@/lib/client-portal/tokens": {}, "@/lib/site-settings": {},
    "@/lib/prisma": { prisma: { clientPortal: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return portal; } } } },
  });
  const call = () => api.POST(new Request("https://a.example.test/api", { method: "POST", body: JSON.stringify({ slug: "portal", email: "test@example.test" }) }));
  assert.equal((await call()).status, 404);
  portal = { id: "a-portal", provider: "HDPHOTOHUB" };
  assert.equal((await call()).status, 503);
  portal = { id: "a-portal", provider: "EXTERNAL", loginUrl: "https://owned.example.test/login" };
  const response = await call();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).redirectUrl, "https://owned.example.test/login");
});

test("portal registration challenges are bound to the public company before provider access", async () => {
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/client-portal/register/route.ts", {
    "next/server": next, "next/headers": { cookies: async () => ({ get: () => ({ value: "test-cookie" }) }) },
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" }, "@/lib/blog-ownership": scopeModule,
    "@/lib/client-portal/ownership": { canUseLegacyPortalProvider: async () => true },
    "@/lib/client-portal/tokens": { verifyRegistrationSession: () => ({ portalId: "foreign", challengeId: "challenge", email: "test@example.test" }) },
    "@/lib/client-portal/validation": validation, "@/lib/client-portal/hdphotohub": {},
    "@/lib/prisma": { prisma: { clientPortalChallenge: { findFirst: async ({ where }: { where: { portal: { workspaceId: string } } }) => { assert.equal(where.portal.workspaceId, "a"); return null; } } } },
  });
  const response = await api.POST(new Request("https://a.example.test/api", { method: "POST", body: "{}" }));
  assert.equal(response.status, 401);
});

test("portal verification excludes foreign challenges before consumption or SSO", async () => {
  const api = load<{ GET: (request: Request) => Promise<Response> }>("../app/api/client-portal/verify/route.ts", {
    "next/server": next, "next/headers": {},
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" }, "@/lib/blog-ownership": scopeModule,
    "@/lib/client-portal/ownership": { canUseLegacyPortalProvider: async () => true },
    "@/lib/client-portal/tokens": { hashPortalToken: () => "hash" },
    "@/lib/client-portal/validation": validation, "@/lib/client-portal/hdphotohub": {},
    "@/lib/prisma": { prisma: { clientPortalChallenge: { findFirst: async ({ where }: { where: { portal: { workspaceId: string } } }) => { assert.equal(where.portal.workspaceId, "a"); return null; } } } },
  });
  const response = await api.GET(new Request("https://a.example.test/api?token=foreign-token"));
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location")!, /access\+link\+is\+invalid/);
});

test("legacy portal challenge preserves creation and verification email using scoped settings", async () => {
  let sent = 0;
  let created = 0;
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/client-portal/challenge/route.ts", {
    "next/server": next, "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" }, "@/lib/blog-ownership": scopeModule,
    "@/lib/client-portal/ownership": { canUseLegacyPortalProvider: async () => true },
    "@/lib/client-portal/validation": validation,
    "@/lib/client-portal/tokens": { createPortalToken: () => "test-token", hashPortalToken: () => "hash", portalRequestFingerprint: () => "fingerprint" },
    "@/lib/client-portal/hdphotohub": { getHdPhotoHubUser: async () => null },
    "@/lib/site-settings": { getSiteSettings: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return { businessName: "Company A" }; } },
    "@/lib/client-portal/email": { sendPortalVerificationEmail: async (input: { businessName: string; purpose: string; verificationUrl: string }) => {
      assert.equal(input.businessName, "Company A"); assert.equal(input.purpose, "REGISTER");
      assert.equal(new URL(input.verificationUrl).origin, "https://a.example.test"); sent++;
    } },
    "@/lib/prisma": { prisma: {
      clientPortal: { findFirst: async () => ({ id: "owned-portal", provider: "HDPHOTOHUB", registrationEnabled: true }) },
      clientPortalChallenge: {
        count: async () => 0,
        create: async ({ data }: { data: { portalId: string; tokenHash: string } }) => { assert.equal(data.portalId, "owned-portal"); assert.equal(data.tokenHash, "hash"); created++; return { id: "challenge" }; },
      },
    } },
  });
  const response = await api.POST(new Request("https://a.example.test/api", { method: "POST", body: JSON.stringify({ slug: "portal", email: "test@example.test" }) }));
  assert.equal(response.status, 200);
  assert.equal(created, 1); assert.equal(sent, 1);
});

test("legacy portal provider use requires one matching company and tenant mode disabled", async () => {
  let enabled = false;
  let rows = [{ id: "a" }];
  const api = load<{ canUseLegacyPortalProvider: (workspaceId: string) => Promise<boolean> }>("./client-portal/ownership.ts", {
    "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
  });
  assert.equal(await api.canUseLegacyPortalProvider("a"), true);
  assert.equal(await api.canUseLegacyPortalProvider("b"), false);
  rows = [{ id: "a" }, { id: "b" }];
  assert.equal(await api.canUseLegacyPortalProvider("a"), false);
  rows = [{ id: "a" }]; enabled = true;
  assert.equal(await api.canUseLegacyPortalProvider("a"), false);
});

test("portal ownership expansion retains legacy records and challenges", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "ClientPortal" (id TEXT PRIMARY KEY, slug TEXT UNIQUE, active BOOLEAN, "displayOrder" INTEGER);
      CREATE TABLE "ClientPortalChallenge" (id TEXT PRIMARY KEY, "portalId" TEXT REFERENCES "ClientPortal");
      INSERT INTO "Workspace" VALUES ('a'),('b');
      INSERT INTO "ClientPortal" VALUES ('legacy','legacy',true,0);
      INSERT INTO "ClientPortalChallenge" VALUES ('challenge','legacy');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911234500_client_portal_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "ClientPortal" (id,slug,"workspaceId") VALUES ('owned','owned','a');
      INSERT INTO "ClientPortal" (id,slug) VALUES ('old-writer','old-writer');`);
    assert.equal((await db.query(`SELECT id FROM "ClientPortalChallenge"`)).rows.length, 1);
    assert.equal((await db.query(`SELECT id FROM "ClientPortal" WHERE "workspaceId"='b'`)).rows.length, 0);
    assert.equal((await db.query(`SELECT id FROM "ClientPortal" WHERE "workspaceId" IS NULL`)).rows.length, 2);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
  } finally { await db.close(); }
});
