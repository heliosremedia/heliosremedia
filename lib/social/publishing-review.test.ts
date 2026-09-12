import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { resolveMembershipAccess } from '../workspace-membership-core.ts';

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Date, URL, Error, AbortController, setTimeout, clearTimeout, fetch: modules.fetch,
    require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return exports as T;
}

test('publishing review runs real authorization and relational SQL without leaking foreign content or mutating evidence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT, active BOOLEAN, role TEXT, "sessionVersion" INT);
      CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "userId" TEXT, status TEXT, role TEXT);
      CREATE TABLE "SocialCampaign" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "internalName" TEXT);
      CREATE TABLE "SocialVariant" (id TEXT PRIMARY KEY, "campaignId" TEXT, platform TEXT, "postType" TEXT, "contentVersion" INT);
      CREATE TABLE "SocialConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT, platform TEXT, "providerUsername" TEXT, "intendedAccountName" TEXT, "encryptedTokenPayload" TEXT);
      CREATE TABLE "SocialPublishingSnapshot" (id TEXT PRIMARY KEY, "variantId" TEXT, "connectionId" TEXT, "contentVersion" INT, "invalidatedAt" TIMESTAMPTZ, payload TEXT);
      CREATE TABLE "SocialPublishingJob" (id TEXT PRIMARY KEY, "variantId" TEXT, "connectionId" TEXT, "snapshotId" TEXT, status TEXT,
        "scheduledAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "claimedAt" TIMESTAMPTZ, "completedAt" TIMESTAMPTZ, "claimToken" TEXT, attempts INT DEFAULT 12, "maxAttempts" INT DEFAULT 15,
        "lastErrorCategory" TEXT, "lastErrorMessage" TEXT DEFAULT 'PRIVATE historical error', "publicUrl" TEXT,
        "providerSubmissionId" TEXT, "externalPostId" TEXT);
      CREATE TABLE "SocialPublishingAttempt" (id TEXT PRIMARY KEY, "jobId" TEXT, "attemptNumber" INT, status TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, "errorCategory" TEXT, "providerSubmissionId" TEXT, "externalPostId" TEXT, "sanitizedError" TEXT);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('actor','a',true,'ADMIN',1);
      INSERT INTO "WorkspaceMembership" VALUES ('membership','a','actor','ACTIVE','ADMIN');
      INSERT INTO "SocialCampaign" VALUES ('campaign-a','a','Allowed campaign'), ('campaign-b','b','PRIVATE foreign campaign');
      INSERT INTO "SocialVariant" VALUES ('variant-a','campaign-a','FACEBOOK','IMAGE',3), ('variant-b','campaign-b','FACEBOOK','IMAGE',3);
      INSERT INTO "SocialConnection" VALUES ('connection-a','a','FACEBOOK','Allowed account',NULL,'PRIVATE token'), ('connection-b','b','FACEBOOK','PRIVATE foreign account',NULL,'PRIVATE foreign token');
      INSERT INTO "SocialPublishingSnapshot" VALUES ('snapshot-a','variant-a','connection-a',3,NULL,'PRIVATE payload'), ('snapshot-b','variant-b','connection-b',3,NULL,'PRIVATE foreign payload');
      INSERT INTO "SocialPublishingJob" (id,"variantId","connectionId","snapshotId",status,"claimToken","providerSubmissionId") VALUES
        ('job-a','variant-a','connection-a','snapshot-a','PUBLISHING','PRIVATE claim','PRIVATE provider reference'),
        ('job-b','variant-b','connection-b','snapshot-b','PUBLISHING','PRIVATE foreign claim',NULL),
        ('bad-campaign','variant-b','connection-a','snapshot-b','PUBLISHING',NULL,NULL),
        ('bad-snapshot','variant-a','connection-a','snapshot-b','PUBLISHING',NULL,NULL),
        ('bad-connection','variant-a','connection-b','snapshot-a','PUBLISHING',NULL,NULL);
      INSERT INTO "SocialPublishingAttempt" (id,"jobId","attemptNumber",status,"providerSubmissionId","sanitizedError")
        SELECT 'attempt-'||n,'job-a',n,'FAILED','PRIVATE reference','PRIVATE provider error' FROM generate_series(1,12) AS n;
      INSERT INTO "SocialPublishingAttempt" (id,"jobId","attemptNumber",status) VALUES ('foreign-attempt','job-b',1,'PUBLISHED');
    `);
    const guard = load('../workspace-write-access.ts', { './workspace-context-core.ts': { tenantContextEnabled: () => true }, './workspace-membership-core.ts': { resolveMembershipAccess } });
    const prisma = { $transaction: (read: (tx: unknown) => Promise<unknown>) => db.transaction(async sql => read({
      $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => (await sql.query(parts.reduce((query, part, index) => query + (index ? `$${index}` : '') + part, ''), values)).rows,
      adminUser: { findFirst: async () => (await sql.query(`SELECT * FROM "AdminUser" WHERE id='actor'`)).rows[0] },
      workspaceMembership: { findUnique: async () => (await sql.query(`SELECT * FROM "WorkspaceMembership" WHERE id='membership'`)).rows[0] },
    })) };
    const api = load<typeof import('./publishing-review')>('./publishing-review.ts', { 'server-only': {}, '@/lib/prisma': { prisma }, '@/lib/workspace-write-access': guard });
    const actor = { userId: 'actor', workspaceId: 'a', sessionVersion: 1 };
    const snapshot = async () => Promise.all(['SocialPublishingJob', 'SocialPublishingAttempt', 'SocialPublishingSnapshot', 'SocialConnection'].map(table => db.query(`SELECT * FROM "${table}" ORDER BY id`).then(r => r.rows)));
    const before = await snapshot();
    const queue = await api.getPublishingQueue(actor);
    assert.deepEqual(Array.from(queue, row => row.id), ['job-a']); assert.equal(queue[0].hasClaim, true);
    assert.doesNotMatch(JSON.stringify(queue), /PRIVATE|claimToken|encryptedTokenPayload/);
    for (const id of ['job-b', 'bad-campaign', 'bad-snapshot', 'bad-connection', 'absent']) await assert.rejects(api.inspectPublishingReview(id, actor), /NOT_FOUND/);
    const review = await api.inspectPublishingReview('job-a', actor);
    assert.equal(review.assessment, 'OUTCOME_UNCONFIRMED'); assert.equal(review.hasSubmission, true);
    assert.equal(review.attemptsTruncated, true); assert.equal(review.attemptsLog.length, 10); assert.equal(review.attemptsLog[0].attemptNumber, 12);
    assert.equal(review.providerChecked, false); assert.equal(review.recoveryAllowed, false); assert.equal(review.automaticRetryAllowed, false);
    assert.doesNotMatch(JSON.stringify(review), /PRIVATE|claimToken|providerSubmissionId|encryptedTokenPayload|sanitizedError|payload/);
    assert.deepEqual(await snapshot(), before);
    await assert.rejects(api.getPublishingQueue({ ...actor, sessionVersion: 2 }), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='REVOKED'`);
    await assert.rejects(api.getPublishingQueue(actor), /FORBIDDEN/); await assert.rejects(api.inspectPublishingReview('job-a', actor), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE', role='VIEWER'`);
    await assert.rejects(api.getPublishingQueue(actor), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE', role='EDITOR'`);
    assert.equal((await api.getPublishingQueue(actor)).length, 1); await assert.rejects(api.inspectPublishingReview('job-a', actor), /FORBIDDEN/);
    await db.exec(`UPDATE "WorkspaceMembership" SET role='ADMIN'; UPDATE "SocialPublishingSnapshot" SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE id='snapshot-a'`);
    assert.equal((await api.inspectPublishingReview('job-a', actor)).approvalRevisionChanged, true);
    for (const [status, assessment] of [['VALIDATING','VALIDATION_UNRESOLVED'], ['PROVIDER_PROCESSING','PROVIDER_PROCESSING_RECORDED'], ['PUBLISHED','LOCAL_PUBLICATION_RECORDED'], ['MANUAL_FALLBACK','OUTCOME_UNCONFIRMED'], ['FAILED','RECORDED_STATE_REVIEW']]) {
      await db.query(`UPDATE "SocialPublishingJob" SET status=$1 WHERE id='job-a'`, [status]);
      assert.equal((await api.inspectPublishingReview('job-a', actor)).assessment, assessment);
    }
    for (const url of ['javascript:alert(1)', 'https://user:password@example.test/post', 'not-a-url']) {
      await db.query(`UPDATE "SocialPublishingJob" SET "publicUrl"=$1 WHERE id='job-a'`, [url]);
      assert.equal((await api.getPublishingQueue(actor))[0].publicUrl, '');
    }
    await db.exec(`UPDATE "SocialPublishingJob" SET "publicUrl"='https://example.test/post' WHERE id='job-a'`);
    assert.equal((await api.getPublishingQueue(actor))[0].publicUrl, 'https://example.test/post');
    await db.exec(`UPDATE "SocialConnection" SET "providerUsername"='', "intendedAccountName"='Intended account' WHERE id='connection-a'`);
    assert.equal((await api.getPublishingQueue(actor))[0].account, 'Intended account');
    await db.exec(`UPDATE "SocialConnection" SET platform='INSTAGRAM' WHERE id='connection-a'`);
    assert.equal((await api.getPublishingQueue(actor)).length, 0); await assert.rejects(api.inspectPublishingReview('job-a', actor), /NOT_FOUND/);
  } finally { await db.close(); }
});

