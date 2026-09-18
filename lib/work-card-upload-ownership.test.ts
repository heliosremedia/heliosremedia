import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual routes with isolated registry/provider delegates. */
function fixture() {
 const state = { writes: 0, heads: 0, deletes: 0, owner: 'a', status: 'UPLOAD_PROVISIONED', registered: false, provenance: { kind: 'WORK_CARD_UPLOAD', cardId: 'c1', mediaKind: 'image', serviceId: 's1' }, existing: { id: 'c1', serviceId: 's1', imageStorageKey: null as string|null, imageUrl: null as string|null, videoStorageKey: null, videoUrl: null, mediaMode: 'IMAGE', service: { slug: 's1' } } };
 const tx: any = { service: { findFirst: async () => ({ id: 's1', slug: 's1' }) }, homepageWorkCard: { findFirst: async () => state.existing, updateMany: async ({data}:any) => { state.writes++; Object.assign(state.existing,data); return {count:1}; }, findFirstOrThrow: async () => state.existing }, workspaceAsset: { findUnique: async () => state.registered ? {id:'asset1',workspaceId:state.owner,status:state.status,provenance:state.provenance} : null } };
 const modules: any = { 'server-only': {}, 'next/server': {NextResponse:Response}, '@/lib/auth/session': {getAdminSession:async()=>({role:'EDITOR',workspaceId:'a'})}, '@/lib/content-image-storage': {verifyContentImage:async()=>{state.heads++;},deleteContentImage:async()=>{state.deletes++;}}, '@/lib/r2': {r2Config:{accountId:'test',bucketName:'test'}}, '@/lib/r2-upload': {getPublicAssetUrl:(key:string)=>'https://assets.test/'+key}, '@/lib/homepage-curation-write': {withCurationWrite:async(_a:any,_s:any,_r:any,fn:any)=>fn(tx,new Date())} };
 const load = (path:string):any => { const exports={}; runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Error,console,require:(id:string)=>{if(id in modules)return modules[id]; if(id.startsWith('@/'))return modules[id]=load(id.slice(2)+'.ts'); throw new Error(id);}});return exports; };
 const route=load('app/api/admin/homepage-work-cards/route.ts');
 const patch=(key:string|null,url:string|null)=>route.PATCH(new Request('http://localhost/api',{method:'PATCH',body:JSON.stringify({cardId:'c1',serviceId:'s1',imageStorageKey:key,imageUrl:url,mediaMode:'IMAGE'})}));
 return {state,patch};
}
test('work-card actual writer rejects a new unregistered legacy reference and supplied foreign URL',async()=>{
 const f=fixture(); const response=await f.patch('site/homepage/work-cards/c1/image.webp','https://foreign.test/object.webp'); assert.equal(response.status,400); assert.equal(f.state.writes,0);
});
const key='workspaces/a/homepage-work-cards/c1/image-test.webp';
for(const defect of ['missing','company','pending','quarantined','card','kind','url','foreign-key','wrong-card-key']) test(`work-card actual writer rejects ${defect} before storage or mutation`,async()=>{
 const f=fixture(); f.state.registered=defect!=='missing';
 if(defect==='company')f.state.owner='b';
 if(defect==='pending')f.state.status='UPLOAD_PENDING';
 if(defect==='quarantined')f.state.status='QUARANTINED';
 if(defect==='card')f.state.provenance.cardId='c2';
 if(defect==='kind')f.state.provenance.mediaKind='video';
 const submitted=defect==='foreign-key'?key.replace('/a/','/b/'):defect==='wrong-card-key'?key.replace('/c1/','/c2/'):key;
 assert.equal((await f.patch(submitted,defect==='url'?'https://foreign.test/object.webp':'https://assets.test/'+submitted)).status,400); assert.equal(f.state.writes,0);assert.equal(f.state.heads,0);
});
test('work-card canonical attachment and replacement retain previous provider objects',async()=>{
 const f=fixture(); f.state.registered=true;f.state.existing.imageStorageKey='site/homepage/work-cards/c1/old.webp';f.state.existing.imageUrl='https://assets.test/old.webp';
 const response=await f.patch(key,'https://assets.test/'+key);assert.equal(response.status,200);const result=await response.json();assert.equal(result.media.image.assetId,'asset1');assert.equal(result.media.image.mediaId,key);assert.equal(result.card.imageUrl,'https://assets.test/'+key);assert.equal(f.state.heads,1);assert.equal(f.state.deletes,0);
});
test('work-card exact legacy reference remains on its authorized card without provider roundtrip',async()=>{
 const f=fixture();f.state.existing.imageStorageKey='site/homepage/work-cards/c1/old.webp';f.state.existing.imageUrl='https://assets.test/old.webp';
 const response=await f.patch(f.state.existing.imageStorageKey,f.state.existing.imageUrl);assert.equal(response.status,200);assert.equal((await response.json()).media.image.verification,'retained');assert.equal(f.state.heads,0);
});

