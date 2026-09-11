import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function handler(prisma: unknown, audit: () => Promise<void>) {
  const exports: { POST?: (request: Request, context: unknown) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} }, "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/audit": { recordAuditEvent: audit },
    "@/lib/google-business-admin": { canManageGoogleBusiness: () => true },
    "@/lib/auth/session": { getAdminSession: async () => ({ userId: "admin", workspaceId: "a" }) },
    "@/lib/testimonials": { displayTestimonial: (value: string) => value },
    "@/lib/prisma": { prisma },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/api/admin/integrations/google-business/reviews/[reviewId]/curate/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: (id: string) => modules[id] });
  return exports.POST!;
}

test("concurrent curation requests read linkage only after the scoped lock and create one unpublished testimonial", async () => {
  let tail = Promise.resolve();
  let testimonialId: string | null = null;
  let creations = 0;
  let audits = 0;
  const post = handler({ $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    let locked = false;
    const tx = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
        assert.match(parts.join("?"), /FOR UPDATE/); assert.equal(values[0], "review"); assert.equal(values[1], "a");
        await previous; locked = true; return [{ id: "review" }];
      },
      googleBusinessReview: {
        findFirst: async () => { assert.equal(locked, true); return { id: "review", testimonialId, testimonial: testimonialId ? { id: testimonialId, workspaceId: "a" } : null, reviewText: "Verified review", reviewerName: "Reviewer", starRating: 5 }; },
        update: async ({ where, data }: { where: { workspaceId: string; AND: Array<{ testimonialId: null }> }; data: { testimonialId: string } }) => { assert.equal(where.workspaceId, "a"); assert.equal(where.AND[0].testimonialId, null); testimonialId = data.testimonialId; },
      },
      testimonial: { aggregate: async () => ({ _max: { displayOrder: null } }), create: async ({ data }: { data: { workspaceId: string; published: boolean } }) => { assert.equal(data.workspaceId, "a"); assert.equal(data.published, false); creations++; return { id: "curated" }; } },
    };
    try { return await callback(tx); } finally { release(); }
  } }, async () => { audits++; });
  const responses = await Promise.all([1, 2].map(() => post(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ reviewId: "review" }) })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 201]);
  assert.equal(creations, 1); assert.equal(audits, 1);
  for (const response of responses) assert.equal((await response.json()).testimonialId, "curated");
});

test("curation refuses an inconsistent foreign testimonial without returning its ID", async () => {
  let writes = 0;
  const post = handler({ $transaction: async (callback: (tx: unknown) => unknown) => callback({
    $queryRaw: async () => [{ id: "review" }],
    googleBusinessReview: { findFirst: async () => ({ testimonialId: "foreign-secret-id", testimonial: { id: "foreign-secret-id", workspaceId: "b" } }), update: async () => { writes++; } },
    testimonial: { create: async () => { writes++; } },
  }) }, async () => { writes++; });
  const response = await post(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({ reviewId: "review" }) });
  assert.equal(response.status, 409); assert.doesNotMatch(await response.text(), /foreign-secret-id/); assert.equal(writes, 0);
});

test("review/testimonial preflight rejects foreign ownership without changing rows", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const sql = readFileSync(new URL("../scripts/migrations/check-review-testimonial-ownership.sql", import.meta.url), "utf8");
  try {
    await db.exec(`CREATE TABLE "Testimonial" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL);
      CREATE TABLE "GoogleBusinessReview" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "testimonialId" TEXT REFERENCES "Testimonial"(id));
      INSERT INTO "Testimonial" VALUES ('t','a'); INSERT INTO "GoogleBusinessReview" VALUES ('r','a','t');`);
    await db.exec(sql);
    await db.exec(`UPDATE "GoogleBusinessReview" SET "workspaceId"='b' WHERE id='r'`);
    await assert.rejects(db.exec(sql), /workspace mismatch/);
    assert.equal((await db.query<{ workspaceId: string }>(`SELECT "workspaceId" FROM "Testimonial" WHERE id='t'`)).rows[0].workspaceId, "a");
  } finally { await db.close(); }
});
