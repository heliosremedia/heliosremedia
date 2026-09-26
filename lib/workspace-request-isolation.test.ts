import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import type { PublicSiteSettings } from './site-settings';
import type { AdminSession } from './auth/token';

// Executes one shared instance of the real resolver/settings/session module graph.
// Only request storage and database delegates are adapted. This is not a Next
// server, PostgreSQL, CDN, browser-cache, or hosted qualification test.
function fixture() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const requests = new AsyncLocalStorage<{ headers: Headers; token?: string }>();
  const env = { NODE_ENV: 'production', STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true',
    AUTH_SECRET: 'synthetic-request-isolation-secret-only-00000000' };
  const domains = new Map(['a', 'b'].map(id => [`${id}.example.test`, { workspaceId: id, purpose: 'PUBLIC_SITE', status: 'ACTIVE' }]));
  const settings = new Map(['a', 'b'].map(id => [id, { id: `settings-${id}`, businessName: `Company ${id}`, heroHeadlineLineOne: 'Shared heading' }]));
  const users = new Map(['a', 'b'].map(id => [id, { id, workspaceId: id, active: true, role: 'OWNER', sessionVersion: 1,
    email: `${id}@example.test`, displayName: id, navigationFavorites: [] }]));
  const memberships = new Map(['a', 'b'].map(id => [id, { userId: id, workspaceId: id, role: 'EDITOR', status: 'ACTIVE' }]));
  const settingsReads: string[] = [];
  let beforeDomainRead: (host: string) => Promise<void> = async () => {};
  const prisma = {
    workspaceDomain: { findUnique: async ({ where }: { where: { hostname: string } }) => {
      await beforeDomainRead(where.hostname);
      return domains.get(where.hostname) ?? null;
    } },
    siteSettings: { findUnique: async ({ where }: { where: { workspaceId?: string; id?: string } }) => {
      assert.ok(where.workspaceId, 'tenant request must not read the legacy default');
      settingsReads.push(where.workspaceId);
      const row = settings.get(where.workspaceId);
      return row ? { ...row } : null;
    } },
    adminUser: { findUnique: async ({ where }: { where: { id: string } }) => {
      const row = users.get(where.id); return row ? { ...row } : null;
    } },
    workspaceMembership: { findUnique: async ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) => {
      const key = where.workspaceId_userId;
      const row = memberships.get(key.userId);
      return row?.workspaceId === key.workspaceId ? { ...row } : null;
    } },
  };
  const modules = new Map<string, Record<string, unknown>>();
  const allowed = new Set(['lib/site-settings.ts', 'lib/public-workspace.ts', 'lib/workspace-context-core.ts',
    'lib/workspace-settings-core.ts', 'lib/google-business-public.ts', 'lib/auth/session.ts', 'lib/auth/token.ts',
    'lib/workspace-memberships.ts', 'lib/workspace-membership-core.ts'].map(path => resolve(root, path)));
  function load(path: string): Record<string, unknown> {
    assert.ok(allowed.has(path), `Unreviewed module: ${path}`);
    const cached = modules.get(path); if (cached) return cached;
    const exports: Record<string, unknown> = {}; modules.set(path, exports);
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    runInNewContext(source, { exports, URL, Buffer, process: { env }, require: (id: string) => {
      if (id === 'server-only') return {};
      if (id === 'node:crypto') return crypto;
      if (id === '@/lib/prisma') return { prisma };
      if (id === 'next/headers') return {
        headers: async () => { const request = requests.getStore(); assert.ok(request); return request.headers; },
        cookies: async () => { const request = requests.getStore(); assert.ok(request); return {
          get: (name: string) => name === 'helios_admin_session' && request.token ? { value: request.token } : undefined,
        }; },
      };
      if (id === 'next/navigation') return { redirect: () => { throw new Error('Unexpected redirect'); } };
      if (id.startsWith('@/')) return load(resolve(root, `${id.slice(2)}.ts`));
      if (id.startsWith('.')) return load(resolve(dirname(path), `${id}.ts`));
      throw new Error(`Unexpected dependency: ${id}`);
    } }, { filename: path });
    return exports;
  }
  const publicApi = load(resolve(root, 'lib/site-settings.ts')) as unknown as { getSiteSettings: () => Promise<PublicSiteSettings> };
  const sessionApi = load(resolve(root, 'lib/auth/session.ts')) as unknown as {
    getAdminSession: () => Promise<(AdminSession & { workspaceId: string }) | null>;
    createSessionToken: (session: Omit<AdminSession, 'expiresAt'>) => string;
  };
  const token = (id: string) => sessionApi.createSessionToken({ userId: id, email: `${id}@example.test`,
    displayName: id, role: 'OWNER', sessionVersion: 1 });
  function run<T>(host: string, fn: () => Promise<T>, cookie?: string) {
    return requests.run({ headers: new Headers({ host, 'x-forwarded-host': 'b.example.test', 'x-workspace-id': 'b' }), token: cookie }, fn);
  }
  return { domains, settings, users, memberships, settingsReads, token, run, publicApi, sessionApi,
    setDomainBarrier: (callback: typeof beforeDomainRead) => { beforeDomainRead = callback; } };
}

