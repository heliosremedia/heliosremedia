import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load<T>(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, URL, Date, Number, ...globals,
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency: ${id}`); return modules[id]; } });
  return exports as T;
}
type Route = Record<'POST' | 'PATCH' | 'DELETE', (request: Request) => Promise<Response>>;
const actor = { userId: 'operator', workspaceId: 'b', role: 'EDITOR', sessionVersion: 7, email: 'operator@example.test' };
const publicUrl = (key: string) => `https://assets.example.test/${key}`;
const ownKey = 'workspaces/b/locations/location-b-new.webp';
const body = { city: 'B town', state: 'Example', county: 'County', seoTitle: 'B town', seoDescription: 'Local media',
  heroLead: 'Lead', introduction: 'Introduction', marketTitle: 'Market', marketCopy: 'Market story', localDetails: ['Local fact'],
  serviceArea: 'B town', slug: 'b-town', featureImageStorageKey: ownKey, featureImageUrl: 'https://forged.example.test/photo',
  locationId: 'location-b', workspaceId: 'a' };
const request = (method: string, value: unknown = body) => new Request('https://a.example.test/api/admin/locations?locationId=location-b&workspaceId=a', {
  method, headers: { 'content-type': 'application/json', 'x-workspace-id': 'a' }, ...(method !== 'DELETE' ? { body: JSON.stringify(value) } : {}),
});
function fixture() {
  const row = { id: 'location-b', workspaceId: 'b', slug: 'b-town', city: 'B town', updatedAt: new Date(1), displayOrder: 0,
    featureImageStorageKey: 'site/locations/b/location-b/old.webp' as string | null, featureImageUrl: publicUrl('site/locations/b/location-b/old.webp') as string | null };
  const state = { session: { ...actor } as typeof actor | null, freshRole: 'EDITOR', active: true, membershipStatus: 'ACTIVE', revision: 1,
    owner: 'b', writes: 0, deletions: 0, signs: 0, registered: true, registryOwner: 'b', registryStatus: 'UPLOAD_PROVISIONED',
    beforeWrite: () => {}, events: [] as string[], result: {} as Record<string, unknown>, row };
  const matches = (where: Record<string, unknown>) => (!where.workspaceId || where.workspaceId === state.owner)
    && (!where.id || where.id === row.id) && (!where.updatedAt || (where.updatedAt as Date).getTime() === state.revision);
  const locationPage = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      state.events.push('read');
      if (!where.id) return null; // Unique-slug probe.
      return matches(where) ? { ...row, workspaceId: state.owner, updatedAt: new Date(state.revision) } : null;
    },
    findMany: async () => [{ ...row, updatedAt: new Date(state.revision) }, { ...row, id: 'neighbor-b', slug: 'neighbor', displayOrder: 1 }],
    aggregate: async () => ({ _max: { displayOrder: 1 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => { state.writes++; state.result = data; return { ...row, ...data }; },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (!matches(where)) throw Object.assign(new Error('Changed'), { code: 'P2025' });
      state.writes++; state.result = data; return { ...row, ...data };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      if (!matches(where)) throw Object.assign(new Error('Changed'), { code: 'P2025' });
      state.writes++; return row;
    },
  };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getAdminSession: async () => state.session }, '@/lib/audit': { recordAuditEvent: async () => {} },
    '@/lib/content-image-storage': { verifyContentImage: async () => { state.events.push('head'); }, deleteContentImage: async () => { state.deletions++; } },
    '@/lib/location-page-content': load('./location-page-content.ts', {}),
    '@/lib/r2-upload': { getPublicAssetUrl: publicUrl, createLocationFeatureImageKey: () => ownKey,
      validateImageUpload() {}, createPresignedUploadUrl: async () => { state.signs++; return 'https://upload.example.test/synthetic'; } },
    './workspace-context-core.ts': { tenantContextEnabled: () => true }, '@/lib/workspace-context-core': { tenantContextEnabled: () => true },
    './workspace-membership-core.ts': load('./workspace-membership-core.ts', {}),
    '@/lib/r2': { r2Config: { accountId: 'synthetic-account', bucketName: 'synthetic-bucket' } },
  };
  const prisma = {
    locationPage,
    siteSettings: { findFirst: async () => ({ businessName: 'Company B' }) },
    workspace: { findMany: async () => [{ id: 'a' }, { id: 'b' }] },
    workspaceAsset: {
      findUnique: async () => state.registered ? { workspaceId: state.registryOwner, status: state.registryStatus } : null,
      create: async ({ data }: { data: Record<string, unknown> }) => { assert.equal(data.workspaceId, 'b'); state.events.push('register'); return { id: 'asset-b' }; },
      updateMany: async () => { state.events.push('provisioned'); return { count: 1 }; },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      state.beforeWrite();
      return fn({ locationPage, $queryRaw: async () => { state.events.push('lock'); return []; },
        adminUser: { findFirst: async () => ({ ...actor, id: actor.userId, active: state.active }) },
        workspaceMembership: { findUnique: async () => ({ userId: actor.userId, workspaceId: actor.workspaceId, status: state.membershipStatus, role: state.freshRole }) },
      });
    },
  };
  modules['@/lib/prisma'] = { prisma };
  modules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts', modules);
  const policy = load('./workspace-brand-storage.ts', {});
  modules['@/lib/workspace-brand-storage'] = policy;
  modules['@/lib/location-image-ownership'] = load('./location-image-ownership.ts', { './workspace-brand-storage': policy });
  modules['@/lib/workspace-brand-assets'] = load('./workspace-brand-assets.ts', modules, { process: { env: {} } });
  const globals = { console: { error() {} }, process: { env: {} }, fetch: () => { throw new Error('No real provider allowed'); } };
  return { state, prisma: prisma as unknown as Record<string, unknown>, route: load<Route>('../app/api/admin/locations/route.ts', modules, globals),
    presign: load<Route>('../app/api/admin/locations/presign/route.ts', modules, globals),
    ai: load<Route>('../app/api/admin/locations/ai/route.ts', modules, globals) };
}

