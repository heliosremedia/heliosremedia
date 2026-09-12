import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(file: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, process: { env: {} }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("background generation requires the owned edition's current unexpired GENERATE claim", async () => {
  let valid = true;
  let adminChecks = 0;
  const dueAt = new Date("2026-01-01T00:00:00Z");
  let generationDueAt: Date | null = dueAt;
  const tx = {
    $queryRaw: async () => [],
    newsletterJob: { findFirst: async ({ where }: { where: { id: string; editionId: string; claimToken: string; type: string; status: string; dueAt: { lte: Date }; leaseExpiresAt: { gt: Date }; edition: { series: { workspaceId: string } } } }) => {
      assert.equal(where.id, "job"); assert.equal(where.editionId, "edition"); assert.equal(where.claimToken, "claim"); assert.equal(where.type, "GENERATE"); assert.equal(where.status, "CLAIMED"); assert.ok(where.leaseExpiresAt.gt instanceof Date); assert.equal(where.edition.series.workspaceId, "a");
      assert.equal(where.dueAt.lte.getTime(), where.leaseExpiresAt.gt.getTime());
      return valid ? { id: "job", dueAt, edition: { generationDueAt } } : null;
    } },
  };
  const api = load<{ requireNewsletterGenerationAccess: (tx: unknown, editionId: string, workspaceId: string, context: unknown) => Promise<void> }>("./generation-access.ts", {
    "server-only": {}, "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { adminChecks++; } },
  });
  const background = { kind: "BACKGROUND", jobId: "job", claimToken: "claim" };
  await api.requireNewsletterGenerationAccess(tx, "edition", "a", background);
  for (const stale of [null, new Date(dueAt.getTime() + 60_000)]) {
    generationDueAt = stale;
    await assert.rejects(api.requireNewsletterGenerationAccess(tx, "edition", "a", background), /CLAIM_EXPIRED/);
  }
  generationDueAt = dueAt;
  valid = false; await assert.rejects(api.requireNewsletterGenerationAccess(tx, "edition", "a", background), /CLAIM_EXPIRED/);
  await assert.rejects(api.requireNewsletterGenerationAccess(tx, "edition", "a", { kind: "ADMIN", actor: { workspaceId: "b" } }), /FORBIDDEN/);
  assert.equal(adminChecks, 0);
  await api.requireNewsletterGenerationAccess(tx, "edition", "a", { kind: "ADMIN", actor: { workspaceId: "a" } });
  assert.equal(adminChecks, 1);
});

test("generation claims before AI, captures its actor and rechecks access before draft persistence", async () => {
  for (const scenario of ["denied", "revoked", "valid"]) {
    const actor = { userId: "actor", workspaceId: "a", sessionVersion: 1 };
    const events: string[] = [];
    let allowed = scenario !== "denied";
    let drafts = 0;
    let checks = 0;
    const edition = { id: "edition", rowVersion: 6, seriesId: "series", series: { workspaceId: "a", status: "ACTIVE" }, blocks: [], generationRuns: [], currentRevisionNumber: 0, contentNotes: {} };
    const tx = {
      newsletterEdition: {
        updateMany: async ({ where }: { where: { rowVersion: number; series: { workspaceId: string } } }) => { assert.equal(where.series.workspaceId, "a"); assert.equal(where.rowVersion, checks === 1 ? 5 : 6); events.push("claim"); return { count: 1 }; },
        findUnique: async () => edition,
        update: async ({ data }: { data: { status: string; approvedRevisionId: unknown } }) => { assert.equal(data.status, "NEEDS_REVIEW"); assert.equal(data.approvedRevisionId, null); drafts++; },
      },
      newsletterGenerationRun: { create: async ({ data }: { data: { instructionsSnapshot: { workspaceId: string; execution: { kind: string; actorId: string; editionVersion: number } } } }) => {
        assert.equal(data.instructionsSnapshot.workspaceId, "a");
        assert.deepEqual(JSON.parse(JSON.stringify(data.instructionsSnapshot.execution)), { kind: "ADMIN", actorId: "actor", editionVersion: 6 });
        return { id: "run" };
      }, update: async () => {} },
      newsletterApproval: { updateMany: async () => {} }, newsletterBlock: { deleteMany: async () => {}, create: async () => {} },
      newsletterRevision: { create: async ({ data }: { data: { createdById: string } }) => { assert.equal(data.createdById, "actor"); } },
    };
    const api = load<{ generateNewsletterEdition: (id: string, context: unknown) => Promise<unknown> }>("./generation.ts", {
      "./block-source-context": {},
      "server-only": {}, "@/lib/workspace-write-access": {},
      "./generation-access": { requireNewsletterGenerationAccess: async (_tx: unknown, id: string, workspaceId: string, context: { actor: { workspaceId: string } }) => {
        checks++; events.push("authorize"); assert.equal(id, "edition"); assert.equal(workspaceId, "a"); assert.equal(context.actor.workspaceId, "a"); if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN");
      } },
      "./ownership": { resolveNewsletterWorkspace: async () => "a" },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/site-settings": { getSiteSettings: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return { businessName: "Company A" }; } },
      "./ai": { generateNewsletterDraft: async () => { events.push("model"); actor.workspaceId = "b"; if (scenario === "revoked") allowed = false; return { subject: "Subject", previewText: "Preview", warnings: [], blocks: [] }; } },
      "./content-sources": { collectVerifiedNewsletterSources: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return []; } },
      "./studio": { contentHash: () => "hash" }, "./source-images": {},
      "@/lib/prisma": { prisma: {
        $transaction: async (operation: unknown) => typeof operation === "function" ? operation(tx) : Promise.all(operation as Promise<unknown>[]),
        newsletterEdition: { findUnique: async () => ({ rowVersion: 5, series: { workspaceId: "a" } }), updateMany: async ({ where }: { where: { rowVersion: number; status: string; series: { workspaceId: string } } }) => { assert.equal(where.rowVersion, 6); assert.equal(where.status, "GENERATING"); assert.equal(where.series.workspaceId, "a"); return { count: 1 }; } },
        newsletterGenerationRun: { updateMany: async ({ where }: { where: { id: string; editionId: string; status: string } }) => {
          assert.equal(where.id, "run"); assert.equal(where.editionId, "edition"); assert.equal(where.status, "RUNNING"); return { count: 1 };
        } },
        blogPost: { findMany: async () => [] }, project: { findMany: async () => [] }, service: { findMany: async () => [] },
      } },
    });
    const operation = api.generateNewsletterEdition("edition", { kind: "ADMIN", actor });
    if (scenario === "valid") await operation; else await assert.rejects(operation, /WORKSPACE_WRITE_FORBIDDEN/);
    assert.equal(drafts, scenario === "valid" ? 1 : 0);
    assert.equal(events.includes("model"), scenario !== "denied");
    assert.equal(events[0], "authorize");
    if (scenario !== "denied") assert.deepEqual(events.slice(0, 4), ["authorize", "claim", "model", "authorize"]);
  }
});

