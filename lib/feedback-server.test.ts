/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated Prisma/provider test doubles; no live dependencies are loaded. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as feedback from "./feedback.ts";
import * as personalization from "./client-communications/personalization.ts";
import * as emailFormat from "./client-communications/email-format.ts";
import * as scheduling from "./client-communications/scheduling.ts";
import * as bounce from "./client-communications/bounce-core.ts";
import * as presentation from "./newsletters/presentation.ts";

function loadModule(path: string, imports: Record<string, unknown>): any {
  const compiled = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const evaluatedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (!(name in imports)) throw new Error(`Unmocked dependency: ${name}`);
    return imports[name];
  }, evaluatedModule, evaluatedModule.exports);
  return evaluatedModule.exports;
}
const session = { userId: "admin", email: "owner@example.com", role: "OWNER", workspaceId: "helios" };
const draftId = "457be3a0-1b43-45ba-9551-8f93eea1e815";
const operationId = "b6f91a42-5c61-4aec-9ff5-3b3f7cd98a68";
const draftInput = () => ({ ...feedback.newFeedbackDraft(), id: draftId });
const scheduleInput = (rowVersion = 1, count = 1) => ({ action: "schedule", rowVersion, anonymousAcknowledged: true, expectedRecipientCount: count, scheduledLocal: "2099-01-20T10:00", scheduledTimeZone: "America/Denver" });
function client(id: string, tenant = "helios", extra: Record<string, unknown> = {}) {
  return { id, tenant, firstName: id, lastName: "Client", displayName: `${id} Client`, email: `${id}@example.com`, normalizedEmail: `${id}@example.com`, phone: null,
    emailSubscribed: true, emailStatus: "VALID", archivedAt: null, groupMemberships: [{ group: { id: "group1", name: "Local clients" } }], ...extra };
}
function harness() {
  const rows = new Map<string, any>();
  const snapshots = new Map<string, any[]>();
  const clients = [client("alice"), client("bob"), client("foreign", "other"), client("unsubscribed"), client("suppressed")];
  const calls = { create: 0, update: [] as any[], deleted: 0, sent: [] as any[], audience: [] as any[], audit: [] as any[] };
  const state = { claimConflict: false, originalAvailable: true, session: { ...session }, testEligible: true };
  function matches(row: any, where: any) {
    return (!where.id || row.id === where.id) && (!where.status || row.status === where.status) &&
      (!where.rowVersion || row.rowVersion === where.rowVersion) &&
      (!where.createdBy || row.createdByWorkspace === where.createdBy.workspaceId) &&
      (!where.AND || where.AND.every((condition: any) => row.selection[condition.selection.path[0]] === condition.selection.equals));
  }
  const db: any = {
    emailCampaign: {
      findFirst: async ({ where }: any) => {
        if (where.id === feedback.FEEDBACK_SURVEY.originalCampaignId) return state.originalAvailable && where.createdBy.workspaceId === "helios"
          ? { id: feedback.FEEDBACK_SURVEY.originalCampaignId, subject: "Help us make Helios even better", recipientCount: 167, sentCount: 167, sentAt: new Date("2026-11-09T16:00Z"), recipients: [{ clientId: "alice" }] } : null;
        return [...rows.values()].find((row) => matches(row, where)) ? structuredClone([...rows.values()].find((row) => matches(row, where))) : null;
      },
      findMany: async ({ where }: any) => [...rows.values()].filter((row) => matches(row, where)).map((row) => structuredClone(row)),
      create: async ({ data }: any) => {
        if (rows.has(data.id)) throw Object.assign(new Error("unique"), { code: "P2002" });
        calls.create++;
        const row = { ...data, rowVersion: 1, createdByWorkspace: session.workspaceId, sentCount: 0, failedCount: 0, scheduledAt: null, scheduledTimeZone: null, sentAt: null,
          scheduleError: null, processingStartedAt: null, cancelledAt: null, createdAt: new Date("2026-11-11T12:00Z"), updatedAt: new Date() };
        rows.set(data.id, row);
        return structuredClone(row);
      },
      updateMany: async ({ where, data }: any) => {
        calls.update.push({ where, data });
        const row = rows.get(where.id);
        if (state.claimConflict || !row || !matches(row, where)) return { count: 0 };
        rows.set(row.id, { ...row, ...data, rowVersion: row.rowVersion + (data.rowVersion?.increment || 0) });
        return { count: 1 };
      },
    },
    communicationClient: { findMany: async (query: any) => {
      calls.audience.push(query);
      assert.ok(query.where.workspaceMemberships.some.workspaceId, "Every audience query must be tenant-scoped");
      assert.equal(query.where.emailSubscribed, true);
      assert.equal(query.where.emailStatus, "VALID");
      assert.equal(query.where.archivedAt, null);
      assert.match(query.where.groupMemberships.none.group.systemKey, /^BOUNCED_BACK:/);
      return clients.filter((row) => row.tenant === query.where.workspaceMemberships.some.workspaceId && row.emailSubscribed && row.emailStatus === "VALID" && !row.archivedAt);
    } },
    marketingEmailPreference: { findMany: async () => [{ normalizedEmail: "unsubscribed@example.com" }] },
    communicationSuppression: { findMany: async () => [{ normalizedEmail: "suppressed@example.com" }] },
    campaignRecipient: {
      deleteMany: async ({ where }: any) => { calls.deleted++; snapshots.delete(where.campaignId); return { count: 1 }; },
      createMany: async ({ data }: any) => { snapshots.set(data[0].campaignId, structuredClone(data)); return { count: data.length }; },
    },
  };
  let queue = Promise.resolve();
  db.$transaction = (fn: (db: any) => Promise<any>) => {
    const run = queue.then(async () => {
      const oldRows = structuredClone(rows), oldSnapshots = structuredClone(snapshots);
      try { return await fn(db); } catch (error) { rows.clear(); oldRows.forEach((v, k) => rows.set(k, v)); snapshots.clear(); oldSnapshots.forEach((v, k) => snapshots.set(k, v)); throw error; }
    });
    queue = run.then(() => {}, () => {});
    return run;
  };
  class EmailDeliveryError extends Error {}
  const email = loadModule("lib/client-communications/email.ts", {
    "server-only": {}, "@/lib/site": { getSiteUrl: () => "https://studio.example.com" }, "@/lib/newsletters/presentation": presentation,
    "./providers/resend": { EmailDeliveryError }, "./email-format": emailFormat,
  });
  const api = loadModule("lib/feedback-server.ts", {
    "server-only": {}, "next/server": { NextResponse: { json: (body: unknown, options: unknown) => ({ body, options }) } },
    "@/lib/audit": { recordAuditEvent: async (event: unknown) => calls.audit.push(event) },
    "@/lib/auth/session": { getAdminSession: async () => state.session }, "@/lib/prisma": { prisma: db },
    "@/lib/client-communications/bounce-core": bounce, "@/lib/client-communications/email": email,
    "@/lib/client-communications/personalization": personalization,
    "@/lib/client-communications/preferences": { addressIsMarketingEligible: async () => state.testEligible },
    "@/lib/client-communications/providers/resend": { sendEmail: async (input: unknown) => { calls.sent.push(input); return { messageId: "fake" }; } },
    "@/lib/client-communications/scheduling": scheduling, "@/lib/newsletters/presentation": presentation, "@/lib/feedback": feedback,
  });
  return { api, db, rows, snapshots, clients, calls, state };
}

