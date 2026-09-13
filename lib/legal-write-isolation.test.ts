import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { sanitizeLegalHtml } from './legal-html.ts';

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Date, process: { env: { NODE_ENV: 'test' } }, console: { error() {}, warn() {} },
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency ${id}`); return modules[id]; } });
  return exports as T;
}
type Route = { PATCH(request: Request): Promise<Response> };
const input = { type: 'PRIVACY_POLICY', title: 'Reviewed privacy', content: '<p>Existing reviewed text</p>', published: false };
const request = (body: unknown = input) => new Request('https://foreign.example/api/admin/legal-documents?workspaceId=a', {
  method: 'PATCH', headers: { 'content-type': 'application/json', 'x-workspace-id': 'a' }, body: JSON.stringify(body),
});

test('legal editing rejects membership revoked after initial session verification', async () => {
  let writes = 0;
  const modules = {
    'next/cache': { revalidatePath() {} }, 'next/server': { NextResponse: Response },
    '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'operator', workspaceId: 'b', role: 'ADMIN', sessionVersion: 1 }) },
    '@/lib/site-settings-ownership': { getSiteSettingsWriteTarget: async () => ({ where: { workspaceId: 'b' }, createIdentity: { id: 'workspace:b', workspaceId: 'b' } }) },
    '@/lib/blog-ownership': { getContentOwnershipScope: async () => ({ workspaceId: 'b' }) },
    '@/lib/legal-html': { sanitizeLegalHtml: (value: string) => value },
    '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async () => { throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/prisma': { prisma: {
      legalDocument: { findFirst: async () => null, upsert: async () => { writes++; return {}; } },
      siteSettings: { findUnique: async () => null, upsert: async () => { writes++; return {}; } },
      $transaction: async (operations: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) => Array.isArray(operations) ? Promise.all(operations) : operations({}),
    } },
  };
  const route = load<Route>('../app/api/admin/legal-documents/route.ts', modules);
  assert.equal((await route.PATCH(request())).status, 403);
  assert.equal(writes, 0);
});

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
async function database() {
  // Prisma timestamps are modeled as UTC in this narrow adapter. Do not let
  // the runner's local timezone reinterpret PostgreSQL timestamp-without-zone.
  const db = new PGlite({ parsers: { 1114: (value: string) => new Date(value.replace(' ', 'T') + 'Z') } });
  await db.exec(`SET TIME ZONE 'UTC';
    CREATE TABLE "Workspace" (id TEXT PRIMARY KEY);
    CREATE TABLE "AdminUser" (id TEXT PRIMARY KEY,"workspaceId" TEXT,"sessionVersion" INT,active BOOLEAN,role TEXT);
    CREATE TABLE "WorkspaceMembership" (id TEXT PRIMARY KEY,"workspaceId" TEXT,"userId" TEXT,status TEXT,role TEXT);
    CREATE TABLE "SiteSettings" (id TEXT PRIMARY KEY,"workspaceId" TEXT UNIQUE,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO "Workspace" VALUES ('a'),('b');
    INSERT INTO "AdminUser" VALUES ('operator-a','a',7,true,'ADMIN'),('operator-b','b',7,true,'ADMIN');
    INSERT INTO "WorkspaceMembership" VALUES ('member-a','a','operator-a','ACTIVE','ADMIN'),('member-b','b','operator-b','ACTIVE','ADMIN');
    INSERT INTO "SiteSettings" (id,"workspaceId") VALUES ('workspace:a','a'),('workspace:b','b');`);
  await db.exec(read('../prisma/migrations/20260719120000_add_legal_documents/migration.sql'));
  await db.exec(read('../prisma/migrations/20260911190000_legal_workspace_expand/migration.sql'));
  await db.exec(read('../prisma/migrations/20260913033000_legal_scoped_identity_expand/migration.sql'));
  return db;
}
const backfill = read('../scripts/migrations/backfill-legal-ownership.sql');
const contract = read('../scripts/migrations/contract-legal-ownership.sql');
const restoreGuard = read('../scripts/migrations/reinstate-legal-type-guard.sql');
async function rejectedScript(db: PGlite, script: string, message: RegExp) {
  await assert.rejects(db.exec(script), message);
  await db.exec('ROLLBACK');
}
async function mapLegal(db: PGlite) {
  await db.exec(`CREATE TEMP TABLE "LegalOwnershipMapping" (id TEXT PRIMARY KEY,"workspaceId" TEXT NOT NULL);
    INSERT INTO "LegalOwnershipMapping" SELECT id,'a' FROM "LegalDocument";`);
  await db.exec(backfill);
}
async function approveCutover(db: PGlite) {
  await db.exec(`CREATE TEMP TABLE "LegalCutoverApproval" ("reviewedHead" TEXT,"retiredLegacyReaders" BOOLEAN,"retiredLegacyWriters" BOOLEAN,"backupVerified" BOOLEAN,"tenantContextVerified" BOOLEAN);
    INSERT INTO "LegalCutoverApproval" VALUES ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',true,true,true,true);`);
}