test('location mutations, signing and AI reject a current viewer before content/provider work', async () => {
  for (const role of ['VIEWER', null]) {
    const { state, route, presign, ai } = fixture();
    state.session = role ? { ...actor, role } : null;
    for (const [handler, method] of [[route.POST, 'POST'], [route.PATCH, 'PATCH'], [route.DELETE, 'DELETE'], [presign.POST, 'POST'], [ai.POST, 'POST']] as const) {
      const response = await handler(request(method));
      assert.equal(response.status, role ? 403 : 401);
    }
    assert.equal(state.writes + state.deletions + state.signs, 0);
    assert.equal(state.events.length, 0);
  }
});

test('location image compatibility retains owned legacy assets but rejects corrupt foreign references and traversal', () => {
  const policy = load('./workspace-brand-storage.ts', {});
  const { resolveLocationImage, readableLocationImage } = load<typeof import('./location-image-ownership')>('./location-image-ownership.ts', { './workspace-brand-storage': policy });
  const legacy = { key: 'site/locations/b/location-b/old.webp', url: 'https://old.example.test/old.webp' };
  assert.equal(resolveLocationImage('b', 'location-b', legacy, legacy, publicUrl).url, publicUrl(legacy.key));
  assert.equal(resolveLocationImage('b', 'location-b', { key: ownKey, url: 'https://foreign.example.test/image' }, legacy, publicUrl).url, publicUrl(ownKey));
  assert.equal(resolveLocationImage('b', 'location-b', { key: null, url: null }, legacy, publicUrl).key, null);
  const oldRecord = { key: 'site/locations/location-b/old.webp', url: publicUrl('site/locations/location-b/old.webp') };
  assert.equal(resolveLocationImage('b', 'location-b', oldRecord, oldRecord, publicUrl).key, oldRecord.key);
  for (const key of ['site/locations/a/location-a/old.webp', 'site/locations/b/another-location/old.webp', 'workspaces/a/locations/old.webp',
    'workspaces/b/locations/../old.webp', 'workspaces/b/locations/new.webp?query', 'workspaces/b/blog/new.webp', 'site/locations/b/location-b/../old.webp', 'site/locations/location-a/old.webp']) {
    const value = { key, url: publicUrl(key) };
    assert.throws(() => resolveLocationImage('b', 'location-b', value, value, publicUrl), /INVALID_BRAND_IMAGE/);
    assert.equal(readableLocationImage('b', 'location-b', value, publicUrl).url, null);
  }
  assert.throws(() => resolveLocationImage('b', 'location-b', { key: null, url: publicUrl('workspaces/a/locations/old.webp') },
    { key: null, url: publicUrl('workspaces/a/locations/old.webp') }, publicUrl), /INVALID_BRAND_IMAGE/);
});