test("dashboard is tenant-scoped, suppresses ineligible addresses, and exposes only relevant groups", async () => {
  const { api, calls } = harness();
  const dashboard = await api.loadFeedbackDashboard(session);
  assert.deepEqual(dashboard.clients.map((row: any) => row.id), ["alice", "bob"]);
  assert.equal(dashboard.originalCampaign.eligibleRecipientCount, 1);
  assert.equal(dashboard.clients[0].isOriginalRecipient, true);
  assert.deepEqual(dashboard.groups, [{ id: "group1", name: "Local clients", count: 2 }]);
  assert.equal(calls.sent.length, 0);
});

test("role, same-origin and configured-workspace guards run before write or test", async () => {
  const { api, state, calls } = harness();
  const request = new Request("https://studio.example.com/api/admin/feedback", { headers: { origin: "https://studio.example.com" } });
  state.session.role = "EDITOR";
  await assert.rejects(() => api.feedbackAdmin(request), /administrator/);
  state.session.role = "ADMIN";
  await assert.rejects(() => api.feedbackAdmin(new Request(request.url)), /Open Feedback/);
  state.session.workspaceId = "other";
  await assert.rejects(() => api.feedbackAdmin(request), /not available in this workspace/);
  await assert.rejects(() => api.loadFeedbackDashboard(state.session), /not available in this workspace/);
  assert.equal(calls.create, 0);
  assert.equal(calls.sent.length, 0);
});

