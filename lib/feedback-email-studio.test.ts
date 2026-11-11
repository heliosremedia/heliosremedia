/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated page and Prisma test doubles; no live dependencies are loaded. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as feedback from "./feedback.ts";
import * as bounce from "./client-communications/bounce-core.ts";
import * as metrics from "./dashboard-core.ts";

const session = { userId: "owner", workspaceId: "helios", role: "OWNER", email: "owner@example.com" };
function row(id: string, selection: unknown, age: number, workspaceId = "helios") {
  return { id, selection, subject: id, previewText: "", body: "Message", status: "DRAFT", templateKey: "PERSONAL_LETTER", recipientMode: "ALL", recipientCount: 0, sentCount: 0, failedCount: 0,
    rowVersion: 1, createdById: "owner", createdBy: { workspaceId, displayName: "Owner" }, createdAt: new Date(Date.UTC(2026, 10, 11, 12, -age)), sentAt: null, scheduledAt: null, recipients: [] };
}
function nodes(value: any): any[] {
  return !value || typeof value !== "object" ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...Object.values(value.props || {}).flatMap(nodes)];
}
function harness(rows: ReturnType<typeof row>[], race?: ReturnType<typeof row>) {
  const queries: { method: string; query: any }[] = [];
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key });
  const prisma = {
    // Existing audience reads are intentionally unchanged by this focused history/routing fix.
    communicationClient: { findMany: async () => [] },
    communicationGroup: { findMany: async () => [] },
    emailCampaign: {
      findMany: async (query: any) => {
        queries.push({ method: "findMany", query });
        assert.equal(query.where.createdBy.workspaceId, session.workspaceId);
        let selected = rows.filter((item) => item.createdBy.workspaceId === query.where.createdBy.workspaceId);
        if (query.where.selection) {
          assert.deepEqual(query.where.selection, { path: ["feedbackSurveyId"], equals: feedback.FEEDBACK_SURVEY.id });
          selected = selected.filter((item) => feedback.isFeedbackSelection(item.selection));
          return selected.map(({ id }) => ({ id }));
        }
        if (race) selected.push(race);
        assert.ok(Array.isArray(query.where.id.notIn), "Feedback IDs must be excluded before take");
        selected = selected.filter((item) => !query.where.id.notIn.includes(item.id));
        selected.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return selected.slice(0, query.take);
      },
      findFirst: async (query: any) => {
        queries.push({ method: "findFirst", query });
        assert.equal(query.where.createdBy.workspaceId, session.workspaceId);
        return rows.find((item) => item.id === query.where.id && item.status === query.where.status && item.createdById === query.where.createdById && item.createdBy.workspaceId === query.where.createdBy.workspaceId) || null;
      },
    },
    resendWebhookEvent: {
      findFirst: async (query: any) => { assert.equal(query.where.workspaceId, session.workspaceId); return null; },
      findMany: async (query: any) => { assert.equal(query.where.workspaceId, session.workspaceId); return []; },
      count: async (query: any) => { assert.equal(query.where.workspaceId, session.workspaceId); return 0; },
    },
  };
  const imports: Record<string, unknown> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: "Link" },
    "next/navigation": { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } },
    "@/lib/auth/session": { requireAdminSession: async () => session },
    "@/lib/prisma": { prisma },
    "@/lib/feedback": feedback,
    "./BulkEmailStudio": { default: "BulkEmailStudio" },
    "./EmailStudioCardOrganizer": { default: "EmailStudioCardOrganizer" },
    "@/app/admin/components/AdminSummaryCards": { default: "AdminSummaryCards" },
    "@/app/admin/components/AdminPageLayout": { default: "AdminPageLayout", AdminPageHeader: "AdminPageHeader" },
    "@/lib/client-communications/bounce-core": bounce,
    "@/lib/dashboard-core": metrics,
  };
  const compiled = ts.transpileModule(fs.readFileSync("app/admin/email-studio/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const evaluatedModule = { exports: {} as any };
  new Function("require", "module", "exports", compiled)((name: string) => {
    assert.ok(name in imports, `Unexpected dependency ${name}`);
    return imports[name];
  }, evaluatedModule, evaluatedModule.exports);
  return { queries, render: (campaign?: string) => evaluatedModule.exports.default({ searchParams: Promise.resolve({ campaign }) }) };
}

test("Email Studio keeps a full 25 ordinary campaigns when many newer Feedback reminders exist", async () => {
  const tagged = Array.from({ length: 40 }, (_, i) => row(`feedback-${i}`, { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, i));
  const ordinary = Array.from({ length: 30 }, (_, i) => row(`ordinary-${i}`, i % 2 ? {} : null, i + 50));
  const foreign = row("foreign", {}, -1, "other");
  const { render, queries } = harness([...tagged, ...ordinary, foreign]);
  const tree = await render();
  const studio = nodes(tree).find((node) => node.type === "BulkEmailStudio");
  assert.equal(studio.props.campaigns.length, 25);
  assert.deepEqual(studio.props.campaigns.map((item: any) => item.id), ordinary.slice(0, 25).map((item) => item.id));
  assert.equal(studio.props.initialDraft, null);
  const history = queries.find((call) => call.query.take === 25)!;
  assert.equal(history.query.where.id.notIn.length, 40);
  assert.ok(!("NOT" in history.query.where));
  assert.ok(nodes(tree).some((node) => node.type === "Link" && node.props.href === "/admin/feedback"), "Preserves the one-line Feedback link");
});

test("direct tagged Feedback draft links redirect instead of mounting generic edit controls", async () => {
  const { render } = harness([row("feedback", { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, 0)]);
  await assert.rejects(() => render("feedback"), /REDIRECT:\/admin\/feedback/);
});

test("ordinary draft links still open and another workspace's draft is safely omitted", async () => {
  const ordinary = row("ordinary", { groupIds: [], clientIds: [] }, 0);
  const foreign = row("foreign-feedback", { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, 0, "other");
  const { render } = harness([ordinary, foreign]);
  const open = nodes(await render("ordinary")).find((node) => node.type === "BulkEmailStudio");
  assert.equal(open.props.initialDraft.id, "ordinary");
  const excluded = nodes(await render("foreign-feedback")).find((node) => node.type === "BulkEmailStudio");
  assert.equal(excluded.props.initialDraft, null);
  assert.deepEqual(excluded.props.campaigns.map((item: any) => item.id), ["ordinary"]);
});

test("a newly inserted Feedback reminder racing the ID lookup never receives generic controls", async () => {
  const ordinary = row("ordinary", {}, 5);
  const race = row("racing-feedback", { feedbackSurveyId: feedback.FEEDBACK_SURVEY.id }, 0);
  const { render } = harness([ordinary], race);
  const studio = nodes(await render()).find((node) => node.type === "BulkEmailStudio");
  assert.deepEqual(studio.props.campaigns.map((item: any) => item.id), ["ordinary"]);
});
