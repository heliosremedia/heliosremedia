import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Job = { id: string; editionId: string; type: string; status: string; dueAt: Date; lastErrorCode: string | null };
function harness() {
  const sendAt = new Date(Date.now() + 86_400_000);
  const generationAt = new Date(Date.now() - 60_000);
  const series = { id: "series", name: "Series", status: "ACTIVE" };
  const edition = { id: "edition", status: "NEEDS_REVIEW", intendedSendAt: sendAt, generationDueAt: generationAt, approvedRevisionId: null as string | null, approvals: [] as { revisionId: string; approvedSendAt: Date }[] };
  const jobs: Job[] = [
    { id: "generate", editionId: "edition", type: "GENERATE", status: "PENDING", dueAt: generationAt, lastErrorCode: null },
    { id: "worker", editionId: "edition", type: "MISSED_APPROVAL", status: "CLAIMED", dueAt: sendAt, lastErrorCode: null },
    { id: "revoked", editionId: "edition", type: "SEND", status: "CANCELLED", dueAt: sendAt, lastErrorCode: "APPROVAL_REVOKED" },
    { id: "legacy", editionId: "edition", type: "SEND", status: "CANCELLED", dueAt: sendAt, lastErrorCode: null },
  ];
  let allowed = true;
  let writes = 0;
  let locks = 0;
  const tx = {
    newsletterSeries: { findUnique: async () => series, update: async ({ data }: { data: { status: string } }) => { writes++; series.status = data.status; return series; } },
    newsletterEdition: { findFirst: async () => edition, updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => { assert.equal(where.status, "PAUSED"); writes++; edition.status = data.status; return { count: 1 }; } },
    newsletterJob: { updateMany: async ({ where, data }: { where: { status: string; editionId?: string; edition?: { seriesId: string }; lastErrorCode?: string; OR?: { type: string; dueAt: Date }[] }; data: { status: string; lastErrorCode: string | null } }) => {
      writes++;
      if (where.edition) assert.equal(where.edition.seriesId, "series"); else assert.equal(where.editionId, "edition");
      let count = 0;
      for (const job of jobs) {
        if (job.status !== where.status || (where.lastErrorCode && job.lastErrorCode !== where.lastErrorCode)
          || (where.OR && !where.OR.some(rule => rule.type === job.type && rule.dueAt.getTime() === job.dueAt.getTime()))) continue;
        job.status = data.status; job.lastErrorCode = data.lastErrorCode; count++;
      }
      return { count };
    } },
  };
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response }, "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ userId: "actor", workspaceId: "a", sessionVersion: 1 }) },
    "@/lib/newsletters/series-write-lock": { lockNewsletterSeriesIdentity: async (db: unknown, id: string, actor: { workspaceId: string }) => { assert.equal(db, tx); assert.equal(id, "series"); assert.equal(actor.workspaceId, "a"); locks++; if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) } },
    "@/lib/audit": { recordAuditEvent: async () => {} }, "@/lib/newsletters/generation": {}, "@/lib/newsletters/recurrence": {},
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../../app/api/admin/newsletters/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Intl, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return {
    series, edition, jobs, sendAt, writes: () => writes, locks: () => locks, deny: () => { allowed = false; },
    call: (action: string) => exports.POST!(new Request("https://studio.example", { method: "POST", body: JSON.stringify({ action, seriesId: "series", workspaceId: "foreign" }) })),
  };
}

test("pause preserves worker claims and resume restores only jobs cancelled by that pause", async () => {
  const h = harness();
  assert.equal((await h.call("pause-series")).status, 200);
  assert.equal(h.jobs[0].status, "CANCELLED"); assert.equal(h.jobs[0].lastErrorCode, "SERIES_PAUSED");
  assert.equal(h.jobs[1].status, "CLAIMED"); assert.equal(h.jobs[1].lastErrorCode, null);
  assert.equal((await h.call("resume-series")).status, 200);
  assert.equal(h.jobs[0].status, "PENDING"); assert.equal(h.jobs[1].status, "CLAIMED");
  assert.equal(h.jobs[2].status, "CANCELLED"); assert.equal(h.jobs[3].status, "CANCELLED");
  const writes = h.writes();
  assert.equal((await h.call("resume-series")).status, 200); assert.equal(h.writes(), writes);
  assert.equal(h.locks(), 3);
});

test("resume requires a matching current approval and date before restoring send work", async () => {
  for (const approved of [false, true]) {
    const h = harness(); h.series.status = "PAUSED"; h.edition.status = "SCHEDULED"; h.edition.approvedRevisionId = "revision";
    h.edition.approvals = [{ revisionId: approved ? "revision" : "old-revision", approvedSendAt: h.sendAt }];
    const job = { id: "send", editionId: "edition", type: "SEND", status: "CANCELLED", dueAt: h.sendAt, lastErrorCode: "SERIES_PAUSED" };
    const stale = { ...job, id: "stale", dueAt: new Date(h.sendAt.getTime() + 60_000) };
    h.jobs.push(job, stale);
    assert.equal((await h.call("resume-series")).status, 200);
    assert.equal(job.status, approved ? "PENDING" : "CANCELLED"); assert.equal(stale.status, "CANCELLED");
    assert.equal(h.jobs[2].status, "CANCELLED"); assert.equal(h.jobs[3].status, "CANCELLED");
  }
});

test("resume activates paused draft editions, while revoked access makes no changes", async () => {
  const h = harness(); h.series.status = "PAUSED"; h.edition.status = "PAUSED";
  assert.equal((await h.call("resume-series")).status, 200); assert.equal(h.edition.status, "AWAITING_GENERATION");
  const writes = h.writes(); h.deny();
  assert.equal((await h.call("pause-series")).status, 403);
  assert.equal(h.writes(), writes);
});
