import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const body = { internalName: "CTA", headline: "Book", primaryLabel: "Book", primaryActionType: "BOOKING", slots: ["HOME_PRIMARY"] };
function loadRoute(session: unknown, prisma: unknown) {
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const modules: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/auth/session": { getAdminSession: async () => session },
    "@/lib/blog-ownership": { getContentOwnershipScope: async () => ({ workspaceId: "a" }) },
    "@/app/generated/prisma/client": { CtaActionType: { BOOKING: "BOOKING" }, CtaPlacementSlot: { HOME_PRIMARY: "HOME_PRIMARY" } },
    "@/lib/prisma": { prisma },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/ctas/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URL, console: { error() {} }, require: (id: string) => modules[id] });
  return exports;
}

test("every CTA mutation requires editor access before database work", async () => {
  for (const session of [null, { role: "VIEWER" }]) {
    const handlers = loadRoute(session, {});
    for (const method of ["POST", "PATCH", "DELETE"]) {
      assert.equal((await handlers[method](new Request("http://localhost", { method, body: JSON.stringify(body) }))).status, 403);
    }
  }
});

test("CTA creation records ownership and placement updates require an owned existing CTA", async () => {
  let placements = 0;
  const tx = {
    callToAction: {
      create: async ({ data }: { data: { workspaceId: string } }) => { assert.equal(data.workspaceId, "a"); return { id: "cta" }; },
      findUniqueOrThrow: async () => ({ id: "cta" }),
    },
    ctaPlacement: { upsert: async ({ where }: { where: { slot: string; cta: { workspaceId: string } } }) => { assert.equal(where.cta.workspaceId, "a"); assert.equal(where.slot, "HOME_PRIMARY"); placements++; } },
  };
  const handlers = loadRoute({ role: "EDITOR", workspaceId: "a" }, { $transaction: async (callback: (db: typeof tx) => unknown) => callback(tx) });
  assert.equal((await handlers.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }))).status, 201);
  assert.equal(placements, 1);
});

test("CTA public lookup filters an occupied slot by company ownership", async () => {
  const exports: { getCtaForSlot?: (slot: string) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = {
    "server-only": {}, "@/lib/public-workspace": { getPublicWorkspaceId: async () => "a" },
    "@/lib/blog-ownership": { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    "@/lib/prisma": { prisma: { ctaPlacement: { findUnique: async ({ where }: { where: { cta: { workspaceId: string } } }) => { assert.equal(where.cta.workspaceId, "a"); return null; } } } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./ctas.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (id: string) => modules[id] });
  assert.equal(await exports.getCtaForSlot!("HOME_PRIMARY"), null);
});

test("CTA ownership migration preserves existing destinations and old writes", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY); INSERT INTO "Workspace" VALUES ('a');
      CREATE TABLE "CallToAction" (id TEXT PRIMARY KEY, "primaryValue" TEXT); INSERT INTO "CallToAction" VALUES ('legacy','/booking');`);
    await db.exec(readFileSync(new URL("../prisma/migrations/20260911200000_cta_workspace_expand/migration.sql", import.meta.url), "utf8"));
    await db.exec(`INSERT INTO "CallToAction" (id) VALUES ('old-app'); INSERT INTO "CallToAction" (id,"workspaceId") VALUES ('owned','a');`);
    assert.equal((await db.query<{ primaryValue: string }>(`SELECT "primaryValue" FROM "CallToAction" WHERE id='legacy'`)).rows[0].primaryValue, "/booking");
    await assert.rejects(db.exec(`DELETE FROM "Workspace" WHERE id='a'`));
  } finally { await db.close(); }
});
