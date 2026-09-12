import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

async function run(options: { accounts?: string[]; missingOwner?: boolean; lostClaim?: boolean; changedAccount?: boolean; responseLost?: boolean; writeFailure?: boolean; providerError?: boolean; backlog?: boolean } = {}) {
  const posts: Array<{ externalPostId: string; variantId: string }> = [];
  const snapshots: Array<Record<string, unknown>> = [];
  const outcomes: Array<Record<string, unknown>> = [];
  let calls = 0, reads = 0, decrypts = 0;
  let currentClaim = 'synthetic-claim';
  const connection = { id: 'connection-a', workspaceId: options.missingOwner ? undefined : 'a', platform: 'FACEBOOK', encryptedTokenPayload: 'synthetic', providerAccountId: 'account-a', grantedScopes: ['read'] };
  const rows = [
    { id: 'owned', workspace: 'a', connectionId: 'connection-a' },
    { id: 'legacy-a', workspace: 'a', connectionId: null },
    { id: 'legacy-b', workspace: 'b', connectionId: null },
    { id: 'corrupt-link', workspace: 'b', connectionId: 'connection-a' },
    { id: 'other-account', workspace: 'a', connectionId: 'connection-other' },
  ];
  const prisma = {
    socialAnalyticsJob: {
      findMany: async () => [{ id: 'job' }, ...(options.backlog ? [{ id: 'later-job' }] : [])], updateMany: async () => ({ count: 1 }),
      findFirstOrThrow: async ({ where }: { where: { id: string; claimToken: string; status: string } }) => {
        assert.equal(where.status, 'RUNNING'); assert.equal(where.claimToken, currentClaim);
        return { id: 'job', connectionId: connection.id, connection, attempts: 0, rangeStart: new Date('2026-09-01'), rangeEnd: new Date('2026-09-12') };
      },
      update: async ({ where, data }: { where: { claimToken?: string }; data: Record<string, unknown> }) => {
        if (where.claimToken && where.claimToken !== currentClaim) throw new Error('Claim changed');
        outcomes.push(data);
      },
    },
    socialConnection: {
      findMany: async ({ where, take }: { where: { workspaceId: string; platform: string }; take: number }) => {
        assert.equal(where.workspaceId, 'a'); assert.equal(where.platform, 'FACEBOOK'); assert.equal(take, 2);
        return (options.accounts ?? ['connection-a']).map(id => ({ id }));
      }, update: async () => { if (options.writeFailure) throw new Error('Private write failure'); },
    },
    socialPublication: { findMany: async ({ where }: { where: { variant: { platform: string; campaign: { workspaceId: string } }; OR: Array<{ connectionId: string | null }> } }) => {
      reads++;
      assert.equal(where.variant.platform, 'FACEBOOK');
      return rows.filter(row => row.workspace === where.variant.campaign?.workspaceId && where.OR.some(clause => clause.connectionId === row.connectionId))
        .map(row => ({ id: row.id, externalPostId: `post-${row.id}`, variantId: `variant-${row.id}` }));
    } },
    socialMetricSnapshot: { upsert: async ({ create }: { create: Record<string, unknown> }) => { snapshots.push(create); } },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
      const beforeSnapshots = snapshots.slice(), beforeOutcomes = outcomes.slice();
      let result: unknown;
      try { result = await operation(tx); }
      catch (error) { snapshots.splice(0, snapshots.length, ...beforeSnapshots); outcomes.splice(0, outcomes.length, ...beforeOutcomes); throw error; }
      if (options.responseLost) throw new Error('Private committed response loss');
      return result;
    },
  };
  const tx = { ...prisma, $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join('?'); assert.match(sql, /FOR UPDATE/);
    if (sql.includes('"SocialAnalyticsJob"')) {
      assert.match(sql, /status = 'RUNNING'/); assert.deepEqual(values, ['job', 'connection-a', 'synthetic-claim']);
      return currentClaim === 'synthetic-claim' ? [{ id: 'job' }] : [];
    }
    if (sql.includes('"SocialConnection"')) {
      assert.deepEqual(values, ['connection-a', 'a', 'FACEBOOK', 'account-a']);
      return options.changedAccount ? [] : [{ id: 'connection-a' }];
    }
    assert.deepEqual(values, ['a']); return [{ id: 'a' }];
  } };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'node:crypto': { randomUUID: () => 'synthetic-claim' }, '@/lib/prisma': { prisma },
    './security': { decryptSocialToken: (value: string) => { decrypts++; assert.equal(value, 'synthetic'); return { accessToken: 'synthetic-token' }; } },
    './analytics-core': { metricFingerprint: () => 'synthetic-fingerprint' },
    './publishing-core': { sanitizeProviderMessage: (value: string) => value },
    './analytics-providers': { analyticsAdapters: { FACEBOOK: { capability: { scopes: ['read'] }, fetch: async (input: { accessToken: string; accountId: string; posts: typeof posts }) => {
      calls++; assert.equal(input.accessToken, 'synthetic-token'); assert.equal(input.accountId, 'account-a');
      posts.push(...input.posts);
      if (options.lostClaim) currentClaim = 'other-claim';
      if (options.providerError) throw Object.assign(new Error('Synthetic provider failure'), { category: 'TRANSIENT', retryable: true });
      return [{ providerName: 'account_views', value: 7 }, ...input.posts.map(post => ({ externalPostId: post.externalPostId, providerName: 'post_views', value: 3 }))];
    } } } },
  };
  const claimExports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./analytics-claim.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: claimExports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  modules['./analytics-claim'] = claimExports;
  const exports: { processAnalyticsQueue?: () => Promise<{ requiresReview: boolean; processed: number }> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./analytics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, Map, Set, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  const queue = await exports.processAnalyticsQueue!();
  return { posts, snapshots, outcomes, calls, reads, decrypts, queue, currentClaim };
}