test('legal expansion preserves old writes; explicit mapping and cutover fail closed without changing copy', async () => {
  const db = await database();
  try {
    await db.exec(`UPDATE "LegalDocument" SET content='Original reviewed copy',published=true WHERE type='PRIVACY_POLICY';
      INSERT INTO "LegalDocument" (id,type,title,content,published,"updatedAt") VALUES ('old-writer','PRIVACY_POLICY','Ignored','Ignored',false,CURRENT_TIMESTAMP)
      ON CONFLICT(type) DO UPDATE SET title='Legacy edited title';`);
    const snapshot = async () => (await db.query('SELECT id,type,title,content,published,"createdAt","updatedAt" FROM "LegalDocument" ORDER BY id')).rows;
    const original = await snapshot();
    await rejectedScript(db, backfill, /mapping is required/);
    await db.exec(`CREATE TEMP TABLE "LegalOwnershipMapping" (id TEXT,"workspaceId" TEXT);
      INSERT INTO "LegalOwnershipMapping" VALUES ('legal-privacy-policy','a');`);
    await rejectedScript(db, backfill, /Incomplete/);
    assert.equal((await db.query<{ count: number }>('SELECT count(*) FROM "LegalDocument" WHERE "workspaceId" IS NULL')).rows[0].count, 2);
    await db.exec(`INSERT INTO "LegalOwnershipMapping" VALUES ('legal-terms-of-service','missing');`);
    await rejectedScript(db, backfill, /Invalid/);
    await db.exec(`UPDATE "LegalOwnershipMapping" SET "workspaceId"='a';`);
    await db.exec(backfill);
    assert.deepEqual(await snapshot(), original);
    await db.exec(`UPDATE "LegalOwnershipMapping" SET "workspaceId"='b';`);
    await rejectedScript(db, backfill, /Invalid/);
    await db.exec(`INSERT INTO "LegalOwnershipMapping" VALUES ('legal-privacy-policy','b');`);
    await rejectedScript(db, backfill, /Invalid/);
    await rejectedScript(db, contract, /approval is required/);
    await approveCutover(db);
    await db.exec('UPDATE "LegalCutoverApproval" SET "retiredLegacyReaders"=false');
    await rejectedScript(db, contract, /evidence is incomplete/);
    await db.exec('UPDATE "LegalCutoverApproval" SET "retiredLegacyReaders"=true');
    await rejectedScript(db,contract,/publication flags must reconcile/);
    await db.exec('UPDATE "SiteSettings" SET "privacyPolicyPublished"=true WHERE "workspaceId"=\'a\'');
    await db.exec(contract);
    assert.deepEqual(await snapshot(), original);
    await assert.rejects(db.exec(`UPDATE "LegalDocument" SET content='Unscoped overwrite' WHERE type='PRIVACY_POLICY'`), /Scoped legal writer/);
    await assert.rejects(db.exec(`DELETE FROM "LegalDocument" WHERE type='PRIVACY_POLICY'`), /Scoped legal writer/);
    await db.exec(restoreGuard);
    assert.deepEqual(await snapshot(), original, 'forward guard restoration preserves every document');
    await assert.rejects(db.exec(`UPDATE "LegalDocument" SET content='Old application'`), /Scoped legal writer/, 'restoring uniqueness does not reopen old writes');
  } finally { await db.close(); }
});

