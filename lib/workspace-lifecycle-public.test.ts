import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { normalizeWorkspaceHostname } from './workspace-context-core.ts';
const require = createRequire(import.meta.url);
const next = require('next/server');
function fixture() {
  const state = { enabled: true, reads: 0, failure: false };
  const domains = new Map(['a', 'b'].map(id => [`${id}.example.test`, { purpose: 'PUBLIC_SITE', status: 'ACTIVE', workspace: { lifecycleState: 'ACTIVE' } }]));
  const modules: Record<string, unknown> = {
    'next/server': next,
    '@/lib/workspace-context-core': { normalizeWorkspaceHostname },
    './state': { lifecycleEnabled: () => state.enabled },
    '@/lib/prisma': { prisma: { workspaceDomain: { findUnique: async ({ where }: { where: { hostname: string } }) => {
      state.reads++; if (state.failure) throw new Error('Private database detail'); return domains.get(where.hostname) ?? null;
    } } } },
  };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('lib/workspace-lifecycle/public-response.ts', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const api = exports as { isPublicLifecyclePath: (path: string) => boolean; publicLifecycleResponse: (request: { headers: Headers }) => Promise<Response> };
  return { state, domains, api, read: (host: string) => api.publicLifecycleResponse({ headers: new Headers({ host, 'x-forwarded-host': 'b.example.test', 'x-workspace-id': 'b' }) }) };
}
test('public suspension response is fresh, generic and uncached in both directions', async () => {
  const f = fixture();
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    assert.equal((await f.read(`${id}.example.test`)).headers.get('x-middleware-next'), '1');
    f.domains.get(`${id}.example.test`)!.workspace.lifecycleState = 'SUSPENDED';
    const response = await f.read(`${id}.example.test`);
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'This site is temporarily unavailable.');
    assert.equal(response.headers.get('location'), null);
    assert.equal((await f.read(`${other}.example.test`)).headers.get('x-middleware-next'), '1');
    f.domains.get(`${id}.example.test`)!.workspace.lifecycleState = 'ACTIVE';
    assert.equal((await f.read(`${id}.example.test`)).headers.get('x-middleware-next'), '1');
  }
  assert.equal(f.state.reads, 8);
});
test('public gate fails closed on lookup error and preserves default-off and unknown-host routing', async () => {
  const f = fixture(); f.state.failure = true;
  assert.equal((await f.read('a.example.test')).status, 503);
  f.state.enabled = false;
  assert.equal((await f.read('a.example.test')).headers.get('x-middleware-next'), '1');
  assert.equal(f.state.reads, 1);
  f.state.enabled = true; f.state.failure = false;
  assert.equal((await f.read('unknown.example.test')).headers.get('x-middleware-next'), '1');
  assert.equal((await f.read('')).status, 503);
});
test('public path boundary excludes global login, signed opt-out and provider safety callbacks', () => {
  const f = fixture();
  for (const path of ['/', '/portfolio', '/portfolio/a', '/services/a', '/sitemap.xml', '/api/portfolio/films', '/api/inquiries', '/api/client-portal/verify']) assert.equal(f.api.isPublicLifecyclePath(path), true, path);
  for (const path of ['/login', '/unsubscribe', '/api/unsubscribe', '/api/webhooks/resend', '/api/admin/users', '/api/platform/support/diagnostics', '/api/cron/newsletters', '/api/referrals/token', '/refer/token', '/portfolio-other', '/_next/static/a.js']) assert.equal(f.api.isPublicLifecyclePath(path), false, path);
  const proxy = readFileSync('proxy.ts', 'utf8');
  assert.ok(proxy.includes('isPublicLifecyclePath(request.nextUrl.pathname)'));
  assert.ok(!proxy.includes('x-workspace-id'));
});
