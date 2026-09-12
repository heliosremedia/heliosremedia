import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, URL, Date, ...globals,
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency: ${id}`); return modules[id]; } });
  return exports as T;
}
const policy = load<typeof import('./workspace-brand-storage')>('./workspace-brand-storage.ts', {});
const ownership = load<typeof import('./homepage-film-ownership')>('./homepage-film-ownership.ts', { './workspace-brand-storage': policy });
const publicUrl = (key: string) => `https://assets.example.test/${key}`;
const videoKey = 'workspaces/b/site-featured-film/video-new.mp4';
const posterKey = 'workspaces/b/site-featured-film/poster-new.webp';
const legacy = { key: 'site/homepage/featured-film/video-old.mp4', url: 'https://assets.example.test/site/homepage/featured-film/video-old.mp4' };
const body = { featuredFilmEnabled: true, featuredFilmVideoStorageKey: videoKey, featuredFilmVideoUrl: 'https://forged.example/video.mp4',
  featuredFilmPosterStorageKey: posterKey, featuredFilmPosterUrl: 'https://forged.example/poster.webp', featuredFilmDestination: '/portfolio?service=cinematic-films', workspaceId: 'a' };
const request = (value: unknown = body) => new Request('https://a.example/api/admin/homepage-film?workspaceId=a', {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-workspace-id': 'a' }, body: JSON.stringify(value),
});
type Route = { PATCH(request: Request): Promise<Response> };

function fixture() {
  const actor = { userId: 'operator', workspaceId: 'b', sessionVersion: 7, role: 'EDITOR' };
  const state = { session: actor as typeof actor | null, tenant: true, companies: [{ id: 'a' }, { id: 'b' }],
    exists: true, revision: 1, writes: 0, headChecks: 0, freshRole: 'EDITOR', membershipStatus: 'ACTIVE',
    assetOwner: 'b', assetStatus: 'UPLOAD_PROVISIONED', registered: true,
    beforeWrite: () => {}, events: [] as string[], result: {} as Record<string, unknown>, logs: [] as unknown[],
    current: { featuredFilmVideoStorageKey: legacy.key, featuredFilmVideoUrl: legacy.url, featuredFilmPosterStorageKey: null as string | null, featuredFilmPosterUrl: null as string | null } };
  const baseModules: Record<string, unknown> = {
    'server-only': {}, 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => state.session },
    '@/lib/workspace-brand-storage': policy, './workspace-brand-storage': policy,
    '@/lib/homepage-film-ownership': ownership,
    '@/lib/r2-upload': { getPublicAssetUrl: publicUrl },
    '@/lib/r2': { r2Config: { accountId: 'account', bucketName: 'bucket' } },
    '@/lib/content-image-storage': { verifyContentImage: async () => { state.headChecks++; } },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant },
    './workspace-context-core.ts': { tenantContextEnabled: () => state.tenant },
    './workspace-membership-core.ts': load('./workspace-membership-core.ts', {}),
  };
  const prisma = {
    workspace: { findMany: async () => state.companies },
    siteSettings: { findUnique: async ({ where }: { where: { workspaceId: string } }) => {
      assert.equal(where.workspaceId, 'b'); state.events.push('read-owned');
      return state.exists ? { id: 'settings-b', updatedAt: new Date(state.revision), ...state.current } : null;
    } },
    workspaceAsset: { findUnique: async ({ where }: { where: { provider_providerNamespace_providerKey: { providerKey: string } } }) => {
      const key = where.provider_providerNamespace_providerKey.providerKey;
      assert.ok([videoKey, posterKey, legacy.key].includes(key));
      return state.registered ? { id: 'asset', workspaceId: state.assetOwner, status: state.assetStatus } : null;
    } },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      state.beforeWrite();
      const tx = {
        $queryRaw: async () => { state.events.push('lock'); return []; },
        adminUser: { findFirst: async () => ({ id: actor.userId, active: true, workspaceId: 'b', role: 'OWNER', sessionVersion: 7 }) },
        workspaceMembership: { findUnique: async () => ({ userId: actor.userId, workspaceId: 'b', status: state.membershipStatus, role: state.freshRole }) },
        siteSettings: {
          updateMany: async ({ where, data }: { where: { AND: [{ workspaceId: string }, { id: string; updatedAt: Date }] }; data: Record<string, unknown> }) => {
            assert.equal(where.AND[0].workspaceId, 'b'); assert.equal(where.AND[1].id, 'settings-b');
            if (where.AND[1].updatedAt.getTime() !== state.revision) return { count: 0 };
            state.writes++; state.result = data; return { count: 1 };
          },
          create: async ({ data }: { data: Record<string, unknown> }) => {
            assert.equal(data.id, 'workspace:b'); assert.equal(data.workspaceId, 'b'); state.writes++; state.result = data;
          },
        },
      };
      return fn(tx);
    },
  };
  baseModules['@/lib/prisma'] = { prisma };
  const singleton = load<{ getWorkspaceSingletonTarget: unknown }>('./workspace-singleton.ts', baseModules);
  baseModules['@/lib/site-settings-ownership'] = { getSiteSettingsWriteTarget: singleton.getWorkspaceSingletonTarget };
  baseModules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts', baseModules);
  baseModules['@/lib/workspace-brand-assets'] = load('./workspace-brand-assets.ts', baseModules, { process: { env: {} } });
  const route = load<Route>('../app/api/admin/homepage-film/route.ts', baseModules, { console: { error: (...args: unknown[]) => state.logs.push(args) } });
  return { state, route };
}

