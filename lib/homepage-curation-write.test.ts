import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Execute actual routes with isolated database dependencies. */
function route(project = true) {
 let row: any = { id: 'p1', projectId: 'project1', titleOverride: 'Keep me', active: true, displayOrder: 0, updatedAt: new Date('2026-09-17'), createdAt: new Date('2026-09-17') };
 let writes = 0;
 const delegate = { findMany: async () => [row], updateMany: async ({ data }: any) => { writes++; row = { ...row, ...data }; return { count: 1 }; }, findFirstOrThrow: async () => row };
 const db: any = { $queryRaw: async () => [], homepageProject: delegate, homepageWorkCard: delegate, $transaction: async (fn: any) => typeof fn === 'function' ? fn(db) : Promise.all(fn) };
 const modules: Record<string, any> = { 'next/cache': { revalidatePath() {} }, '@/lib/work-card-media-server': { resolveWorkCardMedia() { throw new Error('Unexpected media resolution'); } }, 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma: db }, '@/lib/auth/session': { getAdminSession: async () => ({ userId: 'u', workspaceId: 'a', sessionVersion: 1, role: 'EDITOR' }) }, '@/lib/content-image-storage': { verifyContentImage() {}, deleteContentImage() {} }, '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => {} } };
 function load(path: string): any { const exports = {}; runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Request, Response, URL, Error, Date, console: { error() {} }, require(id: string) { if (id in modules) return modules[id]; if (id === 'node:crypto') return { createHash }; if (id.startsWith('@/lib/')) return modules[id] = load(id.slice(2) + '.ts'); throw new Error(id); } }); return exports; }
 const handlers = load(`app/api/admin/homepage-${project ? 'projects' : 'work-cards'}/route.ts`);
 return { patch: (body: any) => handlers.PATCH(new Request('http://localhost/api', { method: 'PATCH', headers: { 'x-curation-revision': body.editorRevision || load('lib/homepage-curation-write.ts').curationRevision('a',project?'projects':'work-cards',[row]), 'x-curation-request': body.requestId || 'request' }, body: JSON.stringify(body) })), row: () => row, writes: () => writes };
}
test('curation actual project route preserves title on active-only patch', async () => { const f = route(); const r = await f.patch({ placementId: 'p1', active: false }); assert.equal(r.status, 200); assert.equal(f.row().titleOverride, 'Keep me'); });
test('curation actual project route rejects an already stale editor revision', async () => { const f = route(); const r = await f.patch({ placementId: 'p1', titleOverride: 'Stale', editorRevision: 'stale', requestId: 'request', protocol: 1 }); assert.equal(r.status, 409); assert.equal(f.writes(), 0); });
test('curation actual reorder route rejects stale order with unchanged membership', async () => { const f = route(false); const r = await f.patch({ action: 'reorder', cardIds: ['p1'], editorRevision: 'stale', requestId: 'request', protocol: 1 }); assert.equal(r.status, 409); assert.equal(f.writes(), 0); });

test('curation reorder rejects a member transferred between membership read and positional write', async () => {
 const source=readFileSync('app/api/admin/homepage-work-cards/route.ts','utf8');const exports:any={};
 const tx={homepageWorkCard:{findMany:async()=>[{id:'c1'}],updateMany:async()=>({count:0})}};
 const modules:any={'next/server':{NextResponse:Response},'@/lib/auth/session':{getAdminSession:async()=>({workspaceId:'a',role:'EDITOR'})},'@/lib/work-card-media-server':{},'@/lib/homepage-curation-write':{withCurationWrite:async(_a:any,_s:any,_r:any,fn:any)=>fn(tx,new Date())}};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,console,require:(id:string)=>modules[id]});
 const response=await exports.PATCH(new Request('http://localhost/api',{method:'PATCH',body:JSON.stringify({action:'reorder',cardIds:['c1']})}));assert.equal(response.status,409);
});
