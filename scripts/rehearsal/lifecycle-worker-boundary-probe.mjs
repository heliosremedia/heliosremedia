// Read-only source inspection executed against a fresh in-memory PostgreSQL engine.
// This reproduces a known gap; it is not a production or lifecycle qualification.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
if (process.argv[2] !== '--synthetic-only') throw new Error('Explicit --synthetic-only is required');
const db = new PGlite(), now = new Date('2026-10-08T12:00:00Z');
const source = execFileSync('git', ['show', '96b92a3aec8e9c80d96e1be7b2fa48c6f5252f5f:lib/newsletters/scheduler.ts'], { encoding: 'utf8' });
try {
  await db.exec(`
    CREATE TABLE "Workspace" (id TEXT PRIMARY KEY, "lifecycleState" TEXT, "lifecycleRevision" INT);
    CREATE TABLE "NewsletterSeries" (id TEXT PRIMARY KEY, status TEXT, "workspaceId" TEXT);
    CREATE TABLE "NewsletterEdition" (id TEXT PRIMARY KEY, "seriesId" TEXT, status TEXT, "approvedRevisionId" TEXT, "intendedSendAt" TIMESTAMPTZ, "generationDueAt" TIMESTAMPTZ);
    CREATE TABLE "NewsletterJob" (id TEXT PRIMARY KEY, "editionId" TEXT, type TEXT, status TEXT, "dueAt" TIMESTAMPTZ, "leaseExpiresAt" TIMESTAMPTZ, "claimToken" TEXT, "claimedAt" TIMESTAMPTZ, attempts INT DEFAULT 0, "updatedAt" TIMESTAMPTZ);
    CREATE TABLE "NewsletterDeliveryAttempt" (id TEXT PRIMARY KEY, "editionId" TEXT, status TEXT);
    INSERT INTO "Workspace" VALUES ('a','SUSPENDED',1),('b','ACTIVE',0);
    INSERT INTO "NewsletterSeries" VALUES ('a','ACTIVE','a'),('b','ACTIVE','b');
  `);
  for (const [id, workspace, offset] of [['overdue', 'a', -60000], ['future', 'a', 3600000], ['uncertain', 'a', -60000], ['other', 'b', -60000]]) {
    const due = new Date(now.getTime() + offset);
    await db.query('INSERT INTO "NewsletterEdition" VALUES ($1,$2,\'SCHEDULED\',\'approved-before-pause\',$3,NULL)', [id, workspace, due]);
    await db.query('INSERT INTO "NewsletterJob" (id,"editionId",type,status,"dueAt") VALUES ($1,$1,\'SEND\',\'PENDING\',$2)', [id, due]);
  }
  await db.exec(`INSERT INTO "NewsletterDeliveryAttempt" VALUES ('uncertain','uncertain','UNCERTAIN')`);
  const exports = {}, modules = {
    'server-only': {}, 'node:crypto': { randomUUID: () => 'synthetic-claim' }, './recurrence': {}, '@/lib/blog-ownership': {}, './ownership': {},
    '@/lib/prisma': { prisma: { $queryRaw: async (parts, ...values) => {
      const sql = parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, '');
      return (await db.query(sql, values)).rows;
    } } },
  };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, process: { env: { STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true', STUDIO_V2_WORKSPACE_LIFECYCLE_ENABLED: 'true' } }, require: id => { assert.ok(id in modules, id); return modules[id]; } });
  const suspended = await exports.claimDueNewsletterJobs({ now, limit: 100 });
  assert.deepEqual(suspended.map(row => row.id).sort(), ['other', 'overdue']);
  await db.exec(`UPDATE "Workspace" SET "lifecycleState"='ACTIVE',"lifecycleRevision"=2 WHERE id='a'; UPDATE "NewsletterJob" SET status='PENDING',"claimToken"=NULL,"leaseExpiresAt"=NULL,attempts=0;`);
  const reactivated = await exports.claimDueNewsletterJobs({ now, limit: 100 });
  assert.deepEqual(reactivated.map(row => row.id).sort(), ['other', 'overdue']);
  const later = await exports.claimDueNewsletterJobs({ now: new Date(now.getTime() + 3600001), limit: 100 });
  assert.ok(later.some(row => row.id === 'future'));
  assert.ok(![...suspended, ...reactivated, ...later].some(row => row.id === 'uncertain'));
  console.log(JSON.stringify({ kind: 'known-gap-probe-not-qualification', sourceSha256: createHash('sha256').update(source).digest('hex'),
    inMemoryOnly: true, providersCalled: false, suspendedSendClaimed: true, overdueAfterReactivationClaimed: true,
    previouslyApprovedFutureScheduleStillEligible: true, uncertainAttemptRemainsUnclaimed: true,
    decisionRequired: 'Preserve still-future schedules or require new approval for every pre-suspension schedule' }, null, 2));
} finally { await db.close(); }
