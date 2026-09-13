import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, URL, Date, console: { error() {} },
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency: ${id}`); return modules[id]; } });
  return exports as T;
}
type Route = { PATCH(request: Request): Promise<Response> };
const full = { businessName: 'Company B', phoneDisplay: '+15555555555', phoneE164: '+15555555555',
  bookingMode: 'PAUSED', locationLabel: 'City', serviceArea: 'Area', defaultSeoTitle: 'Company B',
  defaultSeoDescription: 'Description', standardPrinciples: [], approachCards: [], headerNavigation: [], footerNavigation: [],
  websiteUrl: 'https://Example.test/Exact?Q=One#Two', bookingUrl: 'https://Booking.test/Reserve?Case=Yes',
  bookingHandoffEnabled: false, bookingRequestEnabled: false, bookingBannerEnabled: false };
const scopes = [full, { updateScope: 'homepage-navigation', navigation: [{ label: 'Work', href: '/portfolio' }] },
  { updateScope: 'homepage-structure', standardPrinciples: [], approachCards: [] }];
const request = (body: unknown) => new Request('https://foreign.example/api/admin/site-settings?workspaceId=a', {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-workspace-id': 'a' }, body: JSON.stringify(body),
});

function fixture() {
  const actor = { userId: 'operator', workspaceId: 'b', sessionVersion: 7, role: 'ADMIN' };
  const state = { session: actor as typeof actor | null, role: 'ADMIN', status: 'ACTIVE', active: true, version: 7,
    tenant: true, companies: [{ id: 'a' }, { id: 'b' }], owner: 'b' as string | null, exists: true,
    revision: 1000, writes: 0, locks: 0, invalidations: 0, beforeWrite: () => {}, result: {} as Record<string, unknown> };
  const row = (): Record<string, unknown> & { id: string; workspaceId: string | null; updatedAt: Date } => ({ id: state.tenant ? 'workspace:b' : 'default', workspaceId: state.owner, updatedAt: new Date(state.revision), ...state.result });
  const matches = (where: Record<string, unknown>): boolean => {
    if (Array.isArray(where.AND)) return where.AND.every(matches);
    if (Array.isArray(where.OR) && !where.OR.some(matches)) return false;
    if ('workspaceId' in where && where.workspaceId !== state.owner) return false;
    if ('id' in where && where.id !== row().id) return false;
    if (where.updatedAt instanceof Date && where.updatedAt.getTime() !== state.revision) return false;
    return state.exists;
  };
  const delegate = {
    findUnique: async ({ where }: { where: Record<string, unknown> }) => matches(where) ? row() : null,
    findFirst: async ({ where }: { where: Record<string, unknown> }) => matches(where) ? row() : null,
    update: async ({ data }: { data: Record<string, unknown> }) => { state.writes++; state.result = data; return row(); },
    upsert: async ({ update }: { update: Record<string, unknown> }) => { state.writes++; state.result = update; return row(); },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (!matches(where)) return { count: 0 };
      state.writes++; state.result = data;
      if (data.updatedAt instanceof Date) state.revision = data.updatedAt.getTime();
      return { count: 1 };
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      if (state.exists) throw Object.assign(new Error('synthetic duplicate'), { code: 'P2002' });
      assert.equal(data.workspaceId, 'b'); assert.equal(data.id, state.tenant ? 'workspace:b' : 'default');
      state.exists = true; state.owner = 'b'; state.result = data; state.writes++; return row();
    },
  };
  const tx = { siteSettings: delegate, workspace: { findMany: async () => state.companies },
    $queryRaw: async () => { state.locks++; return []; },
    adminUser: { findFirst: async () => ({ id: actor.userId, workspaceId: 'b', role: state.role, active: state.active, sessionVersion: state.version }) },
    workspaceMembership: { findUnique: async () => ({ userId: actor.userId, workspaceId: 'b', role: state.role, status: state.status }) } };
  const prisma = { ...tx, $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => { state.beforeWrite(); return fn(tx); } };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() { state.invalidations++; } },
    '@/lib/prisma': { prisma }, '@/lib/auth/session': { getAdminSession: async () => state.session },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant },
    './workspace-context-core.ts': { tenantContextEnabled: () => state.tenant },
    './workspace-membership-core.ts': load('./workspace-membership-core.ts', {}),
    '@/lib/r2-upload': { getPublicAssetUrl: (key: string) => `https://assets.example/${key}` },
    '@/lib/workspace-brand-assets': { verifyRegisteredBrandImage: async () => {} },
  };
  const policy = load('./workspace-brand-storage.ts', {});
  modules['@/lib/workspace-brand-storage'] = policy;
  modules['@/lib/site-hero-ownership'] = load('./site-hero-ownership.ts', { './workspace-brand-storage': policy });
  const singleton = load<{ getWorkspaceSingletonTarget: unknown }>('./workspace-singleton.ts', modules);
  modules['@/lib/site-settings-ownership'] = { getSiteSettingsWriteTarget: singleton.getWorkspaceSingletonTarget };
  modules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts', modules);
  return { state, prisma, route: load<Route>('../app/api/admin/site-settings/route.ts', modules) };
}