test('featured-film policy rejects foreign, wrong-kind, arbitrary and newly attached legacy assets', () => {
  assert.equal(ownership.resolveFeaturedFilmAsset('b', 'video', { key: videoKey, url: 'https://forged.example' }, null, publicUrl).url, publicUrl(videoKey));
  assert.equal(ownership.resolveFeaturedFilmAsset('b', 'video', legacy, legacy, publicUrl).url, legacy.url);
  for (const key of ['workspaces/a/site-featured-film/video-new.mp4', 'workspaces/b/site-hero/video-new.mp4', posterKey, `${videoKey}?x`, 'workspaces/b/site-featured-film/../video.mp4', legacy.key]) {
    assert.throws(() => ownership.resolveFeaturedFilmAsset('b', 'video', { key, url: publicUrl(key) }, null, publicUrl), /INVALID_BRAND_IMAGE/);
  }
  assert.throws(() => ownership.resolveFeaturedFilmAsset('b', 'video', { ...legacy, url: 'https://changed.example' }, legacy, publicUrl));
  const foreign = { key: null, url: publicUrl('workspaces/a/site-featured-film/video.mp4') };
  assert.throws(() => ownership.resolveFeaturedFilmAsset('b', 'video', foreign, foreign, publicUrl));
});

test('featured-film mutation requires local editor access and retains replaced storage while returning only film fields', async () => {
  const f = fixture();
  f.state.session = null;
  assert.equal((await f.route.PATCH(request())).status, 403);
  f.state.session = { userId: 'operator', workspaceId: 'b', sessionVersion: 7, role: 'VIEWER' };
  assert.equal((await f.route.PATCH(request())).status, 403);
  assert.deepEqual(f.state.events, []);
  f.state.session.role = 'EDITOR';
  const response = await f.route.PATCH(request());
  assert.equal(response.status, 200);
  assert.equal(f.state.writes, 1);
  const saved = (await response.json()).settings;
  assert.equal(saved.featuredFilmVideoUrl, publicUrl(videoKey));
  assert.equal(saved.featuredFilmPosterUrl, publicUrl(posterKey));
  assert.equal(Object.keys(saved).length, 6, 'no full settings row returned');
  assert.equal(f.state.headChecks, 2);
  assert.equal(f.state.events.filter(event => event === 'lock').length, 3);
  // No delete dependency is provided. Any cleanup provider call fails this test.
});

