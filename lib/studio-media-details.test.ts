import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture() {
  const state = { denied: false, writes: 0, owned: true, version: new Date('2026-01-01T00:00:00.000Z') };
  const db = {
    $queryRaw: async () => [],
    project: { findFirst: async () => state.owned ? { id: 'project' } : null },
    service: { findFirst: async () => ({ id: 'service', slug: 'photography' }) },
    projectMediaCollectionHero: { findUnique: async () => null },
    media: {
      findFirst: async () => ({ id: 'media', updatedAt: state.version, serviceId: 'service', externalUrl: null }),
      update: async ({ where, data }: { where: { project: { workspaceId: string } }; data: { updatedAt: Date } }) => {
        assert.equal(where.project.workspaceId, 'a');state.writes++;state.version=data.updatedAt;return { id: 'media', updatedAt: state.version };
      },
    },
    $transaction: async function (fn: (tx: unknown) => Promise<unknown>) { return fn(this); },
  };
  const modules: Record<string, unknown> = {
    '@aws-sdk/client-s3': {}, 'next/cache': { revalidatePath() {} }, 'next/server': { NextResponse: Response },
    '@/lib/auth/session': { getAdminSession: async () => ({ workspaceId: 'a', userId: 'ua', role: 'OWNER', sessionVersion: 1 }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceEditor: async () => { if(state.denied) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/prisma': { prisma: db }, '@/lib/media-collections': { isMediaCategory: () => true }, '@/lib/service-media': { mediaCategoryForServiceSlug: () => 'PHOTOGRAPHY' },
    '@/lib/cloudflare-stream': {}, '@/lib/external-media': {}, '@/lib/r2': {}, '@/lib/r2-upload': {}, '@/lib/project-media-upload': {}, '@/lib/workspace-assets': {},
  };
  const exports = {} as { PATCH: (req: Request, c: { params: Promise<{projectId: string}> }) => Promise<Response> };
  runInNewContext(ts.transpileModule(readFileSync('app/api/admin/projects/[projectId]/media/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports, Date, URL, Error, process: {env:{}}, console:{error(){}},require:(id:string)=>{assert.ok(id in modules,id);return modules[id];}});
  return {state,send:(patch={})=>exports.PATCH(new Request('http://localhost/api',{method:'PATCH',body:JSON.stringify({action:'update-asset',mediaId:'media',serviceId:'service',originalFilename:'Reviewed filename',mediaCategory:'PHOTOGRAPHY',visibility:'VISIBLE',expectedUpdatedAt:'2026-01-01T00:00:00.000Z',...patch})}),{params:Promise.resolve({projectId:'project'})})};
}
test('media metadata requires a reviewed revision and rejects stale replay without writes', async()=>{
  const f=fixture();for(const expectedUpdatedAt of [undefined,null,'invalid','2026-01-01',123]) assert.equal((await f.send({expectedUpdatedAt})).status,409);
  assert.equal(f.state.writes,0);const r=await f.send();assert.equal(r.status,200);assert.ok(Date.parse((await r.json()).media.updatedAt)>Date.parse('2026-01-01'));
  assert.equal((await f.send()).status,409);assert.equal(f.state.writes,1);
});
test('media metadata preserves fresh authorization and owned project denial before writes',async()=>{
  const f=fixture();f.state.denied=true;assert.equal((await f.send()).status,403);assert.equal(f.state.writes,0);
  f.state.denied=false;f.state.owned=false;assert.equal((await f.send()).status,404);assert.equal(f.state.writes,0);
});