test('legal expansion rolls back without losing rows before the contract cutover', async () => {
  const db = await database();
  try {
    const original = (await db.query('SELECT * FROM "LegalDocument" ORDER BY id')).rows;
    await db.exec(`BEGIN;
      DROP INDEX "LegalDocument_workspaceId_type_key";
      ALTER INDEX "LegalDocument_legacy_type_guard" RENAME TO "LegalDocument_type_key";
      COMMIT;`);
    assert.deepEqual((await db.query('SELECT * FROM "LegalDocument" ORDER BY id')).rows,original);
    await db.exec(`INSERT INTO "LegalDocument" (id,type,title,content,published,"updatedAt") VALUES ('old','PRIVACY_POLICY','Old writer','Reviewed copy',false,CURRENT_TIMESTAMP)
      ON CONFLICT(type) DO UPDATE SET title=excluded.title;`);
    assert.equal((await db.query<{ title: string }>('SELECT title FROM "LegalDocument" WHERE type=\'PRIVACY_POLICY\'')).rows[0].title,'Old writer');
    await db.exec(read('../prisma/migrations/20260913033000_legal_scoped_identity_expand/migration.sql'));
    assert.equal((await db.query<{ count: number }>('SELECT count(*) FROM "LegalDocument"')).rows[0].count,2);
  } finally { await db.close(); }
});

