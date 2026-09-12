import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test("scheduler SQL preserves held sends and stale schedules while claiming eligible work across companies", async () => {
  const db = new PGlite();
  const now = new Date("2026-09-12T12:00:00Z");
  try {
    await db.exec(`
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, status TEXT, "workspaceId" TEXT);
      CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT, status TEXT, "approvedRevisionId" TEXT, "intendedSendAt" TIMESTAMPTZ);
      CREATE TABLE "NewsletterJob" (id TEXT PRIMARY KEY, "editionId" TEXT, type TEXT, status TEXT, "dueAt" TIMESTAMPTZ, "leaseExpiresAt" TIMESTAMPTZ, "claimToken" TEXT, "claimedAt" TIMESTAMPTZ, attempts INT DEFAULT 0, "updatedAt" TIMESTAMPTZ);
      CREATE TABLE "NewsletterDeliveryAttempt" (id TEXT PRIMARY KEY, "editionId" TEXT, status TEXT);
      INSERT INTO "NewsletterSeries" VALUES ('a', 'ACTIVE', 'company-a'), ('b', 'ACTIVE', 'company-b'), ('paused', 'PAUSED', 'company-a');
    `);
    const examples = [
      ['valid-a', 'a', 'SCHEDULED', 'PENDING', 'SEND', true, 'none'],
      ['valid-b', 'b', 'SEND_FAILED', 'CLAIMED', 'SEND', true, 'REJECTED'],
      ['partial', 'a', 'PARTIALLY_SENT', 'CLAIMED', 'SEND', true, 'ACCEPTED'],
      ['held', 'a', 'SENDING', 'CLAIMED', 'SEND', true, 'ACCEPTED'],
      ['uncertain', 'a', 'SCHEDULED', 'CLAIMED', 'SEND', true, 'UNCERTAIN'],
      ['prepared', 'b', 'SEND_FAILED', 'PENDING', 'SEND', true, 'PREPARED'],
      ['revoked', 'a', 'SCHEDULED', 'PENDING', 'SEND', false, 'none'],
      ['finished', 'a', 'SENT', 'CLAIMED', 'SEND', true, 'ACCEPTED'],
      ['paused', 'paused', 'SCHEDULED', 'PENDING', 'SEND', true, 'none'],
      ['stale', 'a', 'SCHEDULED', 'PENDING', 'SEND', true, 'none'],
      ['future', 'a', 'SCHEDULED', 'CLAIMED', 'SEND', true, 'none'],
      ['active', 'a', 'SCHEDULED', 'CLAIMED', 'SEND', true, 'none'],
      ['generate', 'b', 'AWAITING_GENERATION', 'PENDING', 'GENERATE', false, 'none'],
    ] as const;
    for (const [id, series, status, jobStatus, type, approved, observation] of examples) {
      const due = new Date(now.getTime() + (id === 'future' ? 60_000 : -60_000));
      await db.query(`INSERT INTO "NewsletterEdition" VALUES ($1, $2, $3, $4, $5)`, [id, series, status, approved ? 'revision' : null, id === 'stale' ? now : due]);
      await db.query(`INSERT INTO "NewsletterJob" (id, "editionId", type, status, "dueAt", "leaseExpiresAt", "claimToken") VALUES ($1, $1, $2, $3, $4, $5, 'old-token')`, [id, type, jobStatus, due, new Date(now.getTime() + (id === 'active' ? 60_000 : -60_000))]);
      if (observation !== 'none') await db.query(`INSERT INTO "NewsletterDeliveryAttempt" VALUES ($1, $1, $2)`, [id, observation]);
    }
    const exports: { claimDueNewsletterJobs?: (input: unknown) => Promise<Array<{ id: string; claimToken: string; attempts: number }>> } = {};
    const modules: Record<string, unknown> = {
      'server-only': {}, 'node:crypto': { randomUUID: () => 'new-token' }, './recurrence': {},
      '@/lib/prisma': { prisma: { $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
        const sql = parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, '');
        return (await db.query(sql, values)).rows;
      } } },
    };
    runInNewContext(ts.transpileModule(readFileSync(new URL('./scheduler.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
    });
    const rows = await exports.claimDueNewsletterJobs!({ now, limit: 100, leaseSeconds: 300 });
    assert.deepEqual(rows.map(row => row.id).sort(), ['generate', 'partial', 'valid-a', 'valid-b']);
    for (const row of rows) { assert.equal(row.claimToken, `new-token:${row.id}`); assert.equal(row.attempts, 1); }
    const held = await db.query<{ claimToken: string; attempts: number }>(`SELECT "claimToken", attempts FROM "NewsletterJob" WHERE id = 'held'`);
    assert.equal(held.rows[0].claimToken, 'old-token'); assert.equal(held.rows[0].attempts, 0);
    assert.equal((await exports.claimDueNewsletterJobs!({ now, limit: 100 })).length, 0);
  } finally { await db.close(); }
});
