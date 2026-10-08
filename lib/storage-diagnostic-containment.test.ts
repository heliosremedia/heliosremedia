import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { resolveMembershipAccess } from './workspace-membership-core.ts';
function load<T>(path: string, modules: Record<string, unknown>, onRequire: (id: string) => void = () => {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Error, URL, TypeError, require(id: string) { onRequire(id); assert.ok(id in modules, id); return modules[id]; },
  }); return exports as T;
}
function fixture() {
  const state = { signedIn: true, initialRole: 'OWNER', currentRole: 'OWNER', active: true, version: 1, tenant: false, companies: [{ id: 'a' }], failDb: false, providerError: null as Error | null, providerLoads: 0, calls: 0, locks: 0 };
  class S3ServiceException extends Error {}
  class ListObjectsV2Command { input: { Bucket: string; MaxKeys: number }; constructor(input: { Bucket: string; MaxKeys: number }) { this.input = input; } }
  const tx = {
    $queryRaw: async () => { state.locks++; }, $executeRaw: async () => { state.locks++; },
    adminUser: { findFirst: async () => ({ id: 'ua', workspaceId: 'a', role: state.currentRole, active: state.active, sessionVersion: state.version }) },
    workspace: { findMany: async () => state.companies },
  };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, '@aws-sdk/client-s3': { S3ServiceException, ListObjectsV2Command },
    '@/lib/auth/session': { getAdminSession: async () => state.signedIn ? { userId: 'ua', workspaceId: 'a', role: state.initialRole, sessionVersion: 1 } : null },
    '@/lib/prisma': { prisma: { $transaction: async (fn: (value: unknown) => Promise<unknown>) => { if (state.failDb) throw new Error('PRIVATE_DATABASE_ERROR'); return fn(tx); } } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant }, './workspace-lifecycle/state.ts': { workspaceIsActive: async () => true },
    './workspace-context-core.ts': { tenantContextEnabled: () => state.tenant }, './workspace-membership-core.ts': { resolveMembershipAccess },
    '@/lib/r2': { r2Config: { publicUrl: 'https://assets.example.test', bucketName: 'synthetic' }, r2Client: { send: async (command: ListObjectsV2Command) => { assert.equal(command.input.Bucket, 'synthetic'); assert.equal(command.input.MaxKeys, 1); state.calls++; if (state.providerError) throw state.providerError; return { Contents: [{ Key: 'PRIVATE_OBJECT_KEY' }] }; } } },
  };
  modules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts', modules);
  const route = load<{ GET: () => Promise<Response> }>('../app/api/admin/r2/verify/route.ts', modules, id => { if (id === '@/lib/r2') state.providerLoads++; });
  return { state, call: route.GET, S3ServiceException };
}
for (const defect of ['anonymous', 'viewer', 'editor', 'tenant-owner', 'multiple', 'foreign', 'missing', 'inactive', 'demoted', 'stale-session'] as const) {
  test(`shared storage diagnostic denies ${defect} before loading credentials or provider`, async () => {
    const { state, call } = fixture();
    if (defect === 'anonymous') state.signedIn = false;
    if (defect === 'viewer') state.initialRole = 'VIEWER';
    if (defect === 'editor') state.initialRole = 'EDITOR';
    if (defect === 'tenant-owner') state.tenant = true;
    if (defect === 'multiple') state.companies = [{ id: 'a' }, { id: 'b' }];
    if (defect === 'foreign') state.companies = [{ id: 'b' }];
    if (defect === 'missing') state.companies = [];
    if (defect === 'inactive') state.active = false;
    if (defect === 'demoted') state.currentRole = 'EDITOR';
    if (defect === 'stale-session') state.version = 2;
    const response = await call(); assert.equal(response.status, 403); assert.equal(state.providerLoads, 0); assert.equal(state.calls, 0);
    assert.equal((await response.json()).checks, undefined);
  });
}
test('shared storage diagnostic preserves attributable legacy administrators without object metadata', async () => {
  for (const role of ['OWNER', 'ADMIN']) {
    const { state, call } = fixture(); state.initialRole = role; state.currentRole = role;
    const response = await call(); assert.equal(response.status, 200); assert.equal(state.calls, 1); assert.equal(state.providerLoads, 1); assert.equal(state.locks, 3);
    const text = await response.text(); assert.doesNotMatch(text, /PRIVATE_OBJECT_KEY|synthetic/);
  }
});
test('shared storage diagnostic fails closed on database errors and redacts unknown provider identities', async () => {
  const { state, call, S3ServiceException } = fixture(); state.failDb = true;
  let response = await call(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /PRIVATE/); assert.equal(state.calls, 0);
  state.failDb = false; state.providerError = Object.assign(new S3ServiceException('PRIVATE_DETAIL'), { name: 'PRIVATE_PROVIDER_ID' });
  response = await call(); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /PRIVATE/);
  state.providerError = Object.assign(new Error('PRIVATE_DETAIL'), { name: 'PRIVATE_ERROR_NAME' });
  response = await call(); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /PRIVATE/);
});