test('every settings scope revalidates current administrator membership before writing', async () => {
  for (const input of scopes) {
    const f = fixture();
    f.state.beforeWrite = () => { f.state.status = 'REVOKED'; };
    assert.equal((await f.route.PATCH(request(input))).status, 403);
    assert.equal(f.state.writes, 0); assert.equal(f.state.invalidations, 0);
  }
});

test('all scopes reject stale authority, ownership and revision while accepting fresh administrators', async () => {
  for (const input of scopes) {
    for (const mode of ['editor', 'viewer', 'suspended', 'inactive', 'version', 'ownership', 'revision', 'missing'] as const) {
      const f = fixture();
      f.state.beforeWrite = () => {
        if (mode === 'editor') f.state.role = 'EDITOR';
        if (mode === 'viewer') f.state.role = 'VIEWER';
        if (mode === 'suspended') f.state.status = 'SUSPENDED';
        if (mode === 'inactive') f.state.active = false;
        if (mode === 'version') f.state.version++;
        if (mode === 'ownership') f.state.owner = 'a';
        if (mode === 'revision') f.state.revision++;
        if (mode === 'missing') f.state.exists = false;
      };
      assert.equal((await f.route.PATCH(request(input))).status, ['ownership', 'revision', 'missing'].includes(mode) ? 409 : 403, mode);
      assert.equal(f.state.writes, 0); assert.equal(f.state.invalidations, 0);
    }
    const f = fixture();
    f.state.revision = Date.now() + 60000;
    const revision = f.state.revision;
    const response = await f.route.PATCH(request({ ...input, workspaceId: 'a' }));
    assert.equal(response.status, 200);
    assert.equal(f.state.writes, 1); assert.equal(f.state.locks, 3);
    const saved = (await response.json()).settings;
    assert.equal(saved.workspaceId, 'b'); assert.equal(new Date(saved.updatedAt).getTime(), revision + 1);
    if (!('updateScope' in input)) {
      assert.equal(saved.websiteUrl, full.websiteUrl); assert.equal(saved.bookingUrl, full.bookingUrl);
      assert.equal(saved.bookingMode, 'PAUSED'); assert.equal(saved.bookingHandoffEnabled, false);
      assert.equal(saved.bookingRequestEnabled, false); assert.equal(saved.bookingBannerEnabled, false);
    }
  }
});

test('settings compatibility keeps nullable legacy identity, denies changing singleton context and handles creation races', async () => {
  const f = fixture(); f.state.tenant = false; f.state.companies = [{ id: 'b' }]; f.state.owner = null;
  assert.equal((await f.route.PATCH(request(full))).status, 200);
  assert.equal(f.state.owner, null, 'legacy ownership is not silently reassigned');
  const writes = f.state.writes;
  f.state.beforeWrite = () => { f.state.companies.push({ id: 'a' }); };
  assert.equal((await f.route.PATCH(request(full))).status, 500);
  assert.equal(f.state.writes, writes);
  const mode = fixture(); mode.state.companies = [{ id: 'b' }];
  mode.state.beforeWrite = () => { mode.state.tenant = false; };
  assert.equal((await mode.route.PATCH(request(full))).status, 409); assert.equal(mode.state.writes, 0);
  for (const tenant of [true, false]) {
    const create = fixture(); create.state.tenant = tenant; create.state.companies = [{ id: 'b' }]; create.state.exists = false;
    assert.equal((await create.route.PATCH(request(full))).status, 200); assert.equal(create.state.writes, 1);
    const race = fixture(); race.state.exists = false;
    race.state.beforeWrite = () => { race.state.exists = true; };
    assert.equal((await race.route.PATCH(request(full))).status, 409); assert.equal(race.state.writes, 0);
  }
});

test('malformed settings payloads and local non-administrators never reach a write', async () => {
  const f = fixture();
  for (const input of [null, [], 'bad', { updateScope: 'unknown' }, { ...full, bookingMode: 'unknown' },
    { ...full, bookingEstimatedRestoreAt: 'invalid' }, { ...scopes[1], navigation: [null] },
    { ...scopes[2], standardPrinciples: [null] }]) {
    assert.equal((await f.route.PATCH(request(input))).status, 400);
  }
  assert.equal((await f.route.PATCH(new Request('https://example.test', { method: 'PATCH', body: '{' }))).status, 400);
  for (const session of [null, { userId: 'operator', workspaceId: 'b', sessionVersion: 7, role: 'EDITOR' }]) {
    f.state.session = session; assert.equal((await f.route.PATCH(request(full))).status, 403);
  }
  assert.equal(f.state.writes, 0); assert.equal(f.state.locks, 0);
});

