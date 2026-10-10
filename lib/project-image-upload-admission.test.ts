import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { resolveMembershipAccess } from './workspace-membership-core.ts';

function load<T>(path: string, modules: Record<string, unknown>): T {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require(id: string) { if (!(id in modules)) throw new Error(`Unexpected module ${id}`); return modules[id]; }, Error, console: { error() {} },
  });
  return exports as T;
}
function fixture() {
  const state = { initialRole: 'EDITOR', currentRole: 'EDITOR', active: true, membership: 'ACTIVE', version: 7, project: true, service: true, signed: 0, providerFailure: false, collision: false, events: [] as string[] };
  const tx = {
    $queryRaw: async () => [],
    adminUser: { findFirst: async () => ({ id: 'ua', workspaceId: 'a', role: 'OWNER', active: state.active, sessionVersion: state.version }) },
    workspaceMembership: { findUnique: async () => ({ userId: 'ua', workspaceId: 'a', role: state.currentRole, status: state.membership }) },
    project: { findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => { assert.equal(where.workspaceId, 'a'); return state.project && where.id === 'pa' ? { id: 'pa' } : null; } },
    service: { findFirst: async ({ where }: { where: { id: string; workspaceId: string; active: boolean; archivedAt: null } }) => { assert.equal(where.workspaceId, 'a'); assert.equal(where.active, true); assert.equal(where.archivedAt, null); return state.service && where.id === 'sa' ? { id: 'sa', slug: 'photos' } : null; } },
    workspaceAsset: { create: async ({ data }: { data: { workspaceId: string; providerKey: string; byteSize: bigint; provenance: { actorId: string; projectId: string } } }) => {
      assert.equal(data.workspaceId, 'a'); assert.match(data.providerKey, /^projects\/pa\//); assert.equal(data.byteSize, BigInt(100)); assert.equal(data.provenance.actorId, 'ua'); assert.equal(data.provenance.projectId, 'pa');
      state.events.push('register'); if (state.collision) throw new Error('provider identity collision'); return { id: 'asset' };
    } },
  };
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response }, '@/lib/r2': { r2Config: { accountId: 'synthetic', bucketName: 'synthetic' } },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: state.initialRole, sessionVersion: 7 }) },
    './workspace-lifecycle/state.ts': { workspaceIsActive: async () => true },
    './workspace-context-core.ts': { tenantContextEnabled: () => true }, './workspace-membership-core.ts': { resolveMembershipAccess },
    '@/lib/prisma': { prisma: { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => { const result = await fn(tx); state.events.push('commit'); return result; }, workspaceAsset: { updateMany: async ({ where, data }: { where: { id: string; workspaceId: string; status: string }; data: { status: string } }) => { assert.equal(where.id, 'asset'); assert.equal(where.workspaceId, 'a'); assert.equal(where.status, 'UPLOAD_PENDING'); state.events.push(data.status); return { count: 1 }; } } } },
    '@/lib/r2-upload': {
      isUploadMediaCategory: (value: unknown) => value === 'PHOTOGRAPHY', createImageKey: () => 'projects/pa/photography/image.png', createServiceImageKey: () => 'projects/pa/photos/image.png',
      getPublicAssetUrl: (key: string) => `https://assets.example.test/${key}`, createPresignedUploadUrl: async () => { assert.equal(state.events.at(-1), 'commit'); state.signed++; if (state.providerFailure) throw new Error('PRIVATE_PROVIDER_FAILURE'); return 'synthetic-url'; },
    },
    '@/lib/service-media': { mediaFolderForService: () => 'photos' }, '@/lib/project-media-upload': { getProjectMediaImageValidationError: () => null },
  };
  modules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts', modules);
  const route = load<{ POST: (request: Request) => Promise<Response> }>('../app/api/admin/r2/presign/route.ts', modules);
  const call = (body = {}) => route.POST(new Request('https://b.example.test/api/admin/r2/presign', { method: 'POST', body: JSON.stringify({ projectId: 'pa', fileName: 'image.png', fileType: 'image/png', fileSize: 100, workspaceId: 'b', key: 'projects/pb/foreign.png', ...body }) }));
  return { state, call };
}
for (const defect of ['initial-viewer', 'demoted', 'revoked', 'inactive', 'session-version'] as const) {
  test(`project image upload rejects ${defect} before registration or signing`, async () => {
    const { state, call } = fixture();
    if (defect === 'initial-viewer') state.initialRole = 'VIEWER';
    if (defect === 'demoted') state.currentRole = 'VIEWER';
    if (defect === 'revoked') state.membership = 'REVOKED';
    if (defect === 'inactive') state.active = false;
    if (defect === 'session-version') state.version++;
    const response = await call(); assert.equal(response.status, 403); assert.equal(state.signed, 0); assert.deepEqual(state.events, []); assert.equal((await response.json()).upload, undefined);
  });
}
test('project image upload requires owned project and active owned service', async () => {
  const { state, call } = fixture();
  assert.equal((await call({ projectId: 'pb' })).status, 404);
  assert.equal((await call({ serviceId: 'sb' })).status, 409);
  state.service = false; assert.equal((await call({ serviceId: 'sa' })).status, 409);
  assert.equal(state.signed, 0); assert.deepEqual(state.events, []);
});
test('project upload registers before signing and preserves project/service response identities', async () => {
  for (const serviceId of ['', 'sa']) {
    const { state, call } = fixture(); const response = await call({ serviceId }); assert.equal(response.status, 200);
    const { upload } = await response.json(); assert.match(upload.key, /^projects\/pa\//); assert.equal(upload.serviceId, serviceId || null);
    assert.deepEqual(state.events, ['register', 'commit', 'UPLOAD_PROVISIONED']); assert.equal(state.signed, 1);
  }
});
test('project upload collision or provider failure never returns a grant or private error', async () => {
  const { state, call } = fixture(); state.collision = true; assert.equal((await call()).status, 500); assert.equal(state.signed, 0);
  state.collision = false; state.events = []; state.providerFailure = true; const response = await call(); assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /PRIVATE_PROVIDER_FAILURE|uploadUrl/); assert.deepEqual(state.events, ['register', 'commit', 'FAILED']);
});

test('project upload rejects zero, negative and fractional byte sizes before admission', async () => {
  const { state, call } = fixture();
  for (const fileSize of [0, -1, 0.5]) assert.equal((await call({ fileSize })).status, 400);
  assert.equal(state.signed, 0); assert.deepEqual(state.events, []);
});
