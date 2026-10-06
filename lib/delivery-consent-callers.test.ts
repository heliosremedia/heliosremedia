import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Error, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}
for (const workspaceId of ["a", "b"]) test(`campaign ${workspaceId} excludes a company opt-out before token issuance or provider calls`, async () => {
  let checked = 0, skipped = 0;
  const campaign = { id: "campaign", workspaceId, status: "PROCESSING", recipients: [{ id: "recipient", status: "PENDING", email: "shared@example.test", client: { workspaceMemberships: [{ workspaceId }], archivedAt: null, emailSubscribed: true, emailStatus: "VALID", groupMemberships: [] } }] };
  const db = { emailCampaign: { findUnique: async () => campaign, update: async () => ({ status: "FAILED" }) }, campaignRecipient: { updateMany: async ({ data }: { data: { status: string } }) => { assert.equal(data.status, "SKIPPED"); skipped++; }, count: async ({ where }: { where: { status: string } }) => where.status === "SKIPPED" ? 1 : 0 } };
  const api = load<{ processEmailCampaign: (id: string) => Promise<unknown> }>("./client-communications/campaign-delivery.ts", {
    "server-only": {}, "./campaign-ownership": { resolveCampaignWorkspace: async (id: string) => id }, "@/lib/prisma": { prisma: db }, "@/lib/audit": { recordAuditEvent: async () => {} },
    "./delivery-consent": { workspaceAddressIsMarketingEligible: async (reader: unknown, id: string, email: string) => { assert.equal(reader, db); assert.equal(id, workspaceId); assert.equal(email, "shared@example.test"); checked++; return false; } },
    "./preferences": { createPreferenceToken: () => assert.fail("Opt-out reached token issuance") }, "./email": { sendCampaignBatch: () => assert.fail("Opt-out reached provider") }, "./personalization": {}, "@/lib/site": {}, "./bounce-core": { bouncedBackSystemKey: () => "bounce" },
  });
  await api.processEmailCampaign("campaign"); assert.equal(checked, 1); assert.equal(skipped, 1);
});
for (const workspaceId of ["a", "b"]) test(`referral ${workspaceId} cancels a company opt-out before claim or provider`, async () => {
  let checked = 0, cancelled = 0;
  const row = { id: "communication", campaignId: "campaign", kind: "INVITATION", campaign: { workspaceId, status: "ACTIVE" }, submission: null, invitation: { campaignId: "campaign", advocate: { client: { workspaceMemberships: [{ workspaceId }], normalizedEmail: "shared@example.test", emailSubscribed: true, emailStatus: "VALID", newsletterSuppressions: [] } } }, recipientEmail: "shared@example.test", htmlSnapshot: "Synthetic" };
  const db = { referralCommunication: { findMany: async () => [row], update: async ({ data }: { data: { status: string; failureCode: string } }) => { assert.equal(data.status, "CANCELLED"); assert.equal(data.failureCode, "RECIPIENT_INELIGIBLE"); cancelled++; }, updateMany: () => assert.fail("Opt-out reached claim") } };
  const api = load<{ processReferralCommunications: () => Promise<{ sent: number; skipped: number }> }>("./referrals/delivery.ts", {
    "server-only": {}, "@/lib/blog-ownership": {}, "./ownership": { legacyReferralExecutionWorkspace: async (id: string) => id }, "@/lib/prisma": { prisma: db }, "@/lib/client-communications/email": { sendCampaignBatch: () => assert.fail("Opt-out reached provider") },
    "@/lib/client-communications/delivery-consent": { workspaceAddressIsMarketingEligible: async (reader: unknown, id: string, email: string) => { assert.equal(reader, db); assert.equal(id, workspaceId); assert.equal(email, "shared@example.test"); checked++; return false; } },
    "@/lib/site": {}, "./operations": { referralScheduleIsRunnable: () => true }, "./state-machine": { campaignCanExecute: () => true },
  });
  const result = await api.processReferralCommunications(); assert.equal(result.sent, 0); assert.equal(result.skipped, 1); assert.equal(checked, 1); assert.equal(cancelled, 1);
});
