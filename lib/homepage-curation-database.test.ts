import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual routes/helpers, explicit Prisma-shaped SQL adapter over isolated PGlite. */
async function fixture() {
 const db = new PGlite(); const controls = { failId: '', cacheFailure: false };
 await db.exec(`
 CREATE TABLE "Workspace" (id text PRIMARY KEY);
 CREATE TABLE "AdminUser" (id text PRIMARY KEY, "workspaceId" text, "sessionVersion" int, active boolean, role text);
 CREATE TABLE "Project" (id text PRIMARY KEY, "workspaceId" text REFERENCES "Workspace", status text);
 CREATE TABLE "Service" (id text PRIMARY KEY, "workspaceId" text REFERENCES "Workspace");
 CREATE TABLE "HomepageProject" (id text PRIMARY KEY, "projectId" text UNIQUE REFERENCES "Project", "titleOverride" text, active boolean DEFAULT true, "displayOrder" int DEFAULT 0, "updatedAt" timestamptz DEFAULT now(), "createdAt" timestamptz DEFAULT now());
 CREATE TABLE "HomepageWorkCard" (id text PRIMARY KEY, "serviceId" text UNIQUE REFERENCES "Service", "displayOrder" int DEFAULT 0, "updatedAt" timestamptz DEFAULT now(), "createdAt" timestamptz DEFAULT now());
 INSERT INTO "Workspace" VALUES ('a'),('b');
 INSERT INTO "AdminUser" VALUES ('u','a',1,true,'EDITOR');
 INSERT INTO "Project" VALUES ('pa','a','PUBLISHED'),('pa2','a','PUBLISHED'),('pb','b','PUBLISHED');
 INSERT INTO "Service" VALUES ('sa','a'),('sa2','a'),('sb','b');
 INSERT INTO "HomepageProject" (id,"projectId","titleOverride") VALUES ('p1','pa','Keep'),('foreign','pb','Private');
 INSERT INTO "HomepageWorkCard" (id,"serviceId","displayOrder") VALUES ('c1','sa',0),('c2','sa2',1),('foreign','sb',0);
 `);
 function adapter(sql: any): any {
  const models: Record<string, any> = {};
  for (const [delegate, table, parent, field, relation] of [['homepageProject','HomepageProject','Project','projectId','project'],['homepageWorkCard','HomepageWorkCard','Service','serviceId','service']]) {
   const rows = async (args: any) => {
    const workspaceId = args.where?.[relation]?.workspaceId; assert.ok(workspaceId, 'workspace predicate required');
    const result = await sql.query(`SELECT h.* FROM "${table}" h JOIN "${parent}" p ON p.id=h."${field}" WHERE p."workspaceId"=$1 ${args.where.id ? 'AND h.id=$2' : ''} ORDER BY h."displayOrder",h."createdAt",h.id`, args.where.id ? [workspaceId,args.where.id] : [workspaceId]); return result.rows;
   };
   models[delegate] = {
    findMany: rows, count: async (args: any) => (await rows(args)).length,
    findFirstOrThrow: async (args: any) => { const row = (await rows(args))[0]; if (!row) throw new Error('MISSING'); return { ...row, project: { id: row.projectId, title: 'Project', slug: 'project', status: 'PUBLISHED', locationLabel: null, heroMedia: null } }; },
    updateMany: async (args: any) => {
     if (args.where.id === controls.failId) throw new Error('Injected update failure');
     const fields = Object.keys(args.data); assert.ok(fields.every(key => ['updatedAt','displayOrder','titleOverride','active'].includes(key)));
     const values = fields.map(key => args.data[key]);
     const result = await sql.query(`UPDATE "${table}" h SET ${fields.map((key,i) => `"${key}"=$${i+1}`).join(',')} FROM "${parent}" p WHERE p.id=h."${field}" AND p."workspaceId"=$${values.length+1} AND h.id=$${values.length+2} RETURNING h.id`, [...values,args.where[relation].workspaceId,args.where.id]); return { count: result.rows.length };
    },
    create: async ({ data }: any) => { const result = await sql.query(`INSERT INTO "${table}" (id,"${field}","displayOrder","updatedAt") VALUES ($1,$2,$3,$4) RETURNING *`, [randomUUID(), data[field], data.displayOrder, data.updatedAt]); return result.rows[0]; },
    deleteMany: async (args: any) => { const result = await sql.query(`DELETE FROM "${table}" h USING "${parent}" p WHERE p.id=h."${field}" AND p."workspaceId"=$1 AND h.id=$2 RETURNING h.id`, [args.where[relation].workspaceId,args.where.id]); return { count: result.rows.length }; },
   };
  }
  return { ...models,
   $queryRaw: async (parts: TemplateStringsArray, ...values: any[]) => (await sql.query(parts.reduce((result, part, i) => result + (i ? '$' + i : '') + part, ''), values)).rows,
   adminUser: { findFirst: async ({ where }: any) => (await sql.query('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2',[where.id,where.workspaceId])).rows[0] },
   project: { findFirst: async ({ where }: any) => (await sql.query('SELECT * FROM "Project" WHERE id=$1 AND "workspaceId"=$2 AND status=$3',[where.id,where.workspaceId,where.status])).rows[0] },
  };
 }
 const prisma = { ...adapter(db), $transaction: async (fn: any) => db.transaction(sql => fn(adapter(sql))) };
 const modules: Record<string, any> = { 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() { if (controls.cacheFailure) throw new Error('Injected cache failure'); } }, 'node:crypto': { createHash }, '@/lib/prisma': { prisma }, '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'u', workspaceId: 'a', role: 'EDITOR', sessionVersion: 1 }) }, '@/lib/content-image-storage': { verifyContentImage() {} } };
 function load(path: string): any { const exports = {}; runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,{ exports, Date, URL, Error, process: { env: {} }, console: { error() {} }, require(id: string) { if (id in modules) return modules[id]; const path = id.startsWith('@/') ? id.slice(2) + '.ts' : 'lib/' + id.slice(2); return modules[id] = load(path); } }); return exports; }
 const helper = load('lib/homepage-curation-write.ts'); modules['@/lib/homepage-curation-write'] = helper;
 const projects = load('app/api/admin/homepage-projects/route.ts'), cards = load('app/api/admin/homepage-work-cards/route.ts');
 const revision = async (scope = 'projects') => (await helper.curationSnapshot(prisma,'a',scope)).revision;
 const call = (route: any, method: string, body: any, revision?: string) => route[method](new Request('http://localhost/api', { method, headers: revision ? { 'x-curation-revision': revision,'x-curation-request':'request' } : {}, body: JSON.stringify(body) }));
 return { db, controls, projects, cards, revision, call };
}
test('curation actual route/database serializes stale writers and returns the committed revision', async () => {
 const f = await fixture(); try {
  const before = await f.revision(); const responses = await Promise.all(['First','Second'].map(titleOverride => f.call(f.projects,'PATCH',{ placementId:'p1',titleOverride }, before)));
  assert.deepEqual(responses.map(r => r.status), [200,409]); const data = await responses[0].json(); assert.equal(data.acknowledgement.revision,await f.revision()); assert.notEqual(data.acknowledgement.revision,before); assert.deepEqual(data.acknowledgement.ids,['p1']);
  const foreign = await f.call(f.projects,'PATCH',{ placementId:'foreign',titleOverride:'Leak' },await f.revision()); assert.equal(foreign.status,404); assert.equal((await f.db.query<any>('SELECT "titleOverride" FROM "HomepageProject" WHERE id=$1',['foreign'])).rows[0].titleOverride,'Private');
  await f.db.exec('UPDATE "AdminUser" SET active=false'); assert.equal((await f.call(f.projects,'PATCH',{ placementId:'p1',active:false },await f.revision())).status,403);
 } finally { await f.db.close(); }
});
test('curation actual route/database rejects stale reorder and rolls back partial positional writes', async () => {
 const f = await fixture(); try {
  const before = await f.revision('work-cards'); const response = await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c2','c1'] },before); assert.equal(response.status,200); assert.deepEqual((await response.json()).acknowledgement.ids,['c2','c1']);
  assert.equal((await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c1','c2'] },before)).status,409);
  const current = await f.revision('work-cards'); f.controls.failId='c2'; assert.equal((await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c1','c2'] },current)).status,500); assert.equal(await f.revision('work-cards'),current);
 } finally { await f.db.close(); }
});
test('curation actual route/database serializes legacy count admission and exposes postcommit uncertainty', async () => {
 const f = await fixture(); try {
  await f.db.exec('DELETE FROM "HomepageProject" WHERE id=\'p1\'');
  const responses = await Promise.all(['pa','pa2'].map(projectId => f.call(f.projects,'POST',{projectId}))); assert.deepEqual(responses.map(r => r.status),[201,409]);
  const id = (await responses[0].json()).placement.id; const before=await f.revision(); f.controls.cacheFailure=true;
  assert.equal((await f.call(f.projects,'PATCH',{placementId:id,titleOverride:'Committed'},before)).status,500); assert.notEqual(await f.revision(),before);
 } finally { await f.db.close(); }
});