function routeFixture(db: PGlite) {
  const state = { company: 'b', role: 'ADMIN', tenant: true, session: true, failSettings: false, failReadback: false,
    beforeTransaction: async () => {}, invalidations: 0 };
  type SQL = { query: PGlite['query'] };
  type Row = Record<string, unknown> & { id: string; updatedAt: Date };
  const clause = (where: Record<string, unknown>, values: unknown[]): string => Object.entries(where).map(([key, value]) => {
    if (key === 'AND' || key === 'OR') return `(${(value as Record<string, unknown>[]).map(item => clause(item, values)).join(` ${key} `)})`;
    assert.ok(['id','type','workspaceId','updatedAt','published'].includes(key));
    values.push(value instanceof Date ? value.toISOString() : value);
    return `"${key}" IS NOT DISTINCT FROM $${values.length}${key === 'updatedAt' ? '::timestamp' : key === 'type' ? '::"LegalDocumentType"' : key === 'published' ? '::boolean' : '::text'}`;
  }).join(' AND ');
  const select = (row: Row | undefined, fields?: Record<string, boolean>) => row ? fields ? Object.fromEntries(Object.keys(fields).map(key => [key,row[key]])) : row : null;
  let ids = 0;
  const delegate = (sql: SQL, table: 'LegalDocument' | 'SiteSettings', inTransaction = false) => ({
    findMany: async ({ where, select: fields }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const values: unknown[] = []; const predicate = clause(where,values);
      return (await sql.query<Row>(`SELECT * FROM "${table}" WHERE ${predicate}`,values)).rows.map(row=>select(row,fields));
    },
    findFirst: async ({ where, select: fields }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
      if (state.failReadback && inTransaction && table === 'LegalDocument') throw new Error('Synthetic readback failure');
      const values: unknown[] = []; const predicate = clause(where,values);
      const rows = (await sql.query<Row>(`SELECT * FROM "${table}" WHERE ${predicate}`, values)).rows;
      return select(rows[0],fields);
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (state.failSettings && table === 'SiteSettings') throw new Error('Synthetic settings failure');
      const values: unknown[] = [];
      const assignments = Object.entries(data).map(([key,value]) => {
        assert.ok(['title','content','published','updatedAt','privacyPolicyPublished','termsOfServicePublished'].includes(key));
        values.push(value instanceof Date ? value.toISOString() : value); return `"${key}"=$${values.length}`;
      });
      const predicate = clause(where,values);
      const count = (await sql.query(`UPDATE "${table}" SET ${assignments.join(',')} WHERE ${predicate}`,values)).affectedRows ?? 0;
      return { count };
    },
    create: async ({ data, select: fields }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      if (state.failSettings && table === 'SiteSettings') throw new Error('Synthetic settings creation failure');
      const row = { id: `new-${++ids}`, updatedAt: new Date(), ...data };
      const keys = Object.keys(row);
      assert.ok(keys.every(key => ['id','updatedAt','workspaceId','type','title','content','published','privacyPolicyPublished','termsOfServicePublished'].includes(key)));
      try {
        const saved = (await sql.query<Row>(`INSERT INTO "${table}" (${keys.map(key=>`"${key}"`).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`, Object.values(row).map(value=>value instanceof Date?value.toISOString():value))).rows[0];
        return select(saved,fields);
      } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === '23505') throw Object.assign(new Error('Synthetic Prisma duplicate'), { code: 'P2002' });
        throw error;
      }
    },
  });
  const client = (sql: SQL, tx = false) => {
    const legal = delegate(sql,'LegalDocument',tx); const settings = delegate(sql,'SiteSettings',tx);
    return { legalDocument: legal, siteSettings: { ...settings, findUnique: settings.findFirst },
      workspace: { findMany: async () => (await sql.query('SELECT id FROM "Workspace" LIMIT 2')).rows },
      adminUser: { findFirst: async () => (await sql.query('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2', [`operator-${state.company}`,state.company])).rows[0] },
      workspaceMembership: { findUnique: async () => (await sql.query('SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2', [`operator-${state.company}`,state.company])).rows[0] },
      $queryRaw: async (strings: TemplateStringsArray,...values: unknown[]) => (await sql.query(strings.reduce((s,part,i)=>s+(i?`$${i}`:'')+part,''),values)).rows };
  };
  const prisma = { ...client(db), $transaction: async (fn: (tx: unknown)=>Promise<unknown>) => {
    await state.beforeTransaction(); return db.transaction(sql=>fn(client(sql,true)));
  } };
  const modules: Record<string, unknown> = {
    'server-only': {}, 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() { state.invalidations++; } },
    '@/lib/prisma': { prisma }, '@/lib/auth/session': { getAdminSession: async () => state.session ? { userId: `operator-${state.company}`, workspaceId: state.company, role: state.role, sessionVersion: 7 } : null },
    '@/lib/workspace-context-core': { tenantContextEnabled: () => state.tenant },
    './workspace-context-core.ts': { tenantContextEnabled: () => state.tenant },
    './workspace-membership-core.ts': load('./workspace-membership-core.ts', {}),
    '@/lib/legal-html': { sanitizeLegalHtml },
    '@/lib/public-workspace': { getPublicWorkspaceId: async () => state.company },
  };
  modules['@/lib/site-settings-ownership'] = { getSiteSettingsWriteTarget: load<{ getWorkspaceSingletonTarget: unknown }>('./workspace-singleton.ts',modules).getWorkspaceSingletonTarget };
  modules['@/lib/blog-ownership'] = load('./blog-ownership.ts',modules);
  modules['@/lib/workspace-write-access'] = load('./workspace-write-access.ts',modules);
  return { state, route: load<Route>('../app/api/admin/legal-documents/route.ts',modules), readers: load<{
    getLegalDocuments(workspaceId: string): Promise<Record<string, unknown>[]>;
    getPublishedLegalDocument(type: string): Promise<Record<string, unknown> | null>;
  }>('./legal-documents.ts',modules) };
}

