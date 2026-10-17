// Actual claim SQL against disposable in-memory PostgreSQL; no provider calls.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import type { ClaimedNewsletterJob } from './scheduler.ts';
test('reactivation preserves future approvals, holds overdue and uncertain claims and isolates workspaces', async () => {
const db = new PGlite(), now = new Date('2026-10-08T12:00:00Z');
const source = readFileSync(new URL('./scheduler.ts', import.meta.url), 'utf8');
try {
  await db.exec(`
    CREATE TABLE "Workspace" (id TEXT PRIMARY KEY, "lifecycleState" TEXT, "lifecycleRevision" INT, "lastReactivatedAt" TIMESTAMPTZ);
    CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, status TEXT, "workspaceId" TEXT);
    CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT, status TEXT, "approvedRevisionId" TEXT, "intendedSendAt" TIMESTAMPTZ, "generationDueAt" TIMESTAMPTZ);
    CREATE TABLE "NewsletterJob" (id TEXT PRIMARY KEY, "editionId" TEXT, type TEXT, status TEXT, "dueAt" TIMESTAMPTZ, "leaseExpiresAt" TIMESTAMPTZ, "claimToken" TEXT, "claimedAt" TIMESTAMPTZ, attempts INT DEFAULT 0, "updatedAt" TIMESTAMPTZ);
    CREATE TABLE "NewsletterDeliveryAttempt" (id TEXT PRIMARY KEY, "editionId" TEXT, status TEXT);
    INSERT INTO "Workspace" VALUES ('a','SUSPENDED',1,NULL),('b','ACTIVE',0,NULL);
    INSERT INTO "NewsletterSeries" VALUES ('a','ACTIVE','a'),('b','ACTIVE','b');
  `);
  for (const [id, workspace, offset] of [['overdue', 'a', -60000], ['future', 'a', 3600000], ['uncertain', 'a', 3600000], ['boundary', 'a', 0], ['other', 'b', -60000]] as const) {
    const due = new Date(now.getTime() + offset);
    await db.query('INSERT INTO "NewsletterEdition" VALUES ($1,$2,\'SCHEDULED\',\'approved-before-pause\',$3,NULL)', [id, workspace, due]);
    await db.query('INSERT INTO "NewsletterJob" (id,"editionId",type,status,"dueAt") VALUES ($1,$1,\'SEND\',\'PENDING\',$2)', [id, due]);
  }
  await db.exec(`INSERT INTO "NewsletterDeliveryAttempt" VALUES ('uncertain','uncertain','UNCERTAIN')`);
  const raw = async (parts: TemplateStringsArray, ...values: unknown[]) => (await db.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows;
  const client = { $queryRaw: raw, $transaction: async (fn: (tx: { $queryRaw: typeof raw }) => Promise<unknown>) => fn({ $queryRaw: raw }) };
  const exports = {} as { claimDueNewsletterJobs: (input: { now: Date; limit?: number }) => Promise<ClaimedNewsletterJob[]> };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'node:crypto': { randomUUID: () => 'synthetic-claim' }, './recurrence': {}, '@/lib/blog-ownership': {}, './ownership': {},
    '@/lib/workspace-lifecycle/state': { lifecycleEnabled: () => true },
    '@/lib/prisma': { prisma: client },
  };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, process: { env: { STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true', STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED: 'true' } }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const suspended = await exports.claimDueNewsletterJobs({ now, limit: 100 });
  assert.deepEqual(Array.from(suspended, row => row.id).sort(), ['other']);
  await db.exec(`UPDATE "Workspace" SET "lifecycleState"='ACTIVE',"lifecycleRevision"=2,"lastReactivatedAt"='2026-10-08T12:00:00Z' WHERE id='a'; UPDATE "NewsletterJob" SET status='PENDING',"claimToken"=NULL,"leaseExpiresAt"=NULL,attempts=0;`);
  const reactivated = await exports.claimDueNewsletterJobs({ now, limit: 100 });
  assert.deepEqual(Array.from(reactivated, row => row.id).sort(), ['other']);
  const later = await exports.claimDueNewsletterJobs({ now: new Date(now.getTime() + 3600001), limit: 100 });
  assert.ok(later.some(row => row.id === 'future'));
  assert.ok(![...suspended, ...reactivated, ...later].some(row => row.id === 'uncertain'));
  assert.ok(!later.some(row => ['overdue', 'boundary'].includes(row.id)));
  const held = await db.query<{ attempts: number }>(`SELECT attempts FROM "NewsletterJob" WHERE id IN ('overdue','boundary','uncertain')`);
  assert.ok(held.rows.every(row => row.attempts === 0));
  // A second pause/reactivation can make the previously-future commitment overdue.
  await db.exec(`UPDATE "Workspace" SET "lastReactivatedAt"='2026-10-08T14:00:00Z' WHERE id='a'; UPDATE "NewsletterJob" SET status='PENDING' WHERE id='future'`);
  assert.ok(!(await exports.claimDueNewsletterJobs({ now: new Date('2026-10-08T15:00:00Z') })).some(row => row.id === 'future'));
  // Explicit rescheduling changes both stored edition and job, never an automatic replay.
  await db.exec(`UPDATE "NewsletterEdition" SET "intendedSendAt"='2026-10-08T14:30:00Z' WHERE id='overdue'; UPDATE "NewsletterJob" SET "dueAt"='2026-10-08T14:30:00Z' WHERE id='overdue'`);
  assert.ok((await exports.claimDueNewsletterJobs({ now: new Date('2026-10-08T15:00:00Z') })).some(row => row.id === 'overdue'));

} finally { await db.close(); }

});
