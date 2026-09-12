import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveMembershipAccess } from "../workspace-membership-core.ts";

function load<T>(file: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, URL, Error, Date, console, require: (id: string) => modules[id] ?? {},
  });
  return exports as T;
}

test("fresh administrator access rejects an editor membership despite a legacy owner role", async () => {
  let role = "EDITOR";
  let status = "ACTIVE";
  const tx = {
    $queryRaw: async () => [],
    adminUser: { findFirst: async () => ({ id: "actor", workspaceId: "a", active: true, role: "OWNER", sessionVersion: 1 }) },
    workspaceMembership: { findUnique: async () => ({ userId: "actor", workspaceId: "a", role, status }) },
  };
  const api = load<{ requireLockedWorkspaceAdministrator: (tx: unknown, actor: unknown) => Promise<unknown> }>("../workspace-write-access.ts", {
    "./workspace-context-core.ts": { tenantContextEnabled: () => true }, "./workspace-membership-core.ts": { resolveMembershipAccess },
  });
  const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
  await assert.rejects(api.requireLockedWorkspaceAdministrator(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
  role = "ADMIN"; await api.requireLockedWorkspaceAdministrator(tx, actor);
  role = "OWNER"; await api.requireLockedWorkspaceAdministrator(tx, actor);
  status = "REVOKED"; await assert.rejects(api.requireLockedWorkspaceAdministrator(tx, actor), /WORKSPACE_WRITE_FORBIDDEN/);
});

test("actual edition save and approval authorize inside the transaction before any write", async () => {
  for (const action of ["save", "approve"]) {
    let allowed = false;
    const events: string[] = [];
    const edition = { id: "edition", subject: "Subject", status: "NEEDS_REVIEW", rowVersion: 2, currentRevisionNumber: 1, intendedSendAt: new Date("2027-01-01"), blocks: action === "save" ? [] : [{}], approvals: [], revisions: [{ id: "revision" }], series: { workspaceId: "a" } };
    const write = async () => { events.push("write"); return { id: "revision", count: 1 }; };
    const tx = {
      newsletterEdition: { updateMany: async ({ where }: { where: { rowVersion: number; series: { workspaceId: string } } }) => { assert.equal(where.rowVersion, 2); assert.equal(where.series.workspaceId, "a"); return write(); }, update: write },
      newsletterBlock: { updateMany: write, deleteMany: write }, newsletterRevision: { create: write },
      newsletterApproval: { create: write }, newsletterJob: { createMany: write },
    };
    const api = load<{ PATCH: (r: Request, context: unknown) => Promise<Response>; POST: (r: Request, context: unknown) => Promise<Response> }>("../../app/api/admin/newsletters/editions/[editionId]/route.ts", {
      "next/server": { NextResponse: Response },
      "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async (db: unknown, actor: { userId: string; workspaceId: string; sessionVersion: number }) => {
        assert.equal(db, tx); assert.deepEqual(JSON.parse(JSON.stringify(actor)), { userId: "actor", workspaceId: "a", sessionVersion: 7 });
        events.push("authorize"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
      } },
      "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ userId: "actor", workspaceId: "a", sessionVersion: 7 }), getEditionForStudio: async () => edition, serializeEdition: async () => ({ id: "edition" }) },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/newsletters/ownership": { resolveNewsletterWorkspace: async () => "a" },
      "@/lib/newsletters/studio": { contentHash: () => "hash", recipientSelectionFromSeries: () => ({ mode: "ALL" }) },
      "@/lib/newsletters/recipients": { resolveEligibleNewsletterRecipients: async () => ({ eligible: [{}], excludedCount: 0 }) },
      "@/lib/newsletters/source-image-validation": { verifyNewsletterSourceImageSelections: async () => {} },
      "@/lib/audit": { recordAuditEvent: async () => { events.push("audit"); } },
      "@/lib/prisma": { prisma: { newsletterEdition: { findUnique: async () => edition }, $transaction: async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx) } },
    });
    const request = () => new Request("https://studio.example", { method: action === "save" ? "PATCH" : "POST", body: JSON.stringify({ action, edition: { subject: "Subject", blocks: [] } }) });
    const call = () => api[action === "save" ? "PATCH" : "POST"](request(), { params: Promise.resolve({ editionId: "edition" }) });
    assert.equal((await call()).status, 403);
    assert.deepEqual(events.splice(0), ["authorize"]);
    allowed = true;
    assert.equal((await call()).status, 200);
    assert.equal(events[0], "authorize"); assert.ok(events.includes("write")); assert.equal(events.at(-1), "audit");
    events.length = 0; edition.status = "SEND_FAILED";
    assert.equal((await call()).status, 400);
    assert.deepEqual(events, []);
  }
});
