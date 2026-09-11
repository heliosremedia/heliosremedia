import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import * as audience from "./referrals/audience.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (id: string) => { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, Date, console,
  });
  return exports as T;
}
const scopeModule = { getContentOwnershipScope: async (workspaceId: string) => { if (!workspaceId) throw new Error("Missing company"); return { workspaceId }; } };

test("referral audience rejects foreign selections and all-eligible still uses company membership", async () => {
  let queried = 0;
  const api = load<{ estimateReferralAudience: (input: { workspaceId: string; mode: string; groupIds: string[]; clientIds: string[]; excludedClientIds: string[] }) => Promise<{ eligible: Array<{ id: string }> }> }>("./referrals/studio.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/blog-ownership": scopeModule, "@/lib/audit": {},
    "./audience": audience, "./state-machine": {}, "./operations": {},
    "@/lib/prisma": { prisma: {
      communicationGroup: { count: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, "a"); return 0; } },
      communicationClient: {
        count: async ({ where }: { where: { workspaceMemberships: { some: { workspaceId: string } } } }) => { assert.equal(where.workspaceMemberships.some.workspaceId, "a"); return 0; },
        findMany: async ({ where, include }: { where: { workspaceMemberships: { some: { workspaceId: string } } }; include: { groupMemberships: { where: { group: { workspaceId: string } } } } }) => {
          assert.equal(where.workspaceMemberships.some.workspaceId, "a"); assert.equal(include.groupMemberships.where.group.workspaceId, "a"); queried++;
          return [{ id: "owned-client", normalizedEmail: "test@example.test", email: "test@example.test", emailSubscribed: true, emailStatus: "VALID", archivedAt: null, newsletterSuppressions: [], groupMemberships: [] }];
        },
      },
    } },
  });
  const input = { workspaceId: "a", mode: "ALL_ELIGIBLE", groupIds: [], clientIds: [], excludedClientIds: [] };
  await assert.rejects(api.estimateReferralAudience({ ...input, groupIds: ["foreign"] }), /unavailable/);
  await assert.rejects(api.estimateReferralAudience({ ...input, clientIds: ["foreign"] }), /unavailable/);
  assert.equal(queried, 0);
  assert.deepEqual((await api.estimateReferralAudience(input)).eligible.map(item => item.id), ["owned-client"]);
});

test("referral campaign creation stamps server ownership instead of submitted ownership", async () => {
  const tx = {
    referralCampaign: { create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); return { id: "campaign", internalName: "Draft" }; } },
    referralAuditEvent: { create: async () => ({}) },
  };
  const api = load<{ createReferralCampaign: (input: Record<string, unknown>, actor: Record<string, string>) => Promise<unknown> }>("./referrals/studio.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/blog-ownership": scopeModule, "./audience": audience, "./state-machine": {}, "./operations": {},
    "@/lib/audit": { recordAuditEvent: async (event: { workspaceId: string }) => { assert.equal(event.workspaceId, "a"); } },
    "@/lib/prisma": { prisma: {
      communicationGroup: { count: async () => 0 }, communicationClient: { count: async () => 0, findMany: async () => [] },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } },
  });
  assert.ok(await api.createReferralCampaign({ workspaceId: "b", audienceMode: "ALL_ELIGIBLE", groupIds: [], clientIds: [], excludedClientIds: [], filters: {} }, { workspaceId: "a", userId: "actor", email: "test@example.test" }));
});

test("stale referral approval stops before creating an immutable revision", async () => {
  const tx = { referralCampaign: { updateMany: async ({ where }: { where: { workspaceId: string; rowVersion: number } }) => {
    assert.equal(where.workspaceId, "a"); assert.equal(where.rowVersion, 3); return { count: 0 };
  } } };
  const api = load<{ approveReferralCampaign: (id: string, actor: Record<string, string>) => Promise<unknown> }>("./referrals/studio.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/blog-ownership": scopeModule, "./audience": audience, "./state-machine": {}, "./operations": {}, "@/lib/audit": {},
    "@/lib/prisma": { prisma: {
      referralCampaign: { findFirst: async () => ({ status: "DRAFT", rowVersion: 3, audienceMode: "ALL_ELIGIBLE", audienceRules: {} }) },
      communicationGroup: { count: async () => 0 }, communicationClient: { count: async () => 0, findMany: async () => [{ id: "client", normalizedEmail: "test@example.test", emailSubscribed: true, emailStatus: "VALID", groupMemberships: [], newsletterSuppressions: [] }] },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } },
  });
  await assert.rejects(api.approveReferralCampaign("campaign", { workspaceId: "a", userId: "actor", email: "test@example.test" }), /updated in another tab/);
});