test('featured-film mutation rejects unregistered/foreign/quarantined assets, fresh revocation and concurrent settings changes', async () => {
  for (const mode of ['foreign-key', 'unregistered', 'foreign-registry', 'quarantined', 'revoked', 'demoted', 'changed'] as const) {
    const f = fixture();
    let input = body;
    if (mode === 'foreign-key') input = { ...body, featuredFilmVideoStorageKey: 'workspaces/a/site-featured-film/video-new.mp4' };
    if (mode === 'unregistered') f.state.registered = false;
    if (mode === 'foreign-registry') f.state.assetOwner = 'a';
    if (mode === 'quarantined') f.state.assetStatus = 'QUARANTINED';
    if (mode === 'revoked') f.state.beforeWrite = () => { f.state.membershipStatus = 'REVOKED'; };
    if (mode === 'demoted') f.state.beforeWrite = () => { f.state.freshRole = 'VIEWER'; };
    if (mode === 'changed') f.state.beforeWrite = () => { f.state.revision++; };
    assert.equal((await f.route.PATCH(request(input))).status, mode === 'changed' ? 409 : ['revoked', 'demoted'].includes(mode) ? 403 : 400, mode);
    assert.equal(f.state.writes, 0, mode);
    if (['foreign-key', 'unregistered', 'foreign-registry', 'quarantined'].includes(mode)) assert.equal(f.state.headChecks, 0, mode);
  }
});

test('featured-film mutation preserves exact legacy references, creates scoped identities and rejects ambiguous legacy mode', async () => {
  const f = fixture();
  f.state.registered = false;
  assert.equal((await f.route.PATCH(request({ ...body, featuredFilmVideoStorageKey: legacy.key, featuredFilmVideoUrl: legacy.url, featuredFilmPosterStorageKey: null, featuredFilmPosterUrl: null }))).status, 200);
  assert.equal(f.state.headChecks, 0);
  f.state.exists = false; f.state.registered = true;
  assert.equal((await f.route.PATCH(request())).status, 200);
  assert.equal(f.state.result.workspaceId, 'b');
  const writes = f.state.writes;
  f.state.tenant = false;
  assert.equal((await f.route.PATCH(request())).status, 500);
  assert.equal(f.state.writes, writes);
  assert.doesNotMatch(JSON.stringify(f.state.logs), /Legacy settings require|workspace:b/);
});

test('featured-film presign registers workspace identity before signing and validates kind, size and local role', async () => {
  let role = 'VIEWER';
  let signed = 0;
  let registered = false;
  const modules: Record<string, unknown> = {
    'next/server': { NextResponse: Response },
    '@/lib/auth/session': { getAdminSession: async () => ({ role, userId: 'operator', workspaceId: 'b' }) },
    '@/lib/site-settings-ownership': { getSiteSettingsWriteTarget: async (id: string) => { assert.equal(id, 'b'); } },
    '@/lib/workspace-brand-storage': policy, crypto: { randomUUID: () => 'unique-id' },
    '@aws-sdk/client-s3': {}, '@aws-sdk/s3-request-presigner': {}, '@/lib/r2': {},
    '@/lib/workspace-brand-assets': { withBrandUploadAsset: async (input: { workspaceId: string; kind: string; key: string; byteSize: number }, provision: () => Promise<string>) => {
      assert.equal(input.workspaceId, 'b'); assert.equal(input.kind, 'site-featured-film'); assert.equal(input.byteSize, 1024);
      assert.match(input.key, /^workspaces\/b\/site-featured-film\/video-.*-unique-i\.mp4$/);
      registered = true; return provision();
    } },
  };
  const keys = load<{ createFeaturedFilmKey: unknown }>('./r2-upload.ts', modules);
  modules['@/lib/r2-upload'] = { createFeaturedFilmKey: keys.createFeaturedFilmKey, getPublicAssetUrl: publicUrl,
    createPresignedUploadUrl: async () => { assert.equal(registered, true); signed++; return 'synthetic-upload'; } };
  const route = load<{ POST(request: Request): Promise<Response> }>('../app/api/admin/homepage-film/presign/route.ts', modules);
  const input = { kind: 'video', fileType: 'video/mp4', fileSize: 1024, workspaceId: 'a' };
  assert.equal((await route.POST(request(input))).status, 403);
  role = 'EDITOR';
  for (const invalid of [null, { ...input, kind: 'unknown' }, { ...input, fileSize: 1.5 }, { ...input, fileSize: 501 * 1024 * 1024 }, { ...input, fileType: 'text/html' }]) {
    assert.equal((await route.POST(request(invalid))).status, 400);
  }
  assert.equal(signed, 0);
  const response = await route.POST(request(input));
  assert.equal(response.status, 200);
  assert.equal(signed, 1);
  assert.match((await response.json()).upload.key, /^workspaces\/b\/site-featured-film\//);
});
