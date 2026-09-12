import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { resolveMembershipAccess } from '../workspace-membership-core.ts';

function load<T>(path: string, modules: Record<string, unknown>, env: Record<string, string> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, Error, process: { env }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}

test('reviewed analytics cancellation requires fresh administration, fences the reviewed claim and rolls back with its audit', async () => {
  const db = new PGlite();
  const env = { STUDIO_V2_ANALYTICS_RECOVERY_ENABLED: 'true' };
  let failAudit = false, loseResponse = false, jobReads = 0;
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT, active BOOLEAN, role TEXT, "sessionVersion" INT);
      CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "userId" TEXT, "workspaceId" TEXT, status TEXT, role TEXT);
      CREATE TABLE "SocialConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT, platform TEXT, "providerAccountId" TEXT);
      CREATE TABLE "SocialAnalyticsJob" (id TEXT PRIMARY KEY, "connectionId" TEXT REFERENCES "SocialConnection", status TEXT,
        "claimToken" TEXT, "claimedAt" TIMESTAMPTZ, attempts INT, "updatedAt" TIMESTAMPTZ, "completedAt" TIMESTAMPTZ);
      CREATE TABLE "AuditEvent" (id SERIAL PRIMARY KEY, data JSONB);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('actor','a',true,'ADMIN',1);
      INSERT INTO "WorkspaceMembership" VALUES ('membership-a','actor','a','ACTIVE','ADMIN');
      INSERT INTO "SocialConnection" VALUES ('connection-a','a','FACEBOOK','private-account'), ('connection-b','b','FACEBOOK','other-account');
      INSERT INTO "SocialAnalyticsJob" VALUES ('job-a','connection-a','RUNNING','private-claim','2026-09-01Z',0,'2026-09-01Z',NULL),
        ('job-b','connection-b','RUNNING','foreign-claim','2026-09-01Z',0,'2026-09-01Z',NULL);
    `);
    const guard = load('../workspace-write-access.ts', {
      './workspace-context-core.ts': { tenantContextEnabled: () => true },
      './workspace-membership-core.ts': { resolveMembershipAccess },
    });
    const prisma = { $transaction: async (write: (tx: unknown) => Promise<unknown>) => {
      const result = await db.transaction(async sql => write({
        $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
          if (parts.join('').includes('FROM "SocialAnalyticsJob"')) jobReads++;
          return (await sql.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows;
        },
        adminUser: { findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) =>
          (await sql.query(`SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2`, [where.id, where.workspaceId])).rows[0] ?? null },
        workspaceMembership: { findUnique: async ({ where }: { where: { workspaceId_userId: { userId: string; workspaceId: string } } }) =>
          (await sql.query(`SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2`, [where.workspaceId_userId.userId, where.workspaceId_userId.workspaceId])).rows[0] ?? null },
        socialAnalyticsJob: { updateMany: async ({ where, data }: { where: { id: string; connectionId: string; connection: { workspaceId: string }; status: string; claimToken: string; claimedAt: Date; updatedAt: Date; attempts: number }; data: { status: string; claimToken: null; completedAt: Date } }) => {
          assert.equal(where.status, 'RUNNING'); assert.equal(data.status, 'CANCELLED'); assert.equal(data.claimToken, null);
          const result = await sql.query(`UPDATE "SocialAnalyticsJob" j SET status=$1,"claimToken"=NULL,"completedAt"=$2,"updatedAt"=$2
            WHERE j.id=$3 AND j."connectionId"=$4 AND j.status=$5 AND j."claimToken"=$6 AND j."claimedAt"=$7 AND j."updatedAt"=$8 AND j.attempts=$9
            AND EXISTS (SELECT 1 FROM "SocialConnection" c WHERE c.id=j."connectionId" AND c."workspaceId"=$10)`,
          [data.status, data.completedAt.toISOString(), where.id, where.connectionId, where.status, where.claimToken,
            where.claimedAt.toISOString(), where.updatedAt.toISOString(), where.attempts, where.connection.workspaceId]);
          return { count: result.affectedRows };
        } },
        auditEvent: { create: async ({ data }: { data: unknown }) => {
          if (failAudit) throw new Error('Private audit failure');
          return sql.query(`INSERT INTO "AuditEvent" (data) VALUES ($1::jsonb)`, [JSON.stringify(data)]);
        } },
      }));
      if (loseResponse) throw new Error('Private committed acknowledgement loss');
      return result;
    } };
    const api = load<typeof import('./analytics-recovery')>('./analytics-recovery.ts', {
      'server-only': {}, 'node:crypto': { createHash }, '@/lib/prisma': { prisma }, '@/lib/workspace-write-access': guard,
    }, env);
    const actor = { userId: 'actor', workspaceId: 'a', sessionVersion: 1 };
    const inspect = () => api.inspectAnalyticsRecovery('job-a', actor);
    const original = await inspect();
    assert.equal(original.eligible, true); assert.equal(original.automaticRetryAllowed, false);
    assert.doesNotMatch(JSON.stringify(original), /private-claim|private-account|claimToken|providerAccountId/);
    await assert.rejects(api.inspectAnalyticsRecovery('job-b', actor), /NOT_FOUND/);
    const readsBefore = jobReads;
    await assert.rejects(api.inspectAnalyticsRecovery('job-a', { ...actor, sessionVersion: 2 }), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='REVOKED'`);
    await assert.rejects(inspect(), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE', role='EDITOR'`);
    await assert.rejects(inspect(), /FORBIDDEN/); assert.equal(jobReads, readsBefore);
    await db.exec(`UPDATE "WorkspaceMembership" SET role='ADMIN'`);
    env.STUDIO_V2_ANALYTICS_RECOVERY_ENABLED = 'false';
    await assert.rejects(api.cancelReviewedAnalytics('job-a', original.reviewVersion, actor), /DISABLED/);
    env.STUDIO_V2_ANALYTICS_RECOVERY_ENABLED = 'true';
    await db.exec(`UPDATE "SocialAnalyticsJob" SET "claimToken"='replacement-claim' WHERE id='job-a'`);
    await assert.rejects(api.cancelReviewedAnalytics('job-a', original.reviewVersion, actor), /CHANGED/);
    const replacement = await inspect(); assert.notEqual(replacement.reviewVersion, original.reviewVersion);
    for (const state of ['SUCCEEDED', 'FAILED', 'CANCELLED', 'PENDING']) {
      await db.query(`UPDATE "SocialAnalyticsJob" SET status=$1 WHERE id='job-a'`, [state]);
      const review = await inspect(); assert.equal(review.eligible, false);
      await assert.rejects(api.cancelReviewedAnalytics('job-a', review.reviewVersion, actor), /CHANGED/);
    }
    await db.query(`UPDATE "SocialAnalyticsJob" SET status='RUNNING', "claimedAt"=$1 WHERE id='job-a'`, [new Date().toISOString()]);
    assert.equal((await inspect()).eligible, false);
    await db.exec(`UPDATE "SocialAnalyticsJob" SET "claimedAt"=NULL WHERE id='job-a'`);
    assert.equal((await inspect()).eligible, false);
    await db.exec(`UPDATE "SocialAnalyticsJob" SET "claimedAt"='2026-09-01Z' WHERE id='job-a'`);
    const finalReview = await inspect();
    failAudit = true;
    await assert.rejects(api.cancelReviewedAnalytics('job-a', finalReview.reviewVersion, actor), /audit failure/);
    assert.equal((await inspect()).reviewVersion, finalReview.reviewVersion);
    assert.equal((await db.query(`SELECT * FROM "AuditEvent"`)).rows.length, 0);
    failAudit = false; loseResponse = true;
    await assert.rejects(api.cancelReviewedAnalytics('job-a', finalReview.reviewVersion, actor), /acknowledgement loss/);
    loseResponse = false;
    const settled = await inspect(); assert.equal(settled.status, 'CANCELLED'); assert.equal(settled.eligible, false);
    await assert.rejects(api.cancelReviewedAnalytics('job-a', finalReview.reviewVersion, actor), /CHANGED/);
    const audits = (await db.query<{ data: { workspaceId: string } }>(`SELECT data FROM "AuditEvent"`)).rows;
    assert.equal(audits.length, 1); assert.doesNotMatch(JSON.stringify(audits), /replacement-claim|private-account/);
    assert.equal(audits[0].data.workspaceId, 'a');
    assert.equal((await db.query<{ status: string }>(`SELECT status FROM "SocialAnalyticsJob" WHERE id='job-b'`)).rows[0].status, 'RUNNING');
    const worker = load<typeof import('./analytics-claim')>('./analytics-claim.ts', { 'server-only': {}, '@/lib/prisma': { prisma } });
    assert.equal(await worker.commitAnalyticsClaim({ jobId: 'job-a', claimToken: 'replacement-claim', connectionId: 'connection-a',
      workspaceId: 'a', platform: 'FACEBOOK', providerAccountId: 'private-account' }, async () => assert.fail('Cancelled worker entered persistence')), 'CLAIM_CHANGED');
  } finally { await db.close(); }
});