test('shared reader graph isolates alternating tenants and fresh reads after an owned settings change', async () => {
  const f = fixture();
  for (const id of ['a', 'b', 'a', 'b']) {
    const row = await f.run(`${id}.example.test`, f.publicApi.getSiteSettings);
    assert.equal(row.id, `settings-${id}`); assert.equal(row.businessName, `Company ${id}`);
    assert.equal(row.heroHeadlineLineOne, 'Shared heading');
  }
  f.settings.get('a')!.heroHeadlineLineOne = 'Only A changed';
  assert.equal((await f.run('a.example.test', f.publicApi.getSiteSettings)).heroHeadlineLineOne, 'Only A changed');
  assert.equal((await f.run('b.example.test', f.publicApi.getSiteSettings)).heroHeadlineLineOne, 'Shared heading');
  assert.deepEqual(f.settingsReads, ['a', 'b', 'a', 'b', 'a', 'b']);
});

test('overlapping host lookups retain request identity when B completes before A', { timeout: 5_000 }, async () => {
  const f = fixture();
  let releaseA!: () => void; let enteredA!: () => void;
  const held = new Promise<void>(resolve => { releaseA = resolve; });
  const entered = new Promise<void>(resolve => { enteredA = resolve; });
  f.setDomainBarrier(async host => { if (host === 'a.example.test') { enteredA(); await held; } });
  const a = f.run('a.example.test', f.publicApi.getSiteSettings);
  try {
    await entered;
    assert.equal((await f.run('b.example.test', f.publicApi.getSiteSettings)).businessName, 'Company b');
  } finally { releaseA(); }
  assert.equal((await a).businessName, 'Company a');
  assert.deepEqual(f.settingsReads, ['b', 'a']);
});

test('unknown or inactive hosts and absent settings fail closed after a successful tenant read', async () => {
  const f = fixture();
  await f.run('a.example.test', f.publicApi.getSiteSettings);
  f.domains.get('b.example.test')!.status = 'INACTIVE';
  for (const host of ['unknown.example.test', 'b.example.test', '']) {
    await assert.rejects(f.run(host, f.publicApi.getSiteSettings), /workspace.*host|workspace host/i);
  }
  assert.deepEqual(f.settingsReads, ['a'], 'foreign forwarding headers cannot supply authority');
  f.settings.delete('a');
  await assert.rejects(f.run('a.example.test', f.publicApi.getSiteSettings), /not configured/);
});

test('signed sessions recheck membership, role and session version on every request', async () => {
  const f = fixture(); const a = f.token('a'); const b = f.token('b');
  for (const [cookie, expected] of [[a, 'a'], [b, 'b'], [a, 'a']]) {
    const session = await f.run('b.example.test', f.sessionApi.getAdminSession, cookie);
    assert.equal(session?.workspaceId, expected);
    assert.equal(session?.role, 'EDITOR', 'current membership overrides the signed OWNER role');
  }
  f.memberships.get('a')!.status = 'REVOKED';
  assert.equal(await f.run('a.example.test', f.sessionApi.getAdminSession, a), null);
  assert.equal((await f.run('a.example.test', f.sessionApi.getAdminSession, b))?.workspaceId, 'b');
  f.memberships.get('a')!.status = 'ACTIVE'; f.users.get('a')!.sessionVersion++;
  assert.equal(await f.run('a.example.test', f.sessionApi.getAdminSession, a), null);
  assert.equal(await f.run('a.example.test', f.sessionApi.getAdminSession, `${b}corrupt`), null);
  assert.equal(await f.run('a.example.test', f.sessionApi.getAdminSession), null);
});