test("referral public and test links are scoped before exposing campaign content", async () => {
  const common = {
    "server-only": {}, "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" }, "@/lib/blog-ownership": scopeModule,
  };
  const publicApi = load<{ getPublicReferralCampaign: (token: string) => Promise<unknown> }>("./referrals/public.ts", {
    ...common, "node:crypto": crypto, "./tokens": { hashReferralToken: () => "hash" }, "./attribution": {},
    "@/lib/prisma": { prisma: { referralLink: { findFirst: async ({ where }: { where: { campaign: { workspaceId: string }; advocate: { campaign: { workspaceId: string } } } }) => {
      assert.equal(where.campaign.workspaceId, "a"); assert.equal(where.advocate.campaign.workspaceId, "a"); return null;
    } } } },
  });
  assert.equal(await publicApi.getPublicReferralCampaign("foreign-token"), null);
  const testApi = load<{ getReferralTestPreview: (token: string) => Promise<unknown> }>("./referrals/test-preview.ts", {
    ...common, "./tokens": { hashReferralTestToken: () => "hash" },
    "@/lib/prisma": { prisma: { referralTestToken: { findFirst: async ({ where }: { where: { campaign: { workspaceId: string } } }) => {
      assert.equal(where.campaign.workspaceId, "a"); return null;
    } } } },
  });
  assert.equal(await testApi.getReferralTestPreview("foreign-test-token"), null);
});

test("referral campaign API rejects foreign targets before diagnostics, editing or delivery actions", async () => {
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response }, "@/lib/blog-ownership": scopeModule,
    "@/lib/referrals/access": { getReferralAdminSession: async () => ({ workspaceId: "a", userId: "actor", email: "test@example.test" }) },
    "@/lib/prisma": { prisma: { referralCampaign: { findFirst: async ({ where }: { where: { workspaceId: string; createdBy?: unknown } }) => {
      assert.equal(where.workspaceId, "a"); assert.equal(where.createdBy, undefined); return null;
    } } } },
  };
  for (const id of ["@/lib/audit", "@/lib/client-communications/email", "@/lib/referrals/email-renderer", "@/lib/referrals/studio", "@/lib/referrals/launch", "@/lib/referrals/launch-contract", "@/lib/referrals/validation", "@/lib/referrals/test-preview", "@/lib/referrals/operations", "@/lib/referrals/scheduling", "@/lib/site", "@/lib/client-communications/scheduling"]) modules[id] = {};
  const api = load<Record<"GET" | "PUT" | "POST", (request: Request, context: { params: Promise<{ campaignId: string }> }) => Promise<Response>>>("../app/api/admin/referrals/campaigns/[campaignId]/route.ts", modules);
  for (const method of ["GET", "PUT", "POST"] as const) {
    const response = await api[method](new Request("https://example.test/api", { method }), { params: Promise.resolve({ campaignId: "foreign" }) });
    assert.equal(response.status, 404);
  }
});

test("referral execution never infers stored ownership from a moved creator", async () => {
  let enabled = false;
  let rows = [{ id: "a" }];
  const api = load<{ legacyReferralExecutionWorkspace: (id: string | null) => Promise<string | null> }>("./referrals/ownership.ts", {
    "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => enabled },
    "@/lib/prisma": { prisma: { workspace: { findMany: async () => rows } } },
  });
  assert.equal(await api.legacyReferralExecutionWorkspace("a"), "a");
  assert.equal(await api.legacyReferralExecutionWorkspace(null), "a");
  assert.equal(await api.legacyReferralExecutionWorkspace("b"), null);
  rows = [{ id: "a" }, { id: "b" }];
  assert.equal(await api.legacyReferralExecutionWorkspace("a"), null);
  rows = [{ id: "a" }]; enabled = true;
  assert.equal(await api.legacyReferralExecutionWorkspace("a"), null);
});

test("referral delivery rejects foreign client relationships before consent checks, claims or providers", async () => {
  const communication = {
    campaignId: "campaign-a", campaign: { workspaceId: "a" }, submission: null,
    invitation: { campaignId: "campaign-a", advocate: { client: { workspaceMemberships: [{ workspaceId: "b" }], normalizedEmail: "test@example.test" } } },
    recipientEmail: "test@example.test",
  };
  const api = load<{ processReferralCommunications: () => Promise<{ skipped: number; claimed: number; sent: number }> }>("./referrals/delivery.ts", {
    "server-only": {}, "@/lib/blog-ownership": scopeModule,
    "./ownership": { legacyReferralExecutionWorkspace: async () => "a" },
    "@/lib/prisma": { prisma: { referralCommunication: { findMany: async () => [communication] } } },
    "@/lib/client-communications/email": {}, "@/lib/client-communications/preferences": {}, "@/lib/site": {}, "./operations": {}, "./state-machine": {},
  });
  const result = await api.processReferralCommunications();
  assert.equal(result.skipped, 1); assert.equal(result.claimed, 0); assert.equal(result.sent, 0);
});