test('publication evidence handler is read-only, session-scoped and returns safe uncached errors', async () => {
  let session: { userId: string; workspaceId: string; sessionVersion: number } | null = null, calls = 0, error = '';
  const api = load<{ GET: (r: Request, c: unknown) => Promise<Response> }>('../../app/api/admin/social/publishing-jobs/[jobId]/review/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/auth/session': { getAdminSession: async () => session },
    '@/lib/social/publishing-review': { inspectPublishingReview: async (id: string, actor: unknown) => {
      calls++; assert.equal(id, 'job-a'); assert.deepEqual(JSON.parse(JSON.stringify(actor)), session);
      if (error) throw new Error(error); return { jobId: id, recoveryAllowed: false };
    } },
  });
  assert.equal('POST' in api, false); assert.equal('PATCH' in api, false);
  const call = () => api.GET(new Request('https://example.test/review?workspaceId=b'), { params: Promise.resolve({ jobId: 'job-a' }) });
  assert.equal((await call()).status, 401); assert.equal(calls, 0);
  session = { userId: 'actor', workspaceId: 'a', sessionVersion: 1 };
  assert.equal((await call()).status, 200);
  for (const [code, status] of [['WORKSPACE_WRITE_FORBIDDEN',403], ['PUBLISHING_REVIEW_NOT_FOUND',404], ['PRIVATE failure',500]] as const) {
    error = code; const response = await call(); assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await response.text(), /PRIVATE/);
  }
});