test('publishing rejects corrupt or quarantined images while unpublishing remains available', async () => {
  for (const corrupt of ['foreign-key', 'quarantined']) {
    const { state, route } = fixture();
    if (corrupt === 'foreign-key') state.row.featureImageStorageKey = 'site/locations/a/location-a/old.webp';
    else state.registryStatus = 'QUARANTINED';
    assert.equal((await route.PATCH(request('PATCH', { locationId: 'location-b', action: 'publish', published: true }))).status, 400);
    assert.equal(state.writes, 0);
    assert.equal((await route.PATCH(request('PATCH', { locationId: 'location-b', action: 'publish', published: false }))).status, 200);
    assert.equal(state.result.published, false);
  }
});

test('location admin DTO withholds corrupt image pointers without altering stored rows', async () => {
  type Element = { type: unknown; props: Record<string, unknown> };
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
  const policy = load('./workspace-brand-storage.ts', {});
  const imagePolicy = load('./location-image-ownership.ts', { './workspace-brand-storage': policy });
  const manager = Symbol('LocationPageManager');
  const stored = { id: 'location-b', workspaceId: 'b', featureImageStorageKey: 'workspaces/a/locations/foreign.webp',
    featureImageUrl: publicUrl('workspaces/a/locations/foreign.webp'), localDetails: ['Local fact'], createdAt: new Date(1), updatedAt: new Date(1) };
  const page = load<{ default(): Promise<Element> }>('../app/admin/locations/page.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lib/auth/session': { requireAdminSession: async () => actor },
    '@/lib/r2-upload': { getPublicAssetUrl: publicUrl }, '@/lib/location-image-ownership': imagePolicy,
    './LocationPageManager': { default: manager },
    '@/lib/prisma': { prisma: { locationPage: { findMany: async ({ where }: { where: { workspaceId: string } }) => { assert.equal(where.workspaceId, 'b'); return [stored]; } } } },
  });
  const result = await page.default();
  const children = result.props.children as Element[];
  const props = children.find(child => child?.type === manager)!.props;
  const image = (props.initialLocations as Array<{ featureImageStorageKey: string | null; featureImageUrl: string | null }>)[0];
  assert.equal(image.featureImageStorageKey, null); assert.equal(image.featureImageUrl, null);
  assert.ok(children.some(child => child?.props?.role === 'status'));
  assert.equal(stored.featureImageStorageKey, 'workspaces/a/locations/foreign.webp');
});

