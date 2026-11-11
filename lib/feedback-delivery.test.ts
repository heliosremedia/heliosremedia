/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated Prisma/provider test doubles; no live dependencies are loaded. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as feedback from "./feedback.ts";
import * as personalization from "./client-communications/personalization.ts";
import * as bounce from "./client-communications/bounce-core.ts";

function loadModule(imports: Record<string, unknown>) {
  const compiled = ts.transpileModule(fs.readFileSync("lib/client-communications/campaign-delivery.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const evaluatedModule = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (!(name in imports)) throw new Error(`Unmocked dependency: ${name}`);
    return imports[name];
  }, evaluatedModule, evaluatedModule.exports);
  return evaluatedModule.exports;
}
function recipient(id: string, extra: Record<string, unknown> = {}) {
  return { id, clientId: id, email: `${id}@example.com`, displayName: id, firstNameSnapshot: id, status: "PENDING", createdAt: new Date(),
    client: { archivedAt: null, emailSubscribed: true, emailStatus: "VALID", normalizedEmail: `${id}@example.com`, groupMemberships: [] }, ...extra };
}
function harness() {
  const campaign: any = { id: "feedback-campaign", status: "PROCESSING", selection: { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id, workspaceId: "helios" },
    subject: "Hi {{FIRST_NAME}}", body: "Please share your thoughts.", previewText: "A quick note", templateKey: "PERSONAL_LETTER", rowVersion: 4,
    createdBy: { workspaceId: "helios" }, recipients: [recipient("eligible"), recipient("removed"), recipient("suppressed"), recipient("unsubscribed"), recipient("bounced"), recipient("changed-email")] };
  campaign.recipients[3].client.emailSubscribed = false;
  campaign.recipients[4].client.groupMemberships = [{ group: { systemKey: "BOUNCED_BACK:helios" } }];
  campaign.recipients[5].client.normalizedEmail = "new@example.com";
  const calls = { batches: [] as any[], members: [] as any[], updates: [] as any[], preferenceChecks: [] as string[], tokens: [] as any[] };
  const stale: any[] = [];
  const db: any = {
    emailCampaign: {
      findUnique: async () => campaign,
      update: async ({ data }: any) => { Object.assign(campaign, data); return campaign; },
      findMany: async ({ where }: any) => where.status === "PROCESSING" ? stale : [],
      updateMany: async (args: any) => { calls.updates.push(args); return { count: 1 }; },
    },
    communicationClientWorkspace: { findMany: async (args: any) => {
      calls.members.push(args);
      assert.equal(args.where.workspaceId, "helios");
      return campaign.recipients.filter((row: any) => row.clientId !== "removed").map((row: any) => ({ clientId: row.clientId }));
    } },
    campaignRecipient: {
      updateMany: async ({ where, data }: any) => { for (const row of campaign.recipients) if (where.id.in.includes(row.id)) Object.assign(row, data); return { count: 1 }; },
      update: async ({ where, data }: any) => { const row = campaign.recipients.find((row: any) => row.id === where.id); Object.assign(row, data); return row; },
      count: async ({ where }: any) => campaign.recipients.filter((row: any) => row.status === where.status).length,
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const api = loadModule({
    "server-only": {}, "@/lib/audit": { recordAuditEvent: async () => {} }, "@/lib/feedback": feedback, "@/lib/prisma": { prisma: db },
    "./email": { renderCampaignEmail: (input: any) => input.body, sendCampaignBatch: async (input: any) => {
      calls.batches.push(input); return input.messages.map((_: any, index: number) => ({ id: `provider-${index}` }));
    } },
    "./personalization": personalization,
    "./preferences": { addressIsMarketingEligible: async (email: string) => { calls.preferenceChecks.push(email); return email !== "suppressed@example.com"; },
      createPreferenceToken: async (input: unknown) => { calls.tokens.push(input); return "stable-unsubscribe-token"; } },
    "@/lib/site": { getSiteUrl: () => "https://studio.example.com" }, "./bounce-core": bounce,
  });
  return { api, db, campaign, calls, stale };
}

test("Feedback dispatch rechecks tenant membership, email identity, unsubscribe, bounce and suppression", async () => {
  const { api, campaign, calls } = harness();
  const result = await api.processEmailCampaign(campaign.id);
  assert.equal(calls.members.length, 1);
  assert.equal(calls.batches.length, 1);
  assert.deepEqual(calls.batches[0].messages.map((message: any) => message.to), ["eligible@example.com"]);
  assert.equal(calls.batches[0].messages[0].subject, "Hi eligible");
  assert.ok(calls.batches[0].messages[0].html.endsWith(feedback.FEEDBACK_REQUIRED_FOOTER));
  assert.match(calls.batches[0].messages[0].unsubscribeUrl, /api\/unsubscribe\?token=stable-unsubscribe-token/);
  assert.deepEqual(calls.tokens, [{ clientId: "eligible", campaignId: campaign.id }]);
  assert.equal(campaign.recipients.filter((row: any) => row.status === "SKIPPED").length, 5);
  assert.equal(result.sentCount, 1);
  assert.equal(result.status, "SENT");
});

test("a moved creator or mismatched immutable workspace prevents every Feedback send", async () => {
  const { api, campaign, calls } = harness();
  campaign.createdBy.workspaceId = "other";
  await api.processEmailCampaign(campaign.id);
  assert.equal(calls.members.length, 0);
  assert.equal(calls.batches.length, 0);
  assert.equal(campaign.recipients.every((row: any) => row.status === "SKIPPED"), true);
});

test("ordinary campaigns keep their existing batch path, body and revision identity", async () => {
  const { api, campaign, calls } = harness();
  campaign.selection = { groupIds: [], clientIds: [] };
  campaign.recipients = [recipient("eligible")];
  await api.processEmailCampaign(campaign.id);
  assert.equal(calls.members.length, 0);
  assert.equal(calls.batches[0].revisionKey, "4");
  assert.equal(calls.batches[0].messages[0].html, campaign.body);
});

test("stale Feedback processing fails closed; only ordinary campaigns automatically requeue", async () => {
  const { api, stale, calls } = harness();
  stale.push(
    { id: "uncertain", rowVersion: 2, selection: { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, recipients: [{ status: "PENDING" }] },
    { id: "partially-accepted", rowVersion: 5, selection: { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, recipients: [{ status: "SENT" }, { status: "PENDING" }] },
    { id: "ordinary", rowVersion: 1, selection: {}, recipients: [{ status: "PENDING" }] },
  );
  assert.deepEqual(await api.claimDueEmailCampaigns(), []);
  const uncertain = calls.updates.find((call) => call.where.id === "uncertain");
  assert.equal(uncertain.data.status, "FAILED");
  assert.equal(uncertain.where.rowVersion, 2);
  assert.match(uncertain.data.scheduleError, /outcomes may be uncertain.*retry is disabled/);
  const partial = calls.updates.find((call) => call.where.id === "partially-accepted");
  assert.equal(partial.data.status, "PARTIAL");
  assert.equal(partial.data.sentCount, 1);
  const requeue = calls.updates.filter((call) => call.data.status === "SCHEDULED");
  assert.equal(requeue.length, 1);
  assert.deepEqual(requeue[0].where.id.in, ["ordinary"]);
  assert.equal(calls.batches.length, 0);
});

test("a crash after every acceptance was recorded finalizes Feedback without resending", async () => {
  const { api, stale, calls } = harness();
  stale.push({ id: "fully-accepted", rowVersion: 5, selection: { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, recipients: [{ status: "SENT" }, { status: "SKIPPED" }] });
  await api.claimDueEmailCampaigns();
  assert.equal(calls.updates[0].data.status, "SENT");
  assert.equal(calls.updates[0].data.sentCount, 1);
  assert.equal(calls.updates[0].data.scheduleError, null);
  assert.equal(calls.updates.some((call) => call.data.status === "SCHEDULED"), false);
  assert.equal(calls.batches.length, 0);
});