test('legal route isolates same-type documents, fences old writes and rolls document/settings back atomically', async () => {
  const db = await database();
  try {
    await mapLegal(db);
    const f = routeFixture(db);
    assert.equal((await f.route.PATCH(request())).status, 409, 'global compatibility guard still prevents a second type');
    await approveCutover(db); await db.exec(contract);
    const originalA = (await db.query('SELECT * FROM "LegalDocument" WHERE "workspaceId"=$1 ORDER BY id',['a'])).rows;
    const response = await f.route.PATCH(request({ ...input, workspaceId: 'a', content: '<p>Own reviewed draft</p><script>unsafe()</script>' }));
    assert.equal(response.status,200);
    const acknowledgement = await response.json();
    assert.equal(acknowledgement.revisionProtocol, 1);
    const document = acknowledgement.document;
    assert.equal(document.content,'<p>Own reviewed draft</p>'); assert.equal(Object.keys(document).length,6);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("SELECT set_config('helios.legal_workspace','b',true)");
      await tx.query(`INSERT INTO "LegalDocument" (id,"workspaceId",type,title,content,published,"updatedAt") VALUES ('duplicate','b','PRIVACY_POLICY','Duplicate','',false,CURRENT_TIMESTAMP)`);
    }),/LegalDocument_workspaceId_type_key/,'one type per company remains unique after cutover');
    assert.deepEqual((await db.query('SELECT * FROM "LegalDocument" WHERE "workspaceId"=$1 ORDER BY id',['a'])).rows,originalA);
    const snapshot = async () => (await db.query('SELECT * FROM "LegalDocument" ORDER BY id')).rows;
    const before = await snapshot();
    f.state.failSettings = true;
    assert.equal((await f.route.PATCH(request({ ...input, title: 'Must roll back' }))).status,500);
    assert.deepEqual(await snapshot(),before);
    f.state.failSettings = false; f.state.failReadback = true;
    assert.equal((await f.route.PATCH(request({ ...input, title: 'Readback rollback' }))).status,500);
    assert.deepEqual(await snapshot(),before); f.state.failReadback = false;
    const publishRequest = request({ ...input, content: `<p>${'Reviewed text '.repeat(12)}</p>`,published:true,updatedAt:document.updatedAt });
    publishRequest.headers.set('x-helios-legal-revision','1');
    const published = await f.route.PATCH(publishRequest);
    assert.equal(published.status,200);
    assert.equal((await db.query<{ privacyPolicyPublished: boolean }>('SELECT "privacyPolicyPublished" FROM "SiteSettings" WHERE "workspaceId"=$1',['b'])).rows[0].privacyPolicyPublished,true);
    const ownPublic = await f.readers.getPublishedLegalDocument('PRIVACY_POLICY');
    assert.equal(ownPublic?.id,document.id); assert.equal(Object.keys(ownPublic!).length,6);
    f.state.company='a';
    assert.equal(await f.readers.getPublishedLegalDocument('PRIVACY_POLICY'),null,'foreign publication does not supply a fallback');
    const adminA = await f.readers.getLegalDocuments('a');
    assert.ok(adminA.every(row=>row.id!==document.id && Object.keys(row).length===6));
    f.state.company='b';
    assert.equal((await f.route.PATCH(request({ ...input,updatedAt:document.updatedAt }))).status,409,'older open editor revision is rejected');
    await assert.rejects(db.exec(`UPDATE "LegalDocument" SET title='Old unscoped writer' WHERE type='PRIVACY_POLICY'`),/Scoped legal writer/);
    await rejectedScript(db,restoreGuard,/without losing tenant data/);
    assert.equal((await db.query<{ count: number }>('SELECT count(*) FROM "LegalDocument" WHERE type=\'PRIVACY_POLICY\'')).rows[0].count,2);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("SELECT set_config('helios.legal_workspace',$1,true)",['a']);
      await tx.query('UPDATE "LegalDocument" SET title=$1 WHERE id=$2',['Foreign marker',document.id]);
    }),/Scoped legal writer/);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("SELECT set_config('helios.legal_workspace',$1,true)",['a']);
      await tx.query('UPDATE "LegalDocument" SET "workspaceId"=$1 WHERE id=$2',['a',document.id]);
    }),/identity is immutable/);
    // Reconstructing a missing settings row must preserve the other published
    // document's footer flag, and a failed reconstruction must roll back create.
    await db.query('DELETE FROM "SiteSettings" WHERE "workspaceId"=$1',['b']);
    const beforeCreate = await snapshot();
    f.state.failSettings=true;
    assert.equal((await f.route.PATCH(request({ ...input,type:'TERMS_OF_SERVICE',updatedAt:new Date(0).toISOString() }))).status,500);
    assert.deepEqual(await snapshot(),beforeCreate);
    f.state.failSettings=false;
    assert.equal((await f.route.PATCH(request({ ...input,type:'TERMS_OF_SERVICE',updatedAt:new Date(0).toISOString() }))).status,200);
    const restoredFlags = (await db.query<{ privacyPolicyPublished: boolean; termsOfServicePublished: boolean }>('SELECT "privacyPolicyPublished","termsOfServicePublished" FROM "SiteSettings" WHERE "workspaceId"=$1',['b'])).rows[0];
    assert.deepEqual(restoredFlags,{privacyPolicyPublished:true,termsOfServicePublished:false});
  } finally { await db.close(); }
});