test("stable create UUID is idempotent for repeated and concurrent requests", async () => {
  const { api, rows, calls } = harness();
  const [a, b] = await Promise.all([api.createFeedbackDraft(session, draftInput()), api.createFeedbackDraft(session, draftInput())]);
  assert.equal(a.id, b.id);
  assert.equal(rows.size, 1);
  assert.equal(calls.create, 1);
  assert.ok(rows.get(draftId).body.endsWith(feedback.FEEDBACK_REQUIRED_FOOTER));
  assert.equal(a.body, draftInput().body);
  await assert.rejects(() => api.createFeedbackDraft(session, { ...draftInput(), subject: "Changed" }), /already exists/);
  assert.equal(calls.create, 1);
});

test("unknown variables, foreign individuals and unsupported actions are rejected", async () => {
  const { api, calls } = harness();
  await assert.rejects(() => api.createFeedbackDraft(session, { ...draftInput(), body: "Hi {{SECRET}}" }), /Unsupported/);
  await assert.rejects(() => api.createFeedbackDraft(session, { ...draftInput(), mode: "INDIVIDUALS", clientIds: ["foreign"] }), /no longer eligible/);
  await api.createFeedbackDraft(session, draftInput());
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { action: "send-now", rowVersion: 1 }), /valid reminder action/);
  assert.equal(calls.sent.length, 0);
});

test("schedule requires acknowledgement, future time, and reviewed recipient count", async () => {
  const { api, rows, snapshots } = harness();
  await api.createFeedbackDraft(session, draftInput());
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { ...scheduleInput(), anonymousAcknowledged: false }), /Confirm/);
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { ...scheduleInput(), scheduledLocal: "2020-01-01T10:00" }), /future/);
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { ...scheduleInput(), scheduledTimeZone: "bad/timezone" }), /valid date/);
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, scheduleInput(1, 2)), /recipient count changed/);
  assert.equal(rows.get(draftId).status, "DRAFT");
  assert.equal(snapshots.size, 0);
  const reminder = await api.changeFeedbackReminder(session, draftId, scheduleInput());
  assert.equal(reminder.status, "SCHEDULED");
  assert.equal(reminder.rowVersion, 2);
  assert.equal(reminder.recipientCount, 1);
  assert.deepEqual(snapshots.get(draftId)?.map((row) => row.clientId), ["alice"]);
  assert.equal(snapshots.get(draftId)?.[0].firstNameSnapshot, "alice");
});

test("a changed audience or empty selection blocks scheduling without mutating snapshots", async () => {
  const { api, clients, rows } = harness();
  await api.createFeedbackDraft(session, { ...draftInput(), mode: "ALL" });
  clients.push(client("new-client"));
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, scheduleInput(1, 2)), /count changed/);
  assert.equal(rows.get(draftId).rowVersion, 1);
  await api.changeFeedbackReminder(session, draftId, { ...draftInput(), action: "draft", mode: "INDIVIDUALS", rowVersion: 1, clientIds: [] });
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, scheduleInput(2, 0)), /No eligible/);
});

