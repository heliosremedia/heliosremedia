import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path: URL, modules: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl, require: (id: string) => {
    if (!(id in modules)) throw new Error(`Unexpected dependency ${id}`);
    return modules[id];
  } });
  return exports;
}

test("pause and resume handlers scope the series before touching jobs", async () => {
  for (const action of ["pause-series", "resume-series"]) {
    let jobWrites = 0;
    const foreign = async ({ where }: { where: { AND: Array<{ workspaceId: string }> } }) => {
      assert.equal(where.AND[0].workspaceId, "a");
      if (action === "pause-series") throw new Error("Series not found");
      return null;
    };
    const tx = { newsletterSeries: { update: foreign, findUnique: foreign }, newsletterJob: { updateMany: async () => { jobWrites++; } } };
    const loaded = load(new URL("../../app/api/admin/newsletters/route.ts", import.meta.url), {
      "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/audit": {},
      "@/lib/prisma": { prisma: { $transaction: async (callback: (db: typeof tx) => unknown) => callback(tx) } },
      "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ userId: "admin", workspaceId: "a" }) },
      "@/lib/newsletters/generation": {}, "@/lib/newsletters/recurrence": {},
    });
    const response = await loaded.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action, seriesId: "foreign" }) })) as Response;
    assert.equal(response.status, 400);
    assert.equal(jobWrites, 0);
  }
});

test("manual generation checks actor ownership before claiming or invoking AI", async () => {
  let claims = 0;
  const loaded = load(new URL("./generation.ts", import.meta.url), {
    "server-only": {},
    "@/lib/workspace-write-access": {}, "./generation-access": {},
    "./ownership": { resolveNewsletterWorkspace: async () => "b" },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { newsletterEdition: {
      findUnique: async ({ where }: { where: { series: { workspaceId: string } } }) => { assert.equal(where.series.workspaceId, "a"); return { series: { workspaceId: "b" } }; },
      updateMany: async () => { claims++; throw new Error("Unexpected claim"); },
    } } },
    "@/lib/site-settings": {}, "./ai": {}, "./content-sources": {}, "./studio": {}, "./source-images": {},
  });
  await assert.rejects(loaded.generateNewsletterEdition("foreign", { kind: "ADMIN", actor: { userId: "actor", workspaceId: "a", sessionVersion: 1 } }), /not found/);
  assert.equal(claims, 0);
});

