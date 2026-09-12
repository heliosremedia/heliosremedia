import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

test('recurrence preparation commits edition, jobs and dates atomically and preserves another company', async () => {
  const db = new PGlite();
  let rejectUpdate = true;
  let discoveredOwner = 'a';
  const nextSendAt = new Date('2026-09-25T16:00:00Z');
  const nextGenerationAt = new Date('2026-09-18T08:00:00Z');
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "Workspace", status TEXT, "nextSendAt" TIMESTAMPTZ, "nextGenerationAt" TIMESTAMPTZ);
      CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT REFERENCES "NewsletterSeries", "cycleKey" TEXT, status TEXT, "intendedSendAt" TIMESTAMPTZ, "generationDueAt" TIMESTAMPTZ, UNIQUE ("seriesId", "cycleKey"));
      CREATE TABLE "NewsletterJob" ("idempotencyKey" TEXT PRIMARY KEY, "editionId" TEXT REFERENCES "NewsletterEdition", type TEXT, "dueAt" TIMESTAMPTZ);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "NewsletterSeries" VALUES ('series-a', 'a', 'ACTIVE', NULL, NULL), ('series-b', 'b', 'ACTIVE', '2026-10-01', NULL);
      INSERT INTO "NewsletterEdition" VALUES ('edition-b', 'series-b', '2026-10', 'NEEDS_REVIEW', '2026-10-01', NULL);
      INSERT INTO "NewsletterJob" VALUES ('preserved-b', 'edition-b', 'MISSED_APPROVAL', '2026-10-01');
    `);
    type Values = Record<string, unknown>;
    const modules: Record<string, unknown> = {
      'server-only': {}, 'node:crypto': {},
      './ownership': { resolveNewsletterWorkspace: async (id: string) => id },
      '@/lib/blog-ownership': { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
      './recurrence': { nextOccurrence: () => nextSendAt, generationDateForSend: () => nextGenerationAt },
      '@/lib/prisma': { prisma: {
        newsletterSeries: { findMany: async () => [{ id: 'series-a', workspaceId: discoveredOwner }] },
        // A narrow ORM-to-SQL adapter exercises real transaction atomicity and
        // the application's raw ownership locks, not hosted Prisma concurrency.
        $transaction: async (operation: (tx: unknown) => Promise<unknown>) => db.transaction(async sql => operation({
          $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await sql.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows,
          newsletterSeries: {
            findFirst: async ({ where }: { where: { id: string; status: string; AND: [{ workspaceId: string }] } }) => {
              const row = (await sql.query<Values>(`SELECT * FROM "NewsletterSeries" WHERE id = $1 AND status = $2 AND "workspaceId" = $3`, [where.id, where.status, where.AND[0].workspaceId])).rows[0];
              return row ? { ...row, createdById: 'creator', timeZone: 'UTC', sendRecurrenceKind: 'DAY_OF_MONTH', sendDayOfMonth: 25, sendLocalTime: '16:00', generationMode: 'DAYS_BEFORE_SEND', generationDaysBeforeSend: 7, generationLocalTime: '08:00' } : null;
            },
            update: async ({ where, data }: { where: { id: string; AND: [{ workspaceId: string }] }; data: Values }) => {
              if (rejectUpdate) throw new Error('schedule update rejected');
              return sql.query(`UPDATE "NewsletterSeries" SET "nextSendAt" = $1, "nextGenerationAt" = $2 WHERE id = $3 AND "workspaceId" = $4`, [data.nextSendAt, data.nextGenerationAt, where.id, where.AND[0].workspaceId]);
            },
          },
          newsletterEdition: {
            findUnique: async ({ where }: { where: { seriesId_cycleKey: { seriesId: string; cycleKey: string } } }) => (await sql.query(`SELECT * FROM "NewsletterEdition" WHERE "seriesId" = $1 AND "cycleKey" = $2`, [where.seriesId_cycleKey.seriesId, where.seriesId_cycleKey.cycleKey])).rows[0] ?? null,
            upsert: async ({ create, update }: { create: Values; update: Values }) => {
              assert.equal(Object.keys(update).length, 0);
              await sql.query(`INSERT INTO "NewsletterEdition" VALUES ('edition-a',$1,$2,$3,$4,$5) ON CONFLICT ("seriesId", "cycleKey") DO NOTHING`, [create.seriesId, create.cycleKey, create.status, create.intendedSendAt, create.generationDueAt]);
              return { id: 'edition-a' };
            },
          },
          newsletterJob: { createMany: async ({ data, skipDuplicates }: { data: Values[]; skipDuplicates: boolean }) => {
            assert.equal(skipDuplicates, true);
            for (const job of data) await sql.query(`INSERT INTO "NewsletterJob" VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [job.idempotencyKey, job.editionId, job.type, job.dueAt]);
          } },
        })),
      } },
    };
    const exports: { ensureUpcomingNewsletterEditions?: (now: Date) => Promise<number> } = {};
    runInNewContext(ts.transpileModule(readFileSync(new URL('./scheduler.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Date, Error, Intl, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
    });
    const run = () => exports.ensureUpcomingNewsletterEditions!(new Date('2026-09-12T12:00:00Z'));
    const snapshot = async () => Promise.all(['NewsletterSeries', 'NewsletterEdition', 'NewsletterJob'].map(table => db.query(`SELECT * FROM "${table}" ORDER BY 1`).then(result => result.rows)));
    const before = await snapshot();
    await assert.rejects(run(), /schedule update rejected/);
    assert.deepEqual(await snapshot(), before);
    rejectUpdate = false;
    discoveredOwner = 'b';
    assert.equal(await run(), 0); assert.deepEqual(await snapshot(), before);
    discoveredOwner = 'a';
    await db.exec(`UPDATE "NewsletterSeries" SET status = 'PAUSED' WHERE id = 'series-a'`);
    assert.equal(await run(), 0);
    assert.deepEqual((await snapshot()).slice(1), before.slice(1));
    await db.exec(`UPDATE "NewsletterSeries" SET status = 'ACTIVE' WHERE id = 'series-a'`);
    assert.equal(await run(), 1);
    const after = await snapshot();
    assert.equal(after[1].length, 2); assert.equal(after[2].length, 3);
    assert.deepEqual(after[0][1], before[0][1]); assert.deepEqual(after[1][1], before[1][0]);
    assert.deepEqual(after[2].find(row => (row as Values).idempotencyKey === 'preserved-b'), before[2][0]);
    assert.equal(await run(), 0); assert.deepEqual(await snapshot(), after);
  } finally { await db.close(); }
});
