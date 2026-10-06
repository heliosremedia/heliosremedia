import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { normalizeEmail } from "./client-communications/normalization.ts";
import * as tokenRules from "./client-communications/workspace-token-rules.ts";

type Token = { source: string; tokenHash: string; workspaceId: string; messageId: string };
type TokenFactory = { createCampaignDeliveryPreferenceToken: (db: unknown, input: unknown) => Promise<string> };
function load<T>(path: string, modules: Record<string, unknown>): T {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, process: { env: { AUTH_SECRET: "synthetic-campaign-token-signing-secret" } },
    require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}
function fixture() {
  const state = { tenant: true, own: true, issued: false, legacy: false, eligible: true, version: 1, campaign: true, recipient: true, client: true, workspaces: [{ id: "a" }], depth: 0, legacyWrites: 0, writes: 0, previous: null as Token | null };
  const input = { workspaceId: "a", campaignId: "campaign", recipientId: "recipient", expectedCampaignVersion: 1, expectedEmail: "a@example.test", signingSecret: "synthetic-campaign-token-signing-secret" };
  const tx = {
    $queryRaw: async () => [], $executeRaw: async () => 0,
    workspace: { findMany: async () => state.workspaces },
    emailCampaign: { findFirst: async ({ where }: { where: { rowVersion: number } }) => state.campaign && where.rowVersion === state.version ? { id: "campaign", workspaceId: "a" } : null },
    campaignRecipient: { findFirst: async () => state.recipient ? { id: "recipient", clientId: "client", email: input.expectedEmail } : null },
    communicationClient: { findFirst: async () => state.client ? { id: "client" } : null },
    workspaceMarketingPreference: { findUnique: async () => state.own ? { id: "preference" } : null, findUniqueOrThrow: async () => ({ id: "preference" }) },
    marketingEmailPreferenceToken: { findFirst: async () => state.legacy ? { id: "legacy" } : null },
    workspaceMarketingPreferenceToken: {
      findFirst: async ({ where }: { where: { OR?: Array<{ source?: { not: string }; messageId?: string; tokenHash?: { not: string }; workspaceId?: { not: string } }> } }) => where.OR ? state.previous && where.OR.some((condition) => condition.source ? state.previous!.source !== condition.source.not : condition.messageId ? state.previous!.tokenHash !== condition.tokenHash!.not : state.previous!.workspaceId !== condition.workspaceId!.not) ? { id: "conflict" } : null : state.issued || state.previous ? { id: "issued" } : null,
      findUnique: async () => state.previous,
      upsert: async ({ create }: { create: Token }) => { state.writes++; state.previous = { ...create }; return state.previous; },
    },
  };
  const db = { $transaction: async (fn: (transaction: typeof tx) => Promise<unknown>) => { assert.equal(state.depth, 0, "Nested transaction would retain workspace lock"); state.depth++; try { return await fn(tx); } finally { state.depth--; } } };
  const service = load("./client-communications/workspace-consent-tokens.ts", {
    "server-only": {}, "./normalization": { normalizeEmail }, "./preference-rules": { MARKETING_TOKEN_TTL_DAYS: 365 }, "./workspace-token-rules": tokenRules,
    "./workspace-consent": { readWorkspaceMarketingEligibility: async () => ({ eligible: state.eligible }) },
  });
  const factory = load<TokenFactory>("./client-communications/campaign-consent-token.ts", {
    "server-only": {}, "./normalization": { normalizeEmail }, "@/lib/workspace-context-core": { tenantContextEnabled: () => state.tenant },
    "./workspace-consent-tokens": service,
    "./preferences": { createPreferenceToken: async (arg: { clientId: string }, transaction: unknown) => { assert.equal(transaction, tx); assert.equal(state.depth, 1); assert.equal(arg.clientId, "client"); state.legacyWrites++; return "legacy-token"; } },
  });
  return { state, input, db, mint: (extra = {}) => factory.createCampaignDeliveryPreferenceToken(db, { ...input, ...extra }), factory };
}