test('legal writes recheck database membership and both document/settings snapshots; malformed requests do not write', async () => {
  const db = await database();
  try {
    await mapLegal(db); await approveCutover(db); await db.exec(contract);
    const f = routeFixture(db); f.state.company = 'a';
    for (const [query, values] of [
      ['UPDATE "WorkspaceMembership" SET status=$1 WHERE "workspaceId"=\'a\'',['REVOKED']],
      ['UPDATE "WorkspaceMembership" SET role=$1 WHERE "workspaceId"=\'a\'',['EDITOR']],
      ['UPDATE "AdminUser" SET active=$1 WHERE "workspaceId"=\'a\'',[false]],
      ['UPDATE "AdminUser" SET "sessionVersion"=$1 WHERE "workspaceId"=\'a\'',[8]],
    ] as const) {
      f.state.beforeTransaction = async () => { await db.query(query,[...values]); };
      assert.equal((await f.route.PATCH(request())).status,403);
      await db.exec(`UPDATE "WorkspaceMembership" SET status='ACTIVE',role='ADMIN'; UPDATE "AdminUser" SET active=true,"sessionVersion"=7;`);
    }
    f.state.beforeTransaction = async () => {
      await db.transaction(async tx => {
        await tx.query("SELECT set_config('helios.legal_workspace','a',true)");
        await tx.query('UPDATE "LegalDocument" SET "updatedAt"="updatedAt" + interval \'1 millisecond\' WHERE "workspaceId"=\'a\'');
      });
    };
    assert.equal((await f.route.PATCH(request())).status,409);
    const original = (await db.query('SELECT title,content,published FROM "LegalDocument" ORDER BY id')).rows;
    f.state.beforeTransaction = async () => { await db.exec('UPDATE "SiteSettings" SET "updatedAt"="updatedAt" + interval \'1 millisecond\' WHERE "workspaceId"=\'a\''); };
    assert.equal((await f.route.PATCH(request())).status,409);
    assert.deepEqual((await db.query('SELECT title,content,published FROM "LegalDocument" ORDER BY id')).rows,original,'settings conflict rolls document update back');
    f.state.beforeTransaction = async () => {};
    for (const invalid of [null, [], { ...input,type:'unknown' },{ ...input,updatedAt:'invalid' },{ ...input,published:true,content:'short' }]) {
      assert.equal((await f.route.PATCH(request(invalid))).status,400);
    }
    for (const protocol of ['1','2']) {
      const invalidProtocol = request(); invalidProtocol.headers.set('x-helios-legal-revision',protocol);
      assert.equal((await f.route.PATCH(invalidProtocol)).status,400);
    }
    assert.equal(f.state.invalidations,0);
    f.state.role='EDITOR'; assert.equal((await f.route.PATCH(request())).status,403);
    f.state.session=false; assert.equal((await f.route.PATCH(request())).status,403);
    assert.deepEqual((await db.query('SELECT title,content,published FROM "LegalDocument" ORDER BY id')).rows,original);
  } finally { await db.close(); }
});