test("duplicate schedules and stale writes can only claim a draft once", async () => {
  const { api, calls, snapshots } = harness();
  await api.createFeedbackDraft(session, draftInput());
  const results = await Promise.allSettled([api.changeFeedbackReminder(session, draftId, scheduleInput()), api.changeFeedbackReminder(session, draftId, scheduleInput())]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(calls.deleted, 1);
  assert.equal(snapshots.get(draftId)?.length, 1);
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { action: "cancel", rowVersion: 1 }), /changed in another tab/);
});

test("optimistic claim loss never deletes snapshots or schedules a second send", async () => {
  const { api, state, calls, rows } = harness();
  await api.createFeedbackDraft(session, draftInput());
  state.claimConflict = true;
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, scheduleInput()), /changed or delivery/);
  assert.equal(calls.deleted, 0);
  assert.equal(rows.get(draftId).status, "DRAFT");
});

test("pause clears snapshots, reschedule refreshes them, cancellation is terminal", async () => {
  const { api, rows, snapshots } = harness();
  await api.createFeedbackDraft(session, draftInput());
  await api.changeFeedbackReminder(session, draftId, scheduleInput());
  await api.changeFeedbackReminder(session, draftId, { ...scheduleInput(2), action: "reschedule", scheduledLocal: "2099-01-22T10:00" });
  assert.equal(rows.get(draftId).rowVersion, 3);
  await api.changeFeedbackReminder(session, draftId, { action: "pause", rowVersion: 3 });
  assert.equal(rows.get(draftId).status, "DRAFT");
  assert.equal(rows.get(draftId).scheduledAt, null);
  assert.equal(snapshots.size, 0);
  await api.changeFeedbackReminder(session, draftId, { action: "cancel", rowVersion: 4 });
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, scheduleInput(5)), /no longer available/);
});

test("foreign tenant records and processing or previously-started campaigns cannot be edited", async () => {
  const { api, rows } = harness();
  await api.createFeedbackDraft(session, draftInput());
  await assert.rejects(() => api.changeFeedbackReminder({ ...session, workspaceId: "other" }, draftId, { action: "cancel", rowVersion: 1 }), /not found/);
  for (const status of ["PROCESSING", "SENT", "FAILED"]) {
    rows.get(draftId).status = status;
    await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { action: "pause", rowVersion: 1 }), /cannot be paused/);
    await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { action: "cancel", rowVersion: 1 }), /cannot be cancelled/);
  }
  rows.get(draftId).status = "SCHEDULED";
  rows.get(draftId).processingStartedAt = new Date();
  await assert.rejects(() => api.changeFeedbackReminder(session, draftId, { ...scheduleInput(), action: "reschedule" }), /already started/);
});

test("preview uses safe real rendering and fixed footer without writing or sending", () => {
  const { api, calls } = harness();
  const preview = api.previewFeedback({ ...draftInput(), body: "<script>alert(1)</script>\n\nHi {{FIRST_NAME}}" });
  assert.doesNotMatch(preview.html, /<script>/);
  assert.match(preview.html, /&lt;script&gt;/);
  assert.match(preview.html, /Hi Preview/);
  assert.ok(preview.html.includes(feedback.FEEDBACK_SURVEY.formUrl));
  assert.ok(preview.html.includes(feedback.FEEDBACK_SURVEY.alreadyCompletedText));
  assert.match(preview.html, /Unsubscribe from marketing emails/);
  assert.equal(calls.create, 0);
  assert.equal(calls.sent.length, 0);
});

