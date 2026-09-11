import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path: string, modules: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, require: (id: string) => modules[id] ?? {} });
  return exports;
}

test("campaign ownership uses stored identity and refuses ambiguous historical campaigns", async () => {
  let enabled = true;
  let rows = [{ id: "a" }];
  const loaded = load("./campaign-ownership.ts", {
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
    "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/auth/session": { getAdminSession: async () => ({ role: "ADMIN", workspaceId: "a" }) },
  });
  assert.equal(await loaded.resolveCampaignWorkspace("original-company"), "original-company");
  await assert.rejects(loaded.resolveCampaignWorkspace(null));
  enabled = false; assert.equal(await loaded.resolveCampaignWorkspace(null), "a");
  rows = [{ id: "a" }, { id: "b" }]; await assert.rejects(loaded.resolveCampaignWorkspace(null));
  assert.equal(await loaded.getCampaignAdminSession(), null);
});

test("campaign delivery uses stored workspace and excludes foreign client membership before tokens or sending", async () => {
  let tokens = 0;
  let sends = 0;
  let skipped = 0;
  const recipients = ["a", "b"].map(company => ({ id: `recipient-${company}`, clientId: `client-${company}`, email: `${company}@example.com`, displayName: company, status: "PENDING", client: { workspaceMemberships: [{ workspaceId: company }], archivedAt: null, emailSubscribed: true, emailStatus: "VALID", groupMemberships: [] } }));
  const loaded = load("./campaign-delivery.ts", {
    "./campaign-ownership": { resolveCampaignWorkspace: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return workspaceId; } },
    "@/lib/audit": { recordAuditEvent: async () => {} },
    "@/lib/site": { getSiteUrl: () => "https://company-a.example" },
    "./bounce-core": { bouncedBackSystemKey: (id: string) => `BOUNCED_BACK:${id}` },
    "./personalization": { renderPersonalizedEmail: () => ({ subject: "Subject", body: "Copy", previewText: "Preview" }) },
    "./preferences": { addressIsMarketingEligible: async () => true, createPreferenceToken: async ({ clientId }: { clientId: string }) => { assert.equal(clientId, "client-a"); tokens++; return "synthetic-token"; } },
    "./email": { renderCampaignEmail: () => "<p>Test</p>", sendCampaignBatch: async ({ messages }: { messages: Array<{ to: string }> }) => { assert.equal(messages.length, 1); assert.equal(messages[0].to, "a@example.com"); sends++; return [{ id: "fake-provider-id" }]; } },
    "@/lib/prisma": { prisma: {
      emailCampaign: { findUnique: async () => ({ id: "campaign", workspaceId: "a", createdBy: { workspaceId: "b" }, status: "PROCESSING", recipients, subject: "Subject", body: "Copy", rowVersion: 1 }), update: async ({ data }: { data: { sentCount: number } }) => data },
      campaignRecipient: { updateMany: async ({ data }: { data: { status: string } }) => { assert.equal(data.status, "SKIPPED"); skipped++; }, update: async () => {}, count: async ({ where }: { where: { status: string } }) => where.status === "SKIPPED" ? 1 : 0 },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } },
  });
  const result = await loaded.processEmailCampaign("campaign") as { sentCount: number };
  assert.equal(result.sentCount, 1); assert.equal(tokens, 1); assert.equal(sends, 1); assert.equal(skipped, 1);
});

test("foreign scheduled campaigns cannot be cancelled or sent by the API", async () => {
  let writes = 0;
  const loaded = load("../../app/api/admin/email-campaigns/[campaignId]/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/client-communications/campaign-ownership": { getCampaignAdminSession: async () => ({ role: "ADMIN", workspaceId: "a" }) },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/prisma": { prisma: { emailCampaign: { findUnique: async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => { assert.equal(where.AND[0].workspaceId, "a"); return null; }, updateMany: async () => { writes++; } } } },
  });
  for (const action of ["cancel", "send-now"]) {
    const response = await loaded.PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ action }) }), { params: Promise.resolve({ campaignId: "foreign" }) }) as Response;
    assert.equal(response.status, 409);
  }
  assert.equal(writes, 0);
});

test("campaign migration preserves old writes and campaign history without inferring creator ownership", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a'),('b');
      CREATE TABLE "EmailCampaign" (id TEXT PRIMARY KEY, subject TEXT, "createdById" TEXT); INSERT INTO "EmailCampaign" VALUES ('legacy','Original','moved-actor');`);
    await db.exec(readFileSync(new URL("../../prisma/migrations/20260911210000_email_campaign_workspace_expand/migration.sql", import.meta.url), "utf8"));
    const row = (await db.query<{ workspaceId: string | null; subject: string }>(`SELECT "workspaceId",subject FROM "EmailCampaign" WHERE id='legacy'`)).rows[0];
    assert.equal(row.workspaceId, null); assert.equal(row.subject, "Original");
    await db.exec(`INSERT INTO "EmailCampaign" (id) VALUES ('old-app'); INSERT INTO "EmailCampaign" (id,"workspaceId") VALUES ('owned','a');`);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
