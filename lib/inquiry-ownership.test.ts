import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; },
    Error, URL, Date, Response, console, process: { env: {} },
  });
  return exports as T;
}

test("inquiry mutations reject foreign parents, viewers and foreign assignees before child writes", async () => {
  let role = "EDITOR";
  let owner = "b";
  let children = 0;
  let audits = 0;
  const tx = {
    inquiry: {
      updateMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return { count: owner === "a" ? 1 : 0 }; },
      findFirstOrThrow: async () => ({ status: "NEW", assignedToId: null }),
      update: async () => { throw new Error("Unexpected workflow update"); },
    },
    adminUser: { findFirst: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return null; } },
    inquiryNote: { create: async () => { children++; return { id: "note" }; } },
    inquiryActivity: { create: async () => { children++; } },
  };
  const api = load<{ PATCH: (request: Request) => Promise<Response> }>("../app/api/admin/inquiries/route.ts", {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: Response },
    "@/app/generated/prisma/client": { InquiryStatus: { NEW: "NEW", CONTACTED: "CONTACTED" } },
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a", userId: "actor", email: "actor@example.test" }) },
    "@/lib/prisma": { prisma: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } },
    "@/lib/audit": { recordAuditEvent: async () => { audits++; } },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/inquiry-ownership": { inquiryAssigneeWhere: (workspaceId: string) => ({ workspaceId, active: true }) },
  });
  const request = (action: string) => new Request("https://example.test/api", { method: "PATCH", body: JSON.stringify({ action, inquiryId: "target", note: "Internal", assignedToId: "foreign", status: "CONTACTED" }) });
  for (const action of ["add-note", "update-workflow"]) assert.equal((await api.PATCH(request(action))).status, 404);
  assert.equal(children, 0);
  owner = "a";
  role = "VIEWER";
  assert.equal((await api.PATCH(request("add-note"))).status, 403);
  role = "EDITOR";
  assert.equal((await api.PATCH(request("update-workflow"))).status, 400);
  assert.equal(children, 0);
  assert.equal(audits, 0);
  assert.equal((await api.PATCH(request("add-note"))).status, 200);
  assert.equal(children, 2);
  assert.equal(audits, 1);
});

test("inquiry notifications fail closed for tenant mode, multiple companies and wrong company", async () => {
  let enabled = false;
  let rows = [{ id: "a" }];
  const policy = load<{ canUseLegacyInquiryNotifications: (id: string) => Promise<boolean>; inquiryAssigneeWhere: (id: string) => unknown }>("./inquiry-ownership.ts", {
    "server-only": {}, "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
  });
  assert.equal(await policy.canUseLegacyInquiryNotifications("a"), true);
  assert.equal(await policy.canUseLegacyInquiryNotifications("b"), false);
  rows = [{ id: "a" }, { id: "b" }];
  assert.equal(await policy.canUseLegacyInquiryNotifications("a"), false);
  enabled = true; rows = [{ id: "a" }];
  assert.equal(await policy.canUseLegacyInquiryNotifications("a"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(policy.inquiryAssigneeWhere("a"))), {
    active: true, workspaceId: "a", workspaceMemberships: { some: { workspaceId: "a", status: "ACTIVE" } },
  });
});

test("public inquiry containment stops before storing or delivering tenant data", async () => {
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/inquiries/route.ts", {
    "node:crypto": {}, "next/server": { NextResponse: Response }, "@/lib/prisma": { prisma: {} },
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "b" },
    "@/lib/inquiry-ownership": { canUseLegacyInquiryNotifications: async () => false },
    "@/lib/blog-ownership": {}, "@/lib/inquiry-notifications": {},
  });
  const response = await api.POST(new Request("https://b.example.test/api/inquiries", { method: "POST", body: JSON.stringify({ consent: true, renderedAt: Date.now() - 5000 }) }));
  assert.equal(response.status, 503);
});

test("legacy inquiry submission stores its resolved company and preserves notification calls", async () => {
  let notifications = 0;
  const api = load<{ POST: (request: Request) => Promise<Response> }>("../app/api/inquiries/route.ts", {
    "node:crypto": { createHmac: () => ({ update: () => ({ digest: () => "test-hash" }) }) },
    "next/server": { NextResponse: Response },
    "@/lib/prisma": { prisma: {
      inquiry: {
        count: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return 0; },
        create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); return { id: "owned-inquiry" }; },
      },
      service: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return []; } },
    } },
    "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/inquiry-ownership": { canUseLegacyInquiryNotifications: async () => true },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/inquiry-notifications": {
      sendInquiryNotification: async () => { notifications++; },
      sendInquiryConfirmation: async () => { notifications++; },
    },
  });
  const response = await api.POST(new Request("https://a.example.test/api/inquiries", { method: "POST", body: JSON.stringify({
    consent: true, renderedAt: Date.now() - 5000, name: "Test Agent", email: "test@example.test", workspaceId: "b",
  }) }));
  assert.equal(response.status, 201);
  assert.equal(notifications, 2);
});

test("inquiry expansion preserves old writes and ownership survives reassignment", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "Inquiry" (id TEXT PRIMARY KEY, status TEXT, "createdAt" TIMESTAMP, "assignedToId" TEXT);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      INSERT INTO "Inquiry" VALUES ('legacy','NEW',now(),NULL);`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911230000_inquiry_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "Inquiry" (id,status,"workspaceId") VALUES ('owned','NEW','a');
      INSERT INTO "Inquiry" (id,status) VALUES ('old-app','NEW');
      UPDATE "Inquiry" SET "assignedToId"='moved-user' WHERE id='owned';`);
    assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "Inquiry" WHERE id='owned'`)).rows, [{ workspaceId: 'a' }]);
    assert.equal((await db.query(`SELECT id FROM "Inquiry" WHERE "workspaceId"='b'`)).rows.length, 0);
    assert.equal((await db.query(`SELECT id FROM "Inquiry" WHERE "workspaceId" IS NULL`)).rows.length, 2);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
  } finally { await db.close(); }
});

test("inquiry export scopes parents and service names and rejects viewers", async () => {
  let role = "VIEWER";
  let queries = 0;
  const api = load<{ GET: () => Promise<Response> }>("../app/api/admin/inquiries/export/route.ts", {
    "@/lib/auth/session": { getAdminSession: async () => ({ role, workspaceId: "a" }) },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/inquiry-ownership": { inquiryAssigneeWhere: (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { inquiry: { findMany: async (query: { where: { workspaceId: string }; include: { requestedServices: { where: { service: { workspaceId: string } } }; assignedTo: { where: { workspaceId: string } } } }) => {
      queries++;
      assert.equal(query.where.workspaceId, "a");
      assert.equal(query.include.requestedServices.where.service.workspaceId, "a");
      assert.equal(query.include.assignedTo.where.workspaceId, "a");
      return [];
    } } } },
  });
  assert.equal((await api.GET()).status, 403);
  assert.equal(queries, 0);
  role = "EDITOR";
  assert.equal((await api.GET()).status, 200);
  assert.equal(queries, 1);
});