test("test sends only to signed-in self with stable provider idempotency and suppression checks", async () => {
  const { api, calls, state } = harness();
  await assert.rejects(() => api.testFeedback(session, { ...draftInput(), operationId, testEmail: "foreign@example.com" }), /signed-in email/);
  state.testEligible = false;
  await assert.rejects(() => api.testFeedback(session, { ...draftInput(), operationId }), /unsubscribed or suppressed/);
  state.testEligible = true;
  await api.testFeedback(session, { ...draftInput(), operationId });
  await api.testFeedback(session, { ...draftInput(), operationId });
  assert.equal(calls.sent.length, 2);
  assert.equal(calls.sent[0].to, session.email);
  assert.match(calls.sent[0].subject, /^\[TEST\]/);
  assert.equal(calls.sent[0].idempotencyKey, calls.sent[1].idempotencyKey);
  assert.equal(calls.sent[0].idempotencyKey, `feedback-test:${session.userId}:${operationId}`);
  assert.ok(calls.sent[0].html.includes(feedback.FEEDBACK_SURVEY.formUrl));
  assert.equal(calls.create, 0);
});

test("API failures do not expose database diagnostics", () => {
  const { api } = harness();
  const response = api.feedbackErrorResponse(new Error("prisma database secret password"));
  assert.equal(response.options.status, 500);
  assert.doesNotMatch(response.body.error, /prisma|secret|password/);
  assert.equal(response.options.headers["Cache-Control"], "no-store");
});

test("generic Email Studio routes cannot edit, delete, schedule or send tagged Feedback reminders", async () => {
  let writes = 0;
  const tagged = { id: draftId, subject: "Feedback", status: "DRAFT", rowVersion: 1, selection: { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id } };
  const unexpectedWrite = async () => { writes++; throw new Error("Unexpected generic campaign write"); };
  const imports = {
    "next/server": { NextResponse: { json: (body: unknown, options: unknown) => ({ body, options }) } },
    "@/lib/feedback": feedback,
    "@/lib/audit": { recordAuditEvent: unexpectedWrite },
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/client-communications/campaign-delivery": { processEmailCampaign: unexpectedWrite },
    "@/lib/client-communications/email": { renderCampaignEmail: () => "", sendTestCampaign: unexpectedWrite, EmailDeliveryError: class extends Error {} },
    "@/lib/client-communications/personalization": personalization,
    "@/lib/client-communications/scheduling": scheduling,
    "@/lib/client-communications/bounce-core": bounce,
    "@/lib/client-communications/email-format": emailFormat,
    "@/lib/prisma": { prisma: { emailCampaign: {
      findUnique: async () => tagged, findFirst: async () => tagged,
      create: unexpectedWrite, update: unexpectedWrite, updateMany: unexpectedWrite, deleteMany: unexpectedWrite,
    } } },
  };
  const collection = loadModule("app/api/admin/email-campaigns/route.ts", imports);
  const record = loadModule("app/api/admin/email-campaigns/[campaignId]/route.ts", imports);
  for (const action of ["draft", "test", "send", "schedule"]) {
    const response = await collection.POST(new Request("https://studio.example.com/api/admin/email-campaigns", { method: "POST", body: JSON.stringify({ ...draftInput(), action, draftId }) }));
    assert.equal(response.options.status, 409);
    assert.match(response.body.error, /Client Feedback/);
  }
  tagged.status = "SCHEDULED";
  for (const action of ["edit", "send-now", "reschedule", "cancel"]) {
    const response = await record.PATCH(new Request("https://studio.example.com/api/admin/email-campaigns/id", { method: "PATCH", body: JSON.stringify({ action, rowVersion: 1 }) }), { params: Promise.resolve({ campaignId: draftId }) });
    assert.equal(response.options.status, 409);
    assert.match(response.body.error, /Client Feedback/);
  }
  tagged.status = "DRAFT";
  const deleted = await record.DELETE(new Request("https://studio.example.com/api/admin/email-campaigns/id", { method: "DELETE" }), { params: Promise.resolve({ campaignId: draftId }) });
  assert.equal(deleted.options.status, 409);
  assert.equal(writes, 0);
});


test("the full allowed editable body can be saved then scheduled with its server-added footer", async () => {
  const { api } = harness();
  const body = "x".repeat(20_000);
  const draft = await api.createFeedbackDraft(session, { ...draftInput(), body });
  assert.equal(draft.body.length, 20_000);
  const scheduled = await api.changeFeedbackReminder(session, draftId, scheduleInput());
  assert.equal(scheduled.status, "SCHEDULED");
});