test('analytics recovery HTTP handlers require explicit confirmation and take authority only from session', async () => {
  let session: { userId: string; workspaceId: string; sessionVersion: number } | null = { userId: 'actor', workspaceId: 'a', sessionVersion: 1 };
  let calls = 0, error = '';
  const reviewVersion = 'a'.repeat(64);
  const service = async (jobId: string, actor: unknown) => { calls++; assert.equal(jobId, 'job'); assert.deepEqual(JSON.parse(JSON.stringify(actor)), session); if (error) throw new Error(error); return { reviewVersion }; };
  const api = load<{ GET: (r: Request, c: unknown) => Promise<Response>; POST: (r: Request, c: unknown) => Promise<Response> }>(
    '../../app/api/admin/social/analytics/jobs/[jobId]/recovery/route.ts', {
      'next/server': { NextResponse: Response }, '@/lib/auth/session': { getAdminSession: async () => session },
      '@/lib/social/analytics-recovery': { inspectAnalyticsRecovery: service,
        cancelReviewedAnalytics: async (id: string, version: string, actor: unknown) => { assert.equal(version, reviewVersion); return service(id, actor); } },
    });
  const context = { params: Promise.resolve({ jobId: 'job' }) };
  const post = (body: unknown) => api.POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify(body) }), context);
  const get = () => api.GET(new Request('https://example.test/api?workspaceId=b'), context);
  assert.equal((await get()).headers.get('cache-control'), 'no-store');
  for (const body of [{}, { action: 'retry', confirmed: true, reviewVersion }, { action: 'cancel', confirmed: false, reviewVersion }]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal(calls, 1);
  assert.equal((await post({ action: 'cancel', confirmed: true, reviewVersion, workspaceId: 'b', userId: 'foreign' })).status, 200);
  for (const [code, status] of [['WORKSPACE_WRITE_FORBIDDEN', 403], ['ANALYTICS_RECOVERY_NOT_FOUND', 404], ['ANALYTICS_RECOVERY_CHANGED', 409], ['ANALYTICS_RECOVERY_DISABLED', 409], ['Private database failure', 500]] as const) {
    error = code; const response = await get(); assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await response.text(), /Private/);
  }
  session = null; const before = calls;
  assert.equal((await get()).status, 401); assert.equal((await post({})).status, 401); assert.equal(calls, before);
});