function presignFixture() {
 const state={role:'EDITOR',revision:'current',registered:0,signed:0,events:[] as string[],card:true};
 const tx:any={ $queryRaw:async()=>[],adminUser:{findFirst:async()=>({id:'u',workspaceId:'a',active:true,role:state.role,sessionVersion:1})},homepageWorkCard:{findMany:async()=>[{id:'c1',serviceId:'s1',displayOrder:0,updatedAt:new Date(0)}],findFirst:async()=>state.card?{id:'c1',serviceId:'s1'}:null},workspaceAsset:{create:async({data}:any)=>{assert.equal(data.workspaceId,'a');assert.equal(data.provenance.cardId,'c1');assert.match(data.providerKey,/^workspaces\/a\/homepage-work-cards\/c1\/image-/);state.events.push('register');state.registered++;return{id:'asset1'};},updateMany:async()=>{state.events.push('provisioned');return{count:1};}}};
 const modules:any={'server-only':{},'next/server':{NextResponse:Response},'next/cache':{revalidatePath(){}},'node:crypto':{createHash:()=>({update(){return this;},digest:()=>state.revision})},'@/lib/prisma':{prisma:{$transaction:async(fn:any)=>fn(tx)}},'@/lib/auth/session':{getAdminSession:async()=>({userId:'u',workspaceId:'a',role:'EDITOR',sessionVersion:1})},'@/lib/r2':{r2Config:{accountId:'test',bucketName:'test'}},'@/lib/content-image-storage':{},'@/lib/r2-upload':{createHomepageWorkCardKey:()=> 'site/homepage/work-cards/c1/image-test.webp',getPublicAssetUrl:(key:string)=>'https://assets.test/'+key,createPresignedUploadUrl:async()=>{assert.equal(state.registered,1);state.events.push('sign');state.signed++;return'https://upload.test/object';}}};
 const load=(path:string):any=>{const exports={};runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Error,console,process:{env:{}},require:(id:string)=>{if(id in modules)return modules[id];const file=id.startsWith('@/')?id.slice(2):'lib/'+id.slice(2);return modules[id]=load(file.endsWith('.ts')?file:file+'.ts');}});return exports;};
 const route=load('app/api/admin/homepage-work-cards/presign/route.ts');return{state,run:(revision='current')=>route.POST(new Request('http://localhost/api',{method:'POST',headers:{'x-curation-revision':revision,'x-curation-request':'request1'},body:JSON.stringify({cardId:'c1',kind:'image',fileType:'image/webp',fileSize:10})}))};
}
test('work-card preparation uses current locked authorization and rejects stale revision before registration/signing',async()=>{
 const f=presignFixture();f.state.role='VIEWER';assert.equal((await f.run()).status,403);assert.equal(f.state.registered,0);f.state.role='EDITOR';assert.equal((await f.run('stale')).status,409);assert.equal(f.state.signed,0);f.state.card=false;assert.equal((await f.run()).status,404);
});
test('work-card preparation registers scoped provenance before signing and returns correlated canonical identity',async()=>{
 const f=presignFixture();const response=await f.run();assert.equal(response.status,200);const result=await response.json();assert.deepEqual(f.state.events,['register','sign','provisioned']);assert.equal(result.media.assetId,'asset1');assert.equal(result.media.key,result.upload.key);assert.equal(result.media.url,result.upload.publicUrl);assert.equal(result.media.cardId,'c1');assert.equal(result.acknowledgement.requestId,'request1');assert.equal(result.acknowledgement.revision,'current');
});
test('work-card preserves exact URL-only legacy attachment but cannot introduce or substitute one',async()=>{
 const f=fixture();f.state.existing.imageUrl='https://legacy.test/image.webp';assert.equal((await f.patch(null,f.state.existing.imageUrl)).status,200);assert.equal((await f.patch(null,'https://foreign.test/image.webp')).status,400);assert.equal(f.state.heads,0);
});
test('prepared upload cannot attach after service parent reassignment',async()=>{
 const f=fixture();f.state.registered=true;Object.assign(f.state.provenance,{serviceId:'old-service'});assert.equal((await f.patch(key,'https://assets.test/'+key)).status,400);assert.equal(f.state.writes,0);
});
test('already attached registered media survives intentional same-company service reassignment',async()=>{
 const f=fixture();f.state.registered=true;Object.assign(f.state.provenance,{serviceId:'previous-service'});f.state.existing.imageStorageKey=key;f.state.existing.imageUrl='https://assets.test/'+key;assert.equal((await f.patch(key,f.state.existing.imageUrl)).status,200);assert.equal(f.state.heads,0);
});
test('old unbound preparation cannot be newly attached but its exact existing attachment is retained',async()=>{
 const f=fixture();f.state.registered=true;delete (f.state.provenance as Partial<typeof f.state.provenance>).serviceId;assert.equal((await f.patch(key,'https://assets.test/'+key)).status,400);f.state.existing.imageStorageKey=key;f.state.existing.imageUrl='https://assets.test/'+key;assert.equal((await f.patch(key,f.state.existing.imageUrl)).status,200);
});