test('actual location reorder transaction rolls back partial order changes and fences publish/delete ownership in isolated SQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "sessionVersion" INT, active BOOLEAN, role TEXT);
      CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "userId" TEXT, status TEXT, role TEXT);
      CREATE TABLE locations (id TEXT PRIMARY KEY, "workspaceId" TEXT, slug TEXT, city TEXT, "updatedAt" TIMESTAMPTZ, "displayOrder" INT, published BOOLEAN);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('operator','b',7,true,'EDITOR');
      INSERT INTO "WorkspaceMembership" VALUES ('membership','b','operator','ACTIVE','EDITOR');
      INSERT INTO locations VALUES ('location-b','b','b-town','B town','1970-01-01T00:00:00.001Z',0,false),
        ('neighbor-b','b','neighbor','Neighbor','1970-01-01T00:00:00.001Z',1,false),
        ('foreign-a','a','a-town','A town','1970-01-01T00:00:00.001Z',0,true);`);
    const { route, prisma } = fixture();
    type SQL = { query: PGlite['query'] };
    type Where = { id?: string; workspaceId?: string; updatedAt?: Date };
    let updateCalls = 0;
    let failSecond = false;
    const delegate = (sql: SQL) => ({
      findFirst: async ({ where }: { where: Where }) => (await sql.query('SELECT * FROM locations WHERE id=$1 AND "workspaceId"=$2 AND ($3::timestamptz IS NULL OR "updatedAt"=$3)',
        [where.id, where.workspaceId, where.updatedAt?.toISOString() ?? null])).rows[0] ?? null,
      findMany: async ({ where }: { where: Where }) => (await sql.query('SELECT * FROM locations WHERE "workspaceId"=$1 ORDER BY "displayOrder", city', [where.workspaceId])).rows,
      update: async ({ where, data }: { where: Where; data: { displayOrder?: number; published?: boolean } }) => {
        updateCalls++;
        if (failSecond && updateCalls === 2) throw new Error('Synthetic second update failure');
        const rows = (await sql.query('UPDATE locations SET "displayOrder"=COALESCE($4,"displayOrder"), published=COALESCE($5,published) WHERE id=$1 AND "workspaceId"=$2 AND "updatedAt"=$3 RETURNING *',
          [where.id, where.workspaceId, where.updatedAt?.toISOString(), data.displayOrder ?? null, data.published ?? null])).rows;
        if (!rows.length) throw Object.assign(new Error('Changed'), { code: 'P2025' });
        return rows[0];
      },
      delete: async ({ where }: { where: Where }) => {
        const rows = (await sql.query('DELETE FROM locations WHERE id=$1 AND "workspaceId"=$2 AND "updatedAt"=$3 RETURNING *', [where.id, where.workspaceId, where.updatedAt?.toISOString()])).rows;
        if (!rows.length) throw Object.assign(new Error('Changed'), { code: 'P2025' });
        return rows[0];
      },
    });
    prisma.locationPage = delegate(db);
    let beforeTransaction = async () => {};
    prisma.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
      await beforeTransaction();
      return db.transaction(async sql => fn({
        locationPage: delegate(sql),
        $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (await sql.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)).rows,
        adminUser: { findFirst: async () => (await sql.query('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2', ['operator', 'b'])).rows[0] },
        workspaceMembership: { findUnique: async () => (await sql.query('SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2', ['operator', 'b'])).rows[0] },
      }));
    };
    const ordering = async () => (await db.query('SELECT id,"displayOrder" FROM locations ORDER BY id')).rows;
    const original = await ordering();
    failSecond = true;
    assert.equal((await route.PATCH(request('PATCH', { locationId: 'location-b', action: 'reorder', direction: 'down' }))).status, 500);
    assert.deepEqual(await ordering(), original, 'first order update rolls back when second fails');
    failSecond = false; updateCalls = 0;
    assert.equal((await route.PATCH(request('PATCH', { locationId: 'location-b', action: 'reorder', direction: 'down' }))).status, 200);
    assert.deepEqual(await ordering(), [{ id: 'foreign-a', displayOrder: 0 }, { id: 'location-b', displayOrder: 1 }, { id: 'neighbor-b', displayOrder: 0 }]);
    beforeTransaction = async () => { await db.query('UPDATE locations SET "workspaceId"=$1 WHERE id=$2', ['a', 'location-b']); };
    assert.equal((await route.PATCH(request('PATCH', { locationId: 'location-b', action: 'publish', published: true }))).status, 409);
    assert.equal((await db.query<{ published: boolean }>('SELECT published FROM locations WHERE id=$1', ['location-b'])).rows[0].published, false);
    await db.query('UPDATE locations SET "workspaceId"=$1 WHERE id=$2', ['b', 'location-b']);
    beforeTransaction = async () => { await db.query('UPDATE "WorkspaceMembership" SET status=$1', ['REVOKED']); };
    assert.equal((await route.DELETE(request('DELETE'))).status, 403);
    assert.equal((await db.query('SELECT id FROM locations')).rows.length, 3);
    beforeTransaction = async () => {};
    await db.query('UPDATE "WorkspaceMembership" SET status=$1', ['ACTIVE']);
    assert.equal((await route.DELETE(request('DELETE'))).status, 200);
    assert.deepEqual((await db.query('SELECT id FROM locations ORDER BY id')).rows, [{ id: 'foreign-a' }, { id: 'neighbor-b' }]);
  } finally { await db.close(); }
});

test('location creation rejects foreign/unregistered images and canonicalizes only registered owned attachments', async () => {
  for (const key of ['workspaces/a/locations/new.webp', 'site/locations/a/location-a/old.webp', 'site/locations/b/location-b/old.webp']) {
    const { state, route } = fixture();
    assert.equal((await route.POST(request('POST', { ...body, featureImageStorageKey: key }))).status, 400);
    assert.equal(state.writes, 0);
  }
  for (const kind of ['unregistered', 'foreign-registry', 'quarantined']) {
    const { state, route } = fixture();
    state.registered = kind !== 'unregistered'; state.registryOwner = kind === 'foreign-registry' ? 'a' : 'b';
    state.registryStatus = kind === 'quarantined' ? 'QUARANTINED' : 'UPLOAD_PROVISIONED';
    assert.equal((await route.POST(request('POST'))).status, 400);
    assert.equal(state.writes, 0);
  }
  const { state, route } = fixture();
  assert.equal((await route.POST(request('POST'))).status, 201);
  assert.equal(state.result.workspaceId, 'b');
  assert.equal(state.result.featureImageUrl, publicUrl(ownKey));
  assert.equal(state.result.published, false);
});

test('location updates and deletes recheck membership, ownership and revision and never remove storage objects', async () => {
  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    for (const role of ['VIEWER', 'revoked']) {
      const { state, route } = fixture();
      state.beforeWrite = () => { if (role === 'revoked') state.membershipStatus = 'REVOKED'; else state.freshRole = role; };
      assert.equal((await route[method](request(method))).status, 403);
      assert.equal(state.writes + state.deletions, 0);
    }
  }
  for (const method of ['PATCH', 'DELETE'] as const) {
    for (const change of ['owner', 'revision']) {
      const { state, route } = fixture();
      state.beforeWrite = () => { if (change === 'owner') state.owner = 'a'; else state.revision++; };
      assert.equal((await route[method](request(method))).status, 409);
      assert.equal(state.writes + state.deletions, 0);
    }
    const { state, route } = fixture();
    assert.equal((await route[method](request(method))).status, 200);
    assert.equal(state.writes, 1); assert.equal(state.deletions, 0);
  }
});

test('location presign registers owned identity before signing and denies foreign records', async () => {
  const { state, presign } = fixture();
  const upload = { locationId: 'location-b', fileName: 'photo.webp', fileType: 'image/webp', fileSize: 1024 };
  state.owner = 'a';
  assert.equal((await presign.POST(request('POST', upload))).status, 404);
  assert.equal(state.signs, 0);
  state.owner = 'b';
  const response = await presign.POST(request('POST', upload));
  assert.equal(response.status, 200); assert.equal(state.signs, 1);
  assert.ok(state.events.includes('register')); assert.ok(state.events.includes('provisioned'));
  assert.equal((await response.json()).upload.key, ownKey);
});