test('manual analytics refresh reauthorizes membership inside the same transaction that queues the job', async () => {
  let allowed = false, queued = 0, found = true;
  const tx = { socialConnection: { findFirst: async ({ where }: { where: { workspaceId: string } }) => {
    assert.equal(where.workspaceId, 'a'); return found ? { id: 'connection-a', state: 'CONNECTED' } : null;
  } } };
  const api = load<{ POST: (r: Request) => Promise<Response> }>('../../app/api/admin/social/analytics/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'actor', workspaceId: 'a', sessionVersion: 1, role: 'ADMIN' }) },
    '@/lib/workspaces': { requireWorkspaceId: async () => 'a' },
    '@/lib/prisma': { prisma: { ...tx, $transaction: (write: (client: typeof tx) => unknown) => write(tx) } },
    '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async (client: unknown, actor: { workspaceId: string }) => {
      assert.equal(client, tx); assert.equal(actor.workspaceId, 'a'); if (!allowed) throw new Error('WORKSPACE_WRITE_FORBIDDEN');
    } },
    '@/lib/social/analytics': { queueAnalyticsRefresh: async (_id: string, _start: Date, _end: Date, client?: unknown) => {
      if (allowed) assert.equal(client, tx); queued++;
    } },
  });
  const call = () => api.POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ action: 'refresh', connectionId: 'connection-a', workspaceId: 'b' }) }));
  assert.equal((await call()).status, 403); assert.equal(queued, 0);
  allowed = true; found = false; assert.equal((await call()).status, 404); assert.equal(queued, 0);
  found = true; assert.equal((await call()).status, 200); assert.equal(queued, 1);
});

test('analytics queue creation uses the supplied transaction without changing its bounded idempotent input', async () => {
  let globalWrites = 0;
  const writes: Array<{ create: { connectionId: string; rangeStart: Date; rangeEnd: Date; idempotencyKey: string }; update: object }> = [];
  const api = load<typeof import('./analytics')>('./analytics.ts', {
    'server-only': {}, 'node:crypto': {}, '@/lib/prisma': { prisma: { socialAnalyticsJob: { upsert: async () => { globalWrites++; } } } },
    './security': {}, './analytics-core': {}, './analytics-providers': {}, './publishing-core': {}, './analytics-claim': {}, './analytics-health': {},
  });
  const client = { socialAnalyticsJob: { upsert: async (value: typeof writes[number]) => { writes.push(value); } } };
  const end = new Date('2026-09-12T12:00:00Z');
  await api.queueAnalyticsRefresh('connection-a', new Date('2026-01-01'), end, client as unknown as Parameters<typeof api.queueAnalyticsRefresh>[3]);
  assert.equal(globalWrites, 0); assert.equal(writes.length, 1);
  assert.equal(writes[0].create.connectionId, 'connection-a');
  assert.equal(writes[0].create.rangeStart.getTime(), end.getTime() - 90 * 86_400_000);
  assert.equal(writes[0].create.rangeEnd, end); assert.equal(Object.keys(writes[0].update).length, 0);
});