test("owned legacy referral delivery retains provider behavior and rechecks approval at claim", async () => {
  let sent = 0;
  const communication = {
    id: "communication", campaignId: "campaign-a", kind: "INVITATION", idempotencyKey: "stable-key", subject: "Approved subject",
    htmlSnapshot: '<a href="https://example.test/unsubscribe?token=stub">Unsubscribe</a>',
    campaign: { workspaceId: "a", status: "ACTIVE", approvedRevisionId: "revision", scheduledRevisionId: "revision", scheduleVersion: 2 }, submission: null,
    invitation: { id: "invitation", campaignId: "campaign-a", advocate: { _count: { submissions: 0 }, client: { workspaceMemberships: [{ workspaceId: "a" }], normalizedEmail: "test@example.test", emailSubscribed: true, emailStatus: "VALID", newsletterSuppressions: [] } } },
    recipientEmail: "test@example.test",
  };
  const api = load<{ processReferralCommunications: () => Promise<{ sent: number }> }>("./referrals/delivery.ts", {
    "server-only": {}, "@/lib/blog-ownership": scopeModule, "./ownership": { legacyReferralExecutionWorkspace: async () => "a" },
    "@/lib/client-communications/email": { sendCampaignBatch: async (input: { source: string; messages: Array<{ to: string }> }) => {
      assert.equal(input.source, "referral"); assert.equal(input.messages[0].to, "test@example.test"); sent++; return [{ id: "mock-provider-id" }];
    } },
    "@/lib/client-communications/preferences": { addressIsMarketingEligible: async () => true }, "@/lib/site": {},
    "./operations": { referralScheduleIsRunnable: () => true }, "./state-machine": { campaignCanExecute: () => true },
    "@/lib/prisma": { prisma: {
      referralCommunication: {
        findMany: async () => [communication], update: async () => ({}),
        updateMany: async ({ where }: { where: { campaign: { workspaceId: string; approvedRevisionId: string; scheduledRevisionId: string; scheduleVersion: number } } }) => {
          assert.equal(where.campaign.workspaceId, "a"); assert.equal(where.campaign.approvedRevisionId, "revision");
          assert.equal(where.campaign.scheduledRevisionId, "revision"); assert.equal(where.campaign.scheduleVersion, 2); return { count: 1 };
        },
      },
      referralInvitation: { update: async () => ({}) }, referralCampaign: { update: async () => ({}) }, referralAuditEvent: { create: async () => ({}) },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    } },
  });
  assert.equal((await api.processReferralCommunications()).sent, 1);
  assert.equal(sent, 1);
});

test("referral preparation rejects a foreign approval snapshot before claiming or generating tokens", async () => {
  const api = load<{ processReferralLaunch: (id: string, attempt: string) => Promise<unknown> }>("./referrals/launch.ts", {
    "server-only": {}, "node:crypto": crypto, "@/lib/blog-ownership": scopeModule,
    "./ownership": { legacyReferralExecutionWorkspace: async () => "a" },
    "@/app/generated/prisma/client": {}, "@/lib/audit": {}, "@/lib/site": {}, "@/lib/client-communications/preferences": {}, "./email-renderer": {}, "./tokens": {}, "./launch-contract": {},
    "@/lib/prisma": { prisma: { referralCampaign: { findUnique: async () => ({ workspaceId: "a", status: "LAUNCHING", launchAttemptId: "attempt", approvedRevision: { snapshot: { workspaceId: "b" } } }) } } },
  });
  assert.equal(await api.processReferralLaunch("campaign-a", "attempt"), null);
});

test("referral ownership expansion preserves campaign history and legacy writers", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "ReferralCampaign" (id TEXT PRIMARY KEY, status TEXT, "createdAt" TIMESTAMP, "createdById" TEXT);
      INSERT INTO "Workspace" VALUES ('a'),('b');
      INSERT INTO "ReferralCampaign" VALUES ('legacy','ACTIVE',now(),'actor');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911235000_referral_campaign_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "ReferralCampaign" (id,"workspaceId","createdById") VALUES ('owned','a','actor');
      INSERT INTO "ReferralCampaign" (id) VALUES ('old-writer');
      UPDATE "ReferralCampaign" SET "createdById"='replacement' WHERE id='owned';`);
    assert.deepEqual((await db.query(`SELECT "workspaceId" FROM "ReferralCampaign" WHERE id='owned'`)).rows, [{ workspaceId: 'a' }]);
    assert.equal((await db.query(`SELECT id FROM "ReferralCampaign" WHERE "workspaceId" IS NULL`)).rows.length, 2);
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`), /foreign key/i);
  } finally { await db.close(); }
});
