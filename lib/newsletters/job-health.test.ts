import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("job health reauthorizes before scoped reads and projects bounded operational evidence without credentials", async () => {
  let authorized = true, checked = false, reads = 0;
  const now = new Date();
  const jobs = Array.from({ length: 51 }, (_, index) => ({
    id: `job-${index}`, editionId: 'edition-a', type: 'GENERATE', status: index === 3 ? 'FAILED' : index === 4 ? 'PENDING' : 'CLAIMED',
    dueAt: now, leaseExpiresAt: index === 0 ? new Date(now.getTime() + 60_000) : index === 1 ? new Date(0) : null,
    attempts: 1, claimToken: 'secret-token', lastErrorMessage: 'private-provider-error',
    edition: { subject: 'Stored edition', cycleKey: 'cycle', status: 'GENERATING', series: { name: 'Series A', status: 'ACTIVE' } },
  }));
  const modules: Record<string, unknown> = {
    'server-only': {}, '@/lib/blog-ownership': { getContentOwnershipScope: async (id: string) => { assert.equal(id, 'a'); return { workspaceId: 'a' }; } },
    '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async (_tx: unknown, actor: { workspaceId: string }) => {
      assert.equal(actor.workspaceId, 'a'); if (!authorized) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); checked = true;
    } },
    '@/lib/prisma': { prisma: { $transaction: async (callback: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      const scope = (where: { edition: { series: { workspaceId: string } } }) => { assert.equal(checked, true); assert.equal(where.edition.series.workspaceId, 'a'); reads++; };
      return callback({ newsletterJob: {
        count: async ({ where }: { where: { edition: { series: { workspaceId: string } }; status: string; OR?: unknown[] } }) => { scope(where); if (where.OR) assert.equal(where.OR.length, 2); return 1; },
        findMany: async (query: { where: { edition: { series: { workspaceId: string } } }; take: number; select: Record<string, unknown> }) => {
          scope(query.where); assert.equal(query.take, 51); assert.equal(query.select.claimToken, undefined); assert.equal(query.select.lastErrorMessage, undefined); return jobs;
        },
      } });
    } } },
  };
  const api = load<{ getNewsletterJobHealth: (actor: unknown) => Promise<{ jobs: Array<{ state: string }>; truncated: boolean; automaticRetryAllowed: boolean }> }>('./job-health.ts', modules);
  const result = await api.getNewsletterJobHealth({ workspaceId: 'a', userId: 'admin', sessionVersion: 1 });
  assert.equal(reads, 5); assert.equal(result.jobs.length, 50); assert.equal(result.truncated, true); assert.equal(result.automaticRetryAllowed, false);
  assert.deepEqual(Array.from(result.jobs.slice(0, 5), row => row.state), ['ACTIVE', 'REVIEW', 'REVIEW', 'FAILED', 'PENDING']);
  assert.equal(JSON.stringify(result).includes('secret-token'), false); assert.equal(JSON.stringify(result).includes('private-provider-error'), false);
  authorized = false; checked = false;
  await assert.rejects(api.getNewsletterJobHealth({ workspaceId: 'a', userId: 'admin', sessionVersion: 1 }), /FORBIDDEN/);
  assert.equal(reads, 5);
});

test("job health GET takes ownership only from the current administrator and bounds all failures", async () => {
  let actor: unknown = { workspaceId: 'a', userId: 'admin', sessionVersion: 1 }, calls = 0, error = '';
  const api = load<{ GET: (request?: Request) => Promise<Response> }>('../../app/api/admin/newsletters/jobs/health/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/newsletters/api': { requireNewsletterAdministrator: async () => actor },
    '@/lib/newsletters/job-health': { getNewsletterJobHealth: async (input: unknown) => { assert.equal(input, actor); calls++; if (error) throw new Error(error); return { jobs: [] }; } },
  });
  const result = await api.GET(new Request('https://synthetic.invalid/api?workspaceId=foreign'));
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  actor = null; assert.equal((await api.GET()).status, 403); assert.equal(calls, 1);
  actor = {}; error = 'WORKSPACE_WRITE_FORBIDDEN'; assert.equal((await api.GET()).status, 403);
  error = 'private database detail'; const failed = await api.GET(); assert.equal(failed.status, 503); assert.equal((await failed.text()).includes(error), false);
});

test("job health client makes only uncached GET requests and rejects malformed status snapshots", async () => {
  const api = load<{ requestNewsletterJobHealth: (signal: AbortSignal | undefined, transport: typeof fetch) => Promise<unknown> }>('../../app/admin/newsletter-studio/components/job-health-client.ts', {});
  const valid = { observedAt: new Date().toISOString(), counts: { pending: 0, active: 0, review: 0, failed: 0 }, truncated: false, jobs: [], automaticRetryAllowed: false };
  const signal = new AbortController().signal;
  assert.deepEqual(await api.requestNewsletterJobHealth(signal, async (url, options) => {
    assert.equal(url, '/api/admin/newsletters/jobs/health'); assert.equal(options?.method, 'GET'); assert.equal(options?.body, undefined); assert.equal(options?.cache, 'no-store'); assert.equal(options?.signal, signal);
    return Response.json({ success: true, health: valid });
  }), valid);
  for (const patch of [{ observedAt: 'bad' }, { counts: {} }, { counts: { ...valid.counts, failed: -1 } }, { jobs: [null] }, { jobs: [{}] }, { automaticRetryAllowed: true }]) {
    await assert.rejects(api.requestNewsletterJobHealth(undefined, async () => Response.json({ success: true, health: { ...valid, ...patch } })), /unavailable/);
  }
  for (const status of [403, 503]) await assert.rejects(api.requestNewsletterJobHealth(undefined, async () => new Response('private detail', { status })), status === 403 ? /Administrator/ : /unavailable/);
});