test("company issuance is stable and hash-only within the same stored execution revision", async () => {
  const f = fixture(); const token = await f.mint(); assert.match(token, /^v2\./); assert.equal(await f.mint(), token);
  assert.equal(f.state.previous!.source, "CAMPAIGN_RECIPIENT_REVISION_1"); assert.equal(f.state.previous!.messageId, "recipient"); assert.equal(f.state.legacyWrites, 0); assert.equal(JSON.stringify(f.state.previous).includes(token), false);
});
test("legacy protocol markers reject a company switch without a write", async () => {
  const f = fixture(); f.state.legacy = true; await assert.rejects(f.mint(), /LEGACY_RETRY_REVIEW_REQUIRED/); assert.equal(f.state.writes, 0);
});
test("changed execution revision or signing identity requires review instead of a new payload", async () => {
  const f = fixture(); await f.mint(); const before = JSON.stringify(f.state.previous);
  f.state.version = 2; await assert.rejects(f.mint({ expectedCampaignVersion: 2 }), /RETRY_REVIEW_REQUIRED/);
  f.state.version = 1; await assert.rejects(f.mint({ signingSecret: "another-synthetic-signing-secret-value" }), /RETRY_REVIEW_REQUIRED/);
  assert.equal(JSON.stringify(f.state.previous), before); assert.equal(f.state.writes, 1);
});
for (const field of ["campaign", "recipient", "client", "eligible"] as const) test(`missing current ${field} rejects issuance`, async () => {
  const f = fixture(); f.state[field] = false; await assert.rejects(f.mint(), /SOURCE_INVALID/); assert.equal(f.state.writes, 0); assert.equal(f.state.legacyWrites, 0);
});
test("legacy issuance remains inside one locked attributable compatibility transaction", async () => {
  const f = fixture(); f.state.tenant = false; f.state.own = false; assert.equal(await f.mint(), "legacy-token"); assert.equal(f.state.legacyWrites, 1); assert.equal(f.state.writes, 0);
});
test("multiple workspaces or existing company tokens never fall back to legacy", async () => {
  for (const mode of ["multiple", "issued"]) { const f = fixture(); f.state.tenant = false; f.state.own = false; f.state.eligible = false;
    if (mode === "multiple") f.state.workspaces.push({ id: "b" }); else f.state.issued = true;
    await assert.rejects(f.mint(), /SOURCE_INVALID/); assert.equal(f.state.legacyWrites, 0);
  }
});
test("actual campaign worker refuses a reclaimed execution after uncertain provider failure", async () => {
  const f = fixture(); let sends = 0; const recipient = { id: "recipient", clientId: "client", email: "a@example.test", status: "PENDING", client: { workspaceMemberships: [{ workspaceId: "a" }], emailSubscribed: true, emailStatus: "VALID", groupMemberships: [] } };
  const db = { ...f.db, emailCampaign: { findUnique: async () => ({ id: "campaign", workspaceId: "a", status: "PROCESSING", rowVersion: f.state.version, recipients: [recipient], subject: "Synthetic", body: "Synthetic" }), update: async ({ data }: { data: unknown }) => data }, campaignRecipient: { updateMany: async ({ data }: { data: { status: string } }) => { recipient.status = data.status; return { count: 1 }; }, count: async ({ where }: { where: { status: string } }) => recipient.status === where.status ? 1 : 0 } };
  const worker = load<{ processEmailCampaign: (id: string) => Promise<unknown> }>("./client-communications/campaign-delivery.ts", {
    "server-only": {}, "./campaign-ownership": { resolveCampaignWorkspace: async () => "a" }, "@/lib/prisma": { prisma: db }, "@/lib/audit": { recordAuditEvent: async () => {} }, "@/lib/site": { getSiteUrl: () => "https://synthetic.example.test" }, "./bounce-core": { bouncedBackSystemKey: () => "bounce" }, "./delivery-consent": { workspaceAddressIsMarketingEligible: async () => true }, "./campaign-consent-token": f.factory,
    "./personalization": { renderPersonalizedEmail: () => ({ subject: "Synthetic", body: "Synthetic" }) },
    "./email": { renderCampaignEmail: ({ unsubscribeToken }: { unsubscribeToken: string }) => unsubscribeToken, sendCampaignBatch: async () => { sends++; throw new Error("Synthetic uncertain provider outcome"); } },
  });
  await worker.processEmailCampaign("campaign"); assert.equal(sends, 1); assert.equal(recipient.status, "FAILED");
  f.state.version = 2; await worker.processEmailCampaign("campaign"); assert.equal(sends, 1); assert.equal(f.state.writes, 1);
});