test('queue page passes only the authorized service DTO and redirects denied access before rendering jobs', async () => {
  const actor = { userId: 'actor', workspaceId: 'a', sessionVersion: 1 };
  const jobs = [{ id: 'job-a', campaign: 'Allowed campaign' }];
  let denied = false, calls = 0;
  const element = (type: unknown, props: unknown) => ({ type, props });
  const api = load<{ default: () => Promise<{ props: { children: Array<{ type: unknown; props: { initialJobs: unknown } }> } }> }>('../../app/admin/social-studio/queue/page.tsx', {
    'react/jsx-runtime': { jsx: element, jsxs: element }, 'next/link': { default: 'Link' }, './PublishingQueue': { default: 'Queue' },
    '@/lib/auth/session': { getAdminSession: async () => actor },
    'next/navigation': { redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } },
    '@/lib/social/publishing-review': { getPublishingQueue: async (input: unknown) => {
      calls++; assert.equal(input, actor); if (denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); return jobs;
    } },
  });
  const page = await api.default();
  assert.equal(page.props.children.find(child => child.type === 'Queue')?.props.initialJobs, jobs);
  denied = true; await assert.rejects(api.default(), /REDIRECT:\/admin/); assert.equal(calls, 2);
});

test('queue actions suppress synchronous duplicates and invalidate stale action controls after an unknown response', async () => {
  type Node = { type: unknown; props: { children?: unknown; onClick?: () => Promise<void> } };
  for (const mode of ['network', 'bad-json', 'forbidden', 'wrong-status', 'confirmed']) {
  const states: unknown[] = [];
  const element = (type: unknown, props: Node['props']) => ({ type, props });
  let calls = 0;
  const api = load<{ default: (input: unknown) => Node }>('../../app/admin/social-studio/queue/PublishingQueue.tsx', {
    'react/jsx-runtime': { jsx: element, jsxs: element }, 'next/link': { default: 'Link' }, './PublishingReviewPanel': { default: 'Review' },
    react: { useMemo: (read: () => unknown) => read(), useRef: (value: unknown) => ({ current: value }), useEffect: () => {},
      useState: (initial: unknown) => { const index = states.length; states.push(initial); return [initial, (value: unknown) => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      }]; } },
    fetch: async (_url: string, options: { method: string; body: string }) => {
      calls++; assert.equal(options.method, 'PATCH'); assert.deepEqual(JSON.parse(options.body), { jobId: 'job-a', action: 'retry' });
      await Promise.resolve();
      if (mode === 'network') throw new Error('Synthetic acknowledgement loss');
      if (mode === 'bad-json') return new Response('not-json');
      if (mode === 'forbidden') return Response.json({ success: false }, { status: 403 });
      return Response.json({ success: true, status: mode === 'confirmed' ? 'RETRY_SCHEDULED' : 'PUBLISHED' });
    },
  });
  const tree = api.default({ initialJobs: [{ id: 'job-a', campaign: 'Campaign', campaignId: 'campaign-a', variantId: 'variant-a', platform: 'FACEBOOK', postType: 'IMAGE', status: 'FAILED', scheduledAt: '2026-09-12T23:00:00Z', attempts: 1, maxAttempts: 5, error: '', publicUrl: '', account: 'Account', hasClaim: false }] });
  function find(value: unknown): Node | undefined {
    if (Array.isArray(value)) { for (const item of value) { const result = find(item); if (result) return result; } }
    else if (value && typeof value === 'object' && 'props' in value) {
      const node = value as Node;
      if (node.type === 'button' && node.props.children === 'Retry') return node;
      return find(node.props.children);
    }
  }
  const button = find(tree); assert.ok(button?.props.onClick);
  const results = await Promise.allSettled([button.props.onClick(), button.props.onClick()]);
  assert.equal(calls, 1); assert.equal(results.every(result => result.status === 'fulfilled'), true);
  assert.equal(states[3], '');
  if (mode === 'confirmed') {
    assert.equal((states[0] as Array<{ status: string }>)[0].status, 'RETRY_SCHEDULED');
    assert.equal((states[5] as Set<string>).size, 0); assert.match(String(states[4]), /retry completed/);
  } else {
    assert.match(String(states[4]), /Reload the queue/);
    assert.equal((states[5] as Set<string>).has('job-a'), true);
    // Even the old callback cannot resubmit before React commits a rerender.
    await button.props.onClick(); assert.equal(calls, 1);
  }
  }
});