test("block rewriting rejects foreign snapshots and stale editions before content writes", async () => {
  for (const scenario of ["foreign-source", "denied", "revoked", "stale", "valid"]) {
    let allowed = scenario !== "denied";
    let aiCalls = 0;
    let contentWrites = 0;
    let revisions = 0;
    let revocations = 0;
    const block = { id: "block", type: "TEXT", content: {}, internalLabel: "Text", sources: [{ id: "source", sourceId: "blog:post", sourceType: "BLOG_POST", sourceTitle: "Post", sourceSnapshot: { workspaceId: scenario === "foreign-source" ? "b" : "a", excerpt: "Verified copy" } }], edition: { rowVersion: 2, status: "NEEDS_REVIEW", series: { workspaceId: "a" }, blocks: [] as unknown[], currentRevisionNumber: 1, subject: "Subject" } };
    const tx = {
      newsletterEdition: { updateMany: async ({ where }: { where: { rowVersion: number } }) => { assert.equal(where.rowVersion, 2); return { count: scenario === "stale" ? 0 : 1 }; }, update: async () => {} },
      newsletterBlock: { update: async () => { contentWrites++; } },
      newsletterRevision: { create: async () => { revisions++; } },
      newsletterApproval: { updateMany: async () => { revocations++; } },
    };
    const loaded = load(new URL("./generation.ts", import.meta.url), {
      "server-only": {}, "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => { if (!allowed) throw new Error("WORKSPACE_WRITE_FORBIDDEN"); } }, "./generation-access": {},
      "./ownership": { resolveNewsletterWorkspace: async (value: string | null) => { if (!value) throw new Error("Legacy ownership unavailable"); return value; } },
      "@/lib/blog-ownership": { getBlogOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      "@/lib/prisma": { prisma: { newsletterBlock: { findFirst: async ({ where }: { where: { edition: { series: { workspaceId: string } } } }) => { assert.equal(where.edition.series.workspaceId, "a"); return block; } }, $transaction: async (callback: (db: typeof tx) => unknown) => callback(tx) } },
      "@/lib/site-settings": { getSiteSettings: async (workspaceId: string) => { assert.equal(workspaceId, "a"); return { businessName: "Company A" }; } },
      "./ai": { generateNewsletterDraft: async () => { aiCalls++; if (scenario === "revoked") allowed = false; return { blocks: [{ type: "TEXT", sourceIds: [] }], warnings: [] }; } },
      "./content-sources": {}, "./studio": { contentHash: () => "hash" },
      "./source-images": { validateCandidateId: () => null, suggestedCandidate: () => null, preserveManualImage: (_current: unknown, next: unknown) => next },
    });
    const operation = loaded.regenerateNewsletterBlock({ editionId: "edition", blockId: "block", actor: { userId: "actor", workspaceId: "a", sessionVersion: 1 }, action: "rewrite-block" });
    if (scenario === "valid") await operation;
    else await assert.rejects(operation, scenario === "foreign-source" ? /source ownership/ : ["denied", "revoked"].includes(scenario) ? /WORKSPACE_WRITE_FORBIDDEN/ : /changed during rewriting/);
    assert.equal(aiCalls, ["foreign-source", "denied"].includes(scenario) ? 0 : 1);
    assert.equal(contentWrites, scenario === "valid" ? 1 : 0);
    assert.equal(revisions, contentWrites);
    assert.equal(revocations, contentWrites);
  }
});

test("approval rejects an edition changed after review before creating approval or send work", async () => {
  let writes = 0;
  const edition = { id: "edition", status: "NEEDS_REVIEW", rowVersion: 4, subject: "Subject", blocks: [{}], revisions: [{ id: "revision" }], series: { workspaceId: "a", groups: [], recipients: [] } };
  const tx = { newsletterEdition: { updateMany: async ({ where }: { where: { rowVersion: number; status: string; series: { workspaceId: string } } }) => {
    assert.equal(where.rowVersion, 4); assert.equal(where.status, "NEEDS_REVIEW"); assert.equal(where.series.workspaceId, "a"); return { count: 0 };
  } }, newsletterApproval: { create: async () => { writes++; } }, newsletterJob: { createMany: async () => { writes++; } } };
  const loaded = load(new URL("../../app/api/admin/newsletters/editions/[editionId]/route.ts", import.meta.url), {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/newsletters/edition-transitions": {},
    "@/lib/workspace-write-access": { requireLockedWorkspaceAdministrator: async () => {} },
    "@/lib/newsletters/custom-image-ownership": {},
    "@/lib/newsletters/source-image-validation": {},
    "@/lib/newsletters/source-images": {}, "@/lib/r2-upload": {},
    "@/lib/newsletters/ownership": { resolveNewsletterWorkspace: async () => "a" },
    "@/lib/blog-ownership": { getBlogOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/lib/audit": {},
    "@/lib/prisma": { prisma: { newsletterEdition: { findUnique: async () => edition }, $transaction: async (callback: (db: typeof tx) => unknown) => callback(tx) } },
    "@/lib/newsletters/api": { requireNewsletterAdministrator: async () => ({ userId: "actor", workspaceId: "a" }), getEditionForStudio: async () => edition },
    "@/lib/newsletters/delivery": {}, "@/lib/newsletters/email-renderer": {}, "@/lib/newsletters/generation": {}, "@/lib/client-communications/email": {},
    "@/lib/newsletters/studio": { recipientSelectionFromSeries: () => ({ mode: "ALL" }) },
    "@/lib/newsletters/recipients": { resolveEligibleNewsletterRecipients: async () => ({ eligible: [{}] }) },
    "@/lib/newsletters/types": {}, "@/lib/newsletters/analytics": {},
  });
  const response = await loaded.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "approve" }) }), { params: Promise.resolve({ editionId: "edition" }) }) as Response;
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /changed before approval/);
  assert.equal(writes, 0);
});
