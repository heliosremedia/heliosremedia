import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(file: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => modules[id] ?? {},
  });
  return exports as T;
}

test("edition transitions require fresh access, scoped version/state and unclaimed jobs", async () => {
  let allowed = true;
  let own = true;
  let busy = false;
  let status = "SCHEDULED";
  let version = 4;
  const events: string[] = [];
  const tx = {
    newsletterEdition: { updateMany: async ({ where, data }: { where: { id: string; rowVersion: number; series: { workspaceId: string }; status: { in: string[] } }; data: { rowVersion: { increment: number }; approvedRevisionId: unknown } }) => {
      events.push("edition"); assert.equal(where.id, "edition"); assert.equal(where.series.workspaceId, "a"); assert.equal(data.rowVersion.increment, 1); assert.equal(data.approvedRevisionId, null);
      return { count: own && version === where.rowVersion && where.status.in.includes(status) ? 1 : 0 };
    } },
    $queryRaw: async (sql: TemplateStringsArray, id: string) => { assert.match(sql.join("?"), /FOR UPDATE/); assert.equal(id, "edition"); events.push("job-lock"); },
    newsletterJob: {
      findFirst: async ({ where }: { where: { editionId: string; status: string } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.status, "CLAIMED"); events.push("job-read"); return busy ? { id: "job" } : null; },
      updateMany: async ({ where }: { where: { editionId: string; status: string } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.status, "PENDING"); events.push("jobs"); return { count: 1 }; },
    },
    newsletterApproval: { updateMany: async ({ where }: { where: { editionId: string; revokedAt: null } }) => { assert.equal(where.editionId, "edition"); assert.equal(where.revokedAt, null); events.push("approval"); return { count: 1 }; } },
  };
  const api = load<{ transitionNewsletterEdition: (input: unknown) => Promise<void> }>("./edition-transitions.ts", {
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: unknown) => Promise<void>) => callback(tx) } },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { events.push("authorize"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } },
  });
  for (const action of ["cancel", "revoke-approval", "reschedule"]) {
    const input = { actor: { userId: "actor", workspaceId: "a", sessionVersion: 1 }, editionId: "edition", expectedVersion: 4, action, intendedSendAt: new Date(Date.now() + 86_400_000) };
    await api.transitionNewsletterEdition(input);
    assert.deepEqual(events.splice(0), ["authorize", "edition", "job-lock", "job-read", "approval", "jobs"]);
    allowed = false; await assert.rejects(api.transitionNewsletterEdition(input), /WORKSPACE_WRITE_FORBIDDEN/);
    assert.deepEqual(events.splice(0), ["authorize"]); allowed = true;
    busy = true; await assert.rejects(api.transitionNewsletterEdition(input), /NEWSLETTER_EDITION_BUSY/);
    assert.deepEqual(events.splice(0), ["authorize", "edition", "job-lock", "job-read"]); busy = false;
    own = false; await assert.rejects(api.transitionNewsletterEdition(input), /NEWSLETTER_EDITION_CHANGED/); own = true;
    version = 5; await assert.rejects(api.transitionNewsletterEdition(input), /NEWSLETTER_EDITION_CHANGED/); version = 4;
    for (status of ["SENDING", "SENT", "PARTIALLY_SENT", "SEND_FAILED", "GENERATING", "CANCELLED"]) await assert.rejects(api.transitionNewsletterEdition(input), /NEWSLETTER_EDITION_CHANGED/);
    assert.equal(events.includes("job-lock"), false); events.length = 0; status = "SCHEDULED";
  }
});

test("edition transition route supplies trusted actor/version and reports in-flight conflicts", async () => {
  let conflict = false;
  let calls = 0;
  const api = load<{ POST: (request: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ userId: "actor", workspaceId: "a", sessionVersion: 7 }), getEditionForStudio: async () => ({ id: "edition", rowVersion: 4 }), serializeEdition: async () => ({}) },
    "@/lib/audit": { recordAuditEvent: async () => {} },
    "@/lib/newsletters/edition-transitions": { transitionNewsletterEdition: async (input: { actor: { workspaceId: string }; expectedVersion: number; action: string; intendedSendAt?: Date }) => {
      calls++; assert.equal(input.actor.workspaceId, "a"); assert.equal(input.expectedVersion, 4);
      if (input.action === "reschedule") assert.ok(input.intendedSendAt instanceof Date);
      if (conflict) throw new Error("NEWSLETTER_EDITION_BUSY");
    } },
  });
  for (const action of ["cancel", "revoke-approval", "reschedule"]) {
    const request = () => new Request("https://studio.example", { method: "POST", body: JSON.stringify({ action, workspaceId: "foreign", rowVersion: 999, intendedSendAt: "2027-01-01" }) });
    const context = { params: Promise.resolve({ editionId: "edition" }) };
    assert.equal((await api.POST(request(), context)).status, 200);
    conflict = true;
    const response = await api.POST(request(), context);
    assert.equal(response.status, 409); assert.match((await response.json()).error, /work in progress/);
    conflict = false;
  }
  assert.equal(calls, 6);
});