test('social analytics selects only stored-company publications and preserves account/owned-post metrics', async () => {
  const result = await run();
  assert.deepEqual(result.posts.map(post => post.externalPostId), ['post-owned', 'post-legacy-a']);
  assert.equal(result.calls, 1); assert.equal(result.snapshots.length, 3);
  assert.equal(result.snapshots[0].publicationId, undefined);
  assert.deepEqual(result.snapshots.slice(1).map(row => row.publicationId), ['owned', 'legacy-a']);
  assert.equal(result.outcomes[0].status, 'SUCCEEDED'); assert.equal(result.outcomes[0].importedSnapshots, 3);
});

test('an analytics worker that lost its claim cannot persist metrics or terminal evidence', async () => {
  const result = await run({ lostClaim: true });
  assert.equal(result.currentClaim, 'other-claim');
  assert.equal(result.calls, 1);
  assert.equal(result.snapshots.length, 0);
  assert.equal(result.outcomes.length, 0);
  assert.equal(result.queue.requiresReview, true);
});

test('ambiguous or mismatched platform accounts cannot attribute connectionless historical publications', async () => {
  for (const accounts of [['connection-a', 'connection-other'], ['connection-other'], []]) {
    const result = await run({ accounts });
    assert.deepEqual(result.posts.map(post => post.externalPostId), ['post-owned']);
    assert.equal(result.calls, 1); assert.equal(result.outcomes[0].status, 'SUCCEEDED');
  }
});

test('missing stored connection ownership fails before token decryption, publication selection or provider fetch', async () => {
  const result = await run({ missingOwner: true });
  assert.equal(result.calls, 0); assert.equal(result.reads, 0); assert.equal(result.decrypts, 0);
  assert.equal(result.snapshots.length, 0); assert.equal(result.outcomes.length, 0);
  assert.equal(result.queue.requiresReview, true);
});

test('changed account identity and persistence errors stop analytics admission without provider retry or fallback writes', async () => {
  for (const options of [{ changedAccount: true }, { writeFailure: true }, { responseLost: true }]) {
    const result = await run({ ...options, backlog: true });
    assert.equal(result.calls, 1); assert.equal(result.queue.processed, 1); assert.equal(result.queue.requiresReview, true);
    assert.equal(result.outcomes.length, options.responseLost ? 1 : 0);
    if (options.responseLost) assert.equal(result.outcomes[0].status, 'SUCCEEDED');
    assert.equal(JSON.stringify(result.queue).includes('Private'), false);
  }
});

test('genuine provider failures retain retry policy only while the original claim remains current', async () => {
  const retry = await run({ providerError: true });
  assert.equal(retry.calls, 1); assert.equal(retry.outcomes[0].status, 'RETRY_SCHEDULED');
  assert.equal(retry.queue.requiresReview, false); assert.equal(retry.snapshots.length, 0);
  const stale = await run({ providerError: true, lostClaim: true, backlog: true });
  assert.equal(stale.calls, 1); assert.equal(stale.outcomes.length, 0); assert.equal(stale.queue.processed, 1);
  assert.equal(stale.queue.requiresReview, true);
});