test("background runs record execution identity without claim tokens and late errors preserve settled observations", async () => {
  for (const settledStatus of ["RUNNING", "FAILED", "SUCCEEDED"]) {
    const context = { kind: "BACKGROUND", jobId: "job", claimToken: "private-claim-token" };
    const run = { status: settledStatus, errorCode: "PREVIOUS_OBSERVATION" };
    const edition = { id: "edition", rowVersion: 6, seriesId: "series", series: { workspaceId: "a", status: "ACTIVE" }, blocks: [], generationRuns: [], currentRevisionNumber: 0, contentNotes: {} };
    let recorded = false;
    const tx = {
      newsletterEdition: { updateMany: async () => ({ count: 1 }), findUnique: async () => edition },
      newsletterGenerationRun: { create: async ({ data }: { data: { instructionsSnapshot: { execution: unknown } } }) => {
        assert.deepEqual(JSON.parse(JSON.stringify(data.instructionsSnapshot.execution)), { kind: "BACKGROUND", jobId: "job", editionVersion: 6 });
        assert.equal(JSON.stringify(data).includes("private-claim-token"), false); recorded = true; return { id: "run" };
      } },
    };
    const api = load<{ generateNewsletterEdition: (id: string, context: unknown) => Promise<unknown> }>("./generation.ts", {
      "./block-source-context": {}, "server-only": {}, "@/lib/workspace-write-access": {},
      "./generation-access": { requireNewsletterGenerationAccess: async (_tx: unknown, _id: string, workspace: string, captured: typeof context) => {
        assert.equal(workspace, "a"); assert.equal(captured.jobId, "job"); assert.equal(captured.claimToken, "private-claim-token"); context.jobId = "changed";
      } },
      "./ownership": { resolveNewsletterWorkspace: async () => "a" }, "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
      "@/lib/site-settings": { getSiteSettings: async () => ({ businessName: "Company A" }) },
      "./ai": { generateNewsletterDraft: async () => { throw new Error("Synthetic model failure"); } },
      "./content-sources": { collectVerifiedNewsletterSources: async () => [] }, "./studio": {}, "./source-images": {},
      "@/lib/prisma": { prisma: {
        $transaction: async (operation: unknown) => typeof operation === "function" ? operation(tx) : Promise.all(operation as Promise<unknown>[]),
        newsletterEdition: {
          findUnique: async () => ({ rowVersion: 5, series: { workspaceId: "a" } }),
          updateMany: async ({ where }: { where: { rowVersion: number; status: string; series: { workspaceId: string } } }) => {
            assert.equal(where.rowVersion, 6); assert.equal(where.status, "GENERATING"); assert.equal(where.series.workspaceId, "a"); return { count: 0 };
          },
        },
        newsletterGenerationRun: { updateMany: async ({ where, data }: { where: { id: string; editionId: string; status: string }; data: { status: string; errorCode: string } }) => {
          assert.equal(where.id, "run"); assert.equal(where.editionId, "edition"); assert.equal(where.status, "RUNNING");
          if (run.status !== where.status) return { count: 0 }; Object.assign(run, data); return { count: 1 };
        } },
        blogPost: { findMany: async () => [] }, project: { findMany: async () => [] }, service: { findMany: async () => [] },
      } },
    });
    await assert.rejects(api.generateNewsletterEdition("edition", context), /Synthetic model failure/);
    assert.equal(recorded, true);
    assert.equal(run.status, settledStatus === "RUNNING" ? "FAILED" : settledStatus);
    assert.equal(run.errorCode, settledStatus === "RUNNING" ? "GENERATION_FAILED" : "PREVIOUS_OBSERVATION");
  }
});