test('actual settings route executes locked authorization and scoped CAS with isolated SQL rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
      CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "sessionVersion" INT, active BOOLEAN, role TEXT);
      CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY, "workspaceId" TEXT, "userId" TEXT, status TEXT, role TEXT);
      CREATE TABLE settings (id TEXT PRIMARY KEY, "workspaceId" TEXT UNIQUE, "updatedAt" TIMESTAMPTZ, payload JSONB);
      INSERT INTO "Workspace" VALUES ('a'), ('b');
      INSERT INTO "AdminUser" VALUES ('operator','b',7,true,'ADMIN');
      INSERT INTO "WorkspaceMembership" VALUES ('membership','b','operator','ACTIVE','ADMIN');
      INSERT INTO settings VALUES ('workspace:b','b','2026-01-01T00:00:00Z','{"businessName":"Before"}'),
        ('workspace:a','a','2026-01-01T00:00:00Z','{"businessName":"Foreign"}');`);
    const f = fixture();
    type SQL = { query: PGlite['query'] };
    const clauses = (where: Record<string, unknown>, values: unknown[]): string => Object.entries(where).map(([key, value]) => {
      if (key === 'AND' || key === 'OR') return `(${(value as Record<string, unknown>[]).map(item => clauses(item, values)).join(` ${key} `)})`;
      assert.ok(['id', 'workspaceId', 'updatedAt'].includes(key));
      values.push(value instanceof Date ? value.toISOString() : value);
      return `"${key}" IS NOT DISTINCT FROM $${values.length}${key === 'updatedAt' ? '::timestamptz' : '::text'}`;
    }).join(' AND ');
    let failReadback = false;
    const delegate = (sql: SQL, inTransaction = false) => ({
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        if (inTransaction && failReadback) throw new Error('Synthetic readback failure with private diagnostic');
        const values: unknown[] = [];
        const clause = clauses(where, values);
        const row = (await sql.query<{ id: string; workspaceId: string; updatedAt: Date; payload: Record<string, unknown> }>(`SELECT * FROM settings WHERE ${clause}`, values)).rows[0];
        return row ? { ...row.payload, id: row.id, workspaceId: row.workspaceId, updatedAt: row.updatedAt } : null;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const { updatedAt, ...payload } = data;
        const values: unknown[] = [JSON.stringify(payload), (updatedAt as Date).toISOString()];
        const clause = clauses(where, values);
        const result = await sql.query(`UPDATE settings SET payload=payload || $1::jsonb, "updatedAt"=$2::timestamptz WHERE ${clause}`, values);
        return { count: result.affectedRows ?? 0 };
      },
    });
    // Narrow adapters execute the real route and authorization SQL, not generated Prisma.
    Object.assign(f.prisma.siteSettings, delegate(db));
    let beforeTransaction = async () => {};
    f.prisma.$transaction = async fn => {
      await beforeTransaction();
      return db.transaction(async sql => fn({ ...f.prisma,
        siteSettings: { ...f.prisma.siteSettings, ...delegate(sql, true) },
        workspace: { findMany: async () => (await sql.query<{ id: string }>('SELECT id FROM "Workspace" LIMIT 2')).rows },
        $queryRaw: async (strings?: TemplateStringsArray, ...values: unknown[]) => {
          assert.ok(strings);
          await sql.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values);
          return [];
        },
        adminUser: { findFirst: async () => (await sql.query<{ id: string; workspaceId: string; role: string; active: boolean; sessionVersion: number }>('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2', ['operator', 'b'])).rows[0] },
        workspaceMembership: { findUnique: async () => (await sql.query<{ userId: string; workspaceId: string; role: string; status: string }>('SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2', ['operator', 'b'])).rows[0] },
      }));
    };
    const snapshot = async () => (await db.query('SELECT * FROM settings ORDER BY id')).rows;
    const initial = await snapshot();
    failReadback = true;
    assert.equal((await f.route.PATCH(request(full))).status, 500);
    assert.deepEqual(await snapshot(), initial, 'write is rolled back when its authoritative readback fails');
    assert.equal(f.state.invalidations, 0);
    failReadback = false;
    for (const input of scopes) assert.equal((await f.route.PATCH(request(input))).status, 200);
    assert.deepEqual((await snapshot())[0], initial[0], 'other company remains byte-for-byte unchanged');
    const saved = await f.prisma.siteSettings.findUnique({ where: { workspaceId: 'b' } });
    assert.equal(saved?.websiteUrl, full.websiteUrl); assert.equal(saved?.bookingHandoffEnabled, false);
    beforeTransaction = async () => { await db.query('UPDATE settings SET "updatedAt"="updatedAt" + interval \'1 millisecond\' WHERE "workspaceId"=$1', ['b']); };
    assert.equal((await f.route.PATCH(request(scopes[1]))).status, 409);
    beforeTransaction = async () => { await db.query('UPDATE "WorkspaceMembership" SET role=$1 WHERE "workspaceId"=$2', ['EDITOR', 'b']); };
    assert.equal((await f.route.PATCH(request(scopes[2]))).status, 403);
    beforeTransaction = async () => { await db.query('UPDATE "WorkspaceMembership" SET role=$1,status=$2 WHERE "workspaceId"=$3', ['ADMIN', 'REVOKED', 'b']); };
    assert.equal((await f.route.PATCH(request(full))).status, 403);
    assert.deepEqual((await snapshot())[0], initial[0]);
  } finally { await db.close(); }
});
