import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual routes/helpers, explicit Prisma-shaped SQL adapter over isolated PGlite. */
export async function fixture() {
 const db = new PGlite(); const controls = { failId: '', cacheFailure: false, transferAtAdmission: false, locks: [] as string[], signed: 0, deleted: 0, heads: 0 };
 await db.exec(`
 CREATE TABLE "Workspace" (id text PRIMARY KEY);
 CREATE TABLE "AdminUser" (id text PRIMARY KEY, "workspaceId" text, "sessionVersion" int, active boolean, role text, "homepageCurationPreferences" jsonb);
 CREATE TABLE "Project" (id text PRIMARY KEY, "workspaceId" text REFERENCES "Workspace", status text);
 CREATE TABLE "Service" (id text PRIMARY KEY, "workspaceId" text REFERENCES "Workspace", active boolean DEFAULT true, slug text DEFAULT 'service');
 CREATE TABLE "Media" (id text PRIMARY KEY, "projectId" text REFERENCES "Project");
 CREATE TABLE "HomepageProject" (id text PRIMARY KEY, "projectId" text UNIQUE REFERENCES "Project", "titleOverride" text, active boolean DEFAULT true, "displayOrder" int DEFAULT 0, "updatedAt" timestamptz DEFAULT now(), "createdAt" timestamptz DEFAULT now());
 CREATE TABLE "HomepageWorkCard" (id text PRIMARY KEY, "serviceId" text UNIQUE REFERENCES "Service", "featuredMediaId" text, "titleOverride" text, "destinationOverride" text, "imageStorageKey" text, "imageUrl" text, "imageAlt" text, "videoStorageKey" text, "videoUrl" text, active boolean DEFAULT true, "mediaMode" text DEFAULT 'IMAGE', "displayOrder" int DEFAULT 0, "updatedAt" timestamptz DEFAULT now(), "createdAt" timestamptz DEFAULT now());
 CREATE TABLE "WorkspaceAsset" (id text PRIMARY KEY, "workspaceId" text REFERENCES "Workspace", provider text, "providerNamespace" text, "providerKey" text UNIQUE, status text DEFAULT 'UPLOAD_PENDING', provenance jsonb);
 INSERT INTO "Workspace" VALUES ('a'),('b');
 INSERT INTO "AdminUser" VALUES ('u','a',1,true,'EDITOR',null);
 INSERT INTO "Project" VALUES ('pa','a','PUBLISHED'),('pa2','a','PUBLISHED'),('pb','b','PUBLISHED');
 INSERT INTO "Service" (id,"workspaceId") VALUES ('sa','a'),('sa2','a'),('sb','b');
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
    findMany: rows, findFirst: async (args:any) => {const row=(await rows(args))[0];return row?{...row,service:{slug:'service'}}:null;}, count: async (args: any) => (await rows(args)).length,
    findFirstOrThrow: async (args: any) => { const row = (await rows(args))[0]; if (!row) throw new Error('MISSING'); return { ...row, service: {id:row.serviceId,slug:'service',name:'Service',active:true}, project: { id: row.projectId, title: 'Project', slug: 'project', status: 'PUBLISHED', locationLabel: null, heroMedia: null } }; },
    updateMany: async (args: any) => {
     if (args.where.id === controls.failId) throw new Error('Injected update failure');
     const fields = Object.keys(args.data); assert.ok(fields.every(key => ['updatedAt','displayOrder','titleOverride','active','serviceId','destinationOverride','imageStorageKey','imageUrl','imageAlt','mediaMode','featuredMediaId','videoStorageKey','videoUrl'].includes(key)));
     const values = fields.map(key => args.data[key]);
     const result = await sql.query(`UPDATE "${table}" h SET ${fields.map((key,i) => `"${key}"=$${i+1}`).join(',')} FROM "${parent}" p WHERE p.id=h."${field}" AND p."workspaceId"=$${values.length+1} AND h.id=$${values.length+2} RETURNING h.id`, [...values,args.where[relation].workspaceId,args.where.id]); return { count: result.rows.length };
    },
    create: async ({ data }: any) => { const result = await sql.query(`INSERT INTO "${table}" (id,"${field}","displayOrder","updatedAt") VALUES ($1,$2,$3,$4) RETURNING *`, [randomUUID(), data[field], data.displayOrder, data.updatedAt]); return result.rows[0]; },
    deleteMany: async (args: any) => { const result = await sql.query(`DELETE FROM "${table}" h USING "${parent}" p WHERE p.id=h."${field}" AND p."workspaceId"=$1 AND h.id=$2 RETURNING h.id`, [args.where[relation].workspaceId,args.where.id]); return { count: result.rows.length }; },
   };
  }
  return { ...models,
   $queryRaw: async (parts: TemplateStringsArray, ...values: any[]) => {
    const query=parts.reduce((result, part, i) => result + (i ? '$' + i : '') + part, '');
    controls.locks.push(query);
    if(controls.transferAtAdmission && query.includes('FROM "AdminUser"')) { controls.transferAtAdmission=false; await sql.query('UPDATE "Project" SET "workspaceId"=$1 WHERE id=$2',['b','pa']); }
    return (await sql.query(query, values)).rows;
   },
   adminUser: { findFirst: async ({ where }: any) => (await sql.query('SELECT * FROM "AdminUser" WHERE id=$1 AND "workspaceId"=$2',[where.id,where.workspaceId])).rows[0], updateMany:async({where,data}:any)=>({count:(await sql.query('UPDATE "AdminUser" SET "homepageCurationPreferences"=$1::jsonb WHERE id=$2 AND "workspaceId"=$3 RETURNING id',[JSON.stringify(data.homepageCurationPreferences),where.id,where.workspaceId])).rows.length}) },
   service:{findFirst:async({where}:any)=>(await sql.query('SELECT * FROM "Service" WHERE id=$1 AND "workspaceId"=$2 AND active=true',[where.id,where.workspaceId])).rows[0]},
   workspaceAsset:{
    findUnique:async({where}:any)=>{const x=where.provider_providerNamespace_providerKey;return(await sql.query('SELECT * FROM "WorkspaceAsset" WHERE provider=$1 AND "providerNamespace"=$2 AND "providerKey"=$3',[x.provider,x.providerNamespace,x.providerKey])).rows[0]??null;},
    create:async({data}:any)=>{const id=randomUUID();return(await sql.query('INSERT INTO "WorkspaceAsset" (id,"workspaceId",provider,"providerNamespace","providerKey",provenance) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id',[id,data.workspaceId,data.provider,data.providerNamespace,data.providerKey,JSON.stringify(data.provenance)])).rows[0];},
    updateMany:async({where,data}:any)=>({count:(await sql.query('UPDATE "WorkspaceAsset" SET status=$1 WHERE id=$2 AND "workspaceId"=$3 AND status=$4 RETURNING id',[data.status,where.id,where.workspaceId,where.status])).rows.length}),
   },
   project: { findFirst: async ({ where }: any) => (await sql.query('SELECT * FROM "Project" WHERE id=$1 AND "workspaceId"=$2 AND status=$3',[where.id,where.workspaceId,where.status])).rows[0] },
  };
 }
 const prisma = { ...adapter(db), $transaction: async (fn: any) => db.transaction(sql => fn(adapter(sql))) };
 const dependencies: Record<string, any> = { 'server-only':{}, '@/lib/r2':{r2Config:{accountId:'test',bucketName:'test'}}, '@/lib/r2-upload':{getPublicAssetUrl:(key:string)=>'https://assets.test/'+key,createHomepageWorkCardKey:()=> 'image-'+randomUUID()+'.webp',createPresignedUploadUrl:async()=>{controls.signed++;return 'https://upload.test/object';}}, 'next/server': { NextResponse: Response }, 'next/cache': { revalidatePath() { if (controls.cacheFailure) throw new Error('Injected cache failure'); } }, 'node:crypto': { createHash, randomUUID }, '@/lib/prisma': { prisma }, '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'u', workspaceId: 'a', role: 'EDITOR', sessionVersion: 1 }) }, '@/lib/content-image-storage': { verifyContentImage() {controls.heads++;},deleteContentImage(){controls.deleted++;} } };
 function version(overrides:Record<string,string>={}) {
 const modules={...dependencies};
 function load(path: string): any { const exports = {}; runInNewContext(ts.transpileModule(readFileSync(overrides[path]??path,'utf8'),{ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,{ exports, Date, URL, Error, process: { env: {} }, console: { error() {} }, require(id: string) { if (id in modules) return modules[id]; const path = id.startsWith('@/') ? id.slice(2) + '.ts' : 'lib/' + id.slice(2); return modules[id] = load(path); } }); return exports; }
 return load;
 }
 const load=version();
 const helper = load('lib/homepage-curation-write.ts');
 const projects = load('app/api/admin/homepage-projects/route.ts'), cards = load('app/api/admin/homepage-work-cards/route.ts');
 const revision = async (scope = 'projects') => (await helper.curationSnapshot(prisma,'a',scope)).revision;
 const call = (route: any, method: string, body: any, revision?: string) => route[method](new Request('http://localhost/api', { method, headers: revision ? { 'x-curation-revision': revision,'x-curation-request':'request' } : {}, body: JSON.stringify(body) }));
 return { db, controls, projects, cards, revision, call, version, prisma, load };
}
