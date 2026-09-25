import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as token from './auth/token.ts';
const require=createRequire(import.meta.url);
const nextServer=require('next/server');
const proxyExports:{proxy?:(request:unknown)=>Response}={};
runInNewContext(ts.transpileModule(readFileSync('proxy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:proxyExports,URL,require:(name:string)=>{if(name==='next/server')return nextServer;if(name==='@/lib/auth/token')return token;throw Error('Unexpected proxy dependency');}});
function anonymousProxy(){return proxyExports.proxy!(new nextServer.NextRequest('https://synthetic.example.test/api/admin/homepage-projects',{method:'PATCH'}));}
test('actual application proxy denies anonymous API mutations with401',async()=>{const r=anonymousProxy();assert.equal(r.status,401);assert.deepEqual(await r.json(),{success:false,error:'Authentication required.'});assert.equal(r.headers.get('location'),null);});
import {execute} from '../scripts/staging/actions/executor.mjs';
import {invocation,project,deployment,createRequest,environmentInventory,CANDIDATE,HOSTED,CONFIRMATION,IGNORE} from '../scripts/staging/actions/policy.mjs';
import {diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
function fixture(){
 const env={GITHUB_REPOSITORY:'heliosremedia/heliosremedia',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/'+HOSTED.branch,GITHUB_SHA:'a'.repeat(40),STAGING_EXECUTOR_SHA:'a'.repeat(40),STAGING_CANDIDATE_SHA:CANDIDATE,STAGING_HOSTED_CONFIRMATION:CONFIRMATION,STAGING_TRACK:'current-baseline',STAGING_CONFIRMATION:'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging'};
 const dep={id:'dpl_test',url:'helios-v2-staging-test.vercel.app',alias:['helios-v2-staging-branch.vercel.app'],projectId:HOSTED.project,ownerId:HOSTED.team,target:null,gitSource:{type:'github',repoId:HOSTED.repository,ref:HOSTED.branch,sha:CANDIDATE},readyState:'READY'};
 const p={id:HOSTED.project,name:'helios-v2-staging',accountId:HOSTED.team,link:{type:'github',repoId:HOSTED.repository,productionBranch:'main'},commandForIgnoringBuildStep:'exit 0',autoExposeSystemEnvs:true};
 const domains={domains:[{name:'helios-v2-staging.vercel.app'}]};return {env,dep,p,domains};
}
function effects(fail=''){
 const {env,dep}=fixture(),calls:string[]=[];let saved:unknown;
 const step=(name:string,value:unknown)=>async()=>{calls.push(name);if(name===fail)throw Error('secret=https://credential:password@private.invalid');return value;};
 const deps={preflight:step('preflight',{schemaHash:'schema',ledgerHash:'ledger'}),configure:step('configure',null),create:step('create',dep),wait:step('wait',dep),receipt:step('receipt',{}),qualify:step('qualify',{}),suppress:step('suppress',null),unbind:step('unbind',null),unconfigure:step('unconfigure',null),postflight:step('postflight',{schemaHash:'schema',ledgerHash:'ledger'}),diagnostics:step('diagnostics',[]),persist:async(e:unknown)=>{saved=e;}};
 return {env,deps,calls,get saved(){return saved;}};
}
test('manual executor creates once, qualifies then restores and checks schema/ledger',async()=>{const f=effects();await execute(f.deps,f.env);assert.deepEqual(f.calls,['preflight','configure','create','wait','receipt','qualify','suppress','unbind','unconfigure','postflight','diagnostics']);});
for(const phase of ['preflight','configure','create','wait','receipt','qualify','suppress','unbind','unconfigure','postflight','diagnostics'])test('safe diagnostics and cleanup on '+phase+' failure',async()=>{
 const f=effects(phase);await assert.rejects(execute(f.deps,f.env));assert.ok(!JSON.stringify(f.saved).includes('password'));assert.ok(!JSON.stringify(f.saved).includes('private.invalid'));
 assert.ok(f.calls.filter(x=>x==='create').length<=1);if(phase==='preflight')assert.deepEqual(f.calls,['preflight']);else for(const name of ['suppress','unbind','unconfigure','postflight'])assert.ok(f.calls.includes(name));
});
for(const key of ['GITHUB_REPOSITORY','GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_SHA','STAGING_EXECUTOR_SHA','STAGING_CANDIDATE_SHA','STAGING_HOSTED_CONFIRMATION','STAGING_TRACK','STAGING_CONFIRMATION'])test('invocation rejects '+key+' before effects',async()=>{const f=effects();await assert.rejects(execute(f.deps,{...f.env,[key]:'wrong'}));assert.deepEqual(f.calls,[]);});
test('request has immutable source and no production, latest-commit or build-command override',()=>{const r=createRequest();assert.equal(r.project,HOSTED.project);assert.equal(r.gitSource.sha,CANDIDATE);assert.equal(r.withLatestCommit,false);assert.ok(!('target'in r));assert.ok(!('projectSettings'in r));assert.ok(IGNORE.length<=256);invocation(fixture().env);});
for(const change of ['project','team','target','source','branch','alias','id'])test('provider deployment rejects '+change,()=>{const {dep}=fixture();if(change==='project')dep.projectId='production';if(change==='team')dep.ownerId='foreign';if(change==='target')Object.assign(dep,{target:'production'});if(change==='source')dep.gitSource.sha='b'.repeat(40);if(change==='branch')dep.gitSource.ref='main';if(change==='alias')dep.alias=['heliosrealestatemedia.com'];if(change==='id')dep.id='../../projects/production';assert.throws(()=>deployment(dep,'dpl_test'));});
test('project, domain and environment inventories fail closed',()=>{const {p,domains}=fixture();project(p,domains);environmentInventory([{key:'DATABASE_URL'},{key:'DIRECT_URL'}]);assert.throws(()=>project({...p,id:'prj_FPZa82WCG2w4oxJzf7DEV04ChuWB'},domains));assert.throws(()=>project(p,{domains:[{name:'production.com'}]}));assert.throws(()=>project({...p,commandForIgnoringBuildStep:'exit 1'},domains));assert.throws(()=>environmentInventory([{key:'META_APP_SECRET'}]));assert.throws(()=>environmentInventory([{key:'DATABASE_URL',gitBranch:HOSTED.branch}]));});
test('schema/ledger drift cannot produce successful qualification',async()=>{const f=effects();f.deps.postflight=async()=>({schemaHash:'drift',ledgerHash:'ledger'});await assert.rejects(execute(f.deps,f.env));assert.ok(f.calls.includes('suppress'));});
test('error diagnostics keep phase/reason/hash without raw secrets or log text',()=>{const e=diagnostic('application-build',{message:'Command failed postgres://user:secret@example.com'});assert.equal(e.phase,'application-build');assert.equal(e.reason,'BUILD_FAILED');assert.match(e.detailHash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(e).includes('secret'));assert.ok(!JSON.stringify(eventsSummary([{type:'stderr',text:'token=topsecret'}])).includes('topsecret'));});
test('provider event parser preserves only validated safe hosted diagnostics',()=>{
 const safe=eventsSummary([{type:'stderr',text:'prefix STAGING_HOSTED_BUILD_BLOCKED {"phase":"database-preflight","reason":"CHECK_DATABASE_SCHEMA_HASH","matched":false,"detailHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'}])[0];
 assert.equal(safe.phase,'database-preflight');assert.equal(safe.reason,'CHECK_DATABASE_SCHEMA_HASH');assert.equal(safe.matched,false);assert.equal(safe.detailHash,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
 const forged=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED {"phase":"database-preflight","reason":"CHECK_NOT_REAL","matched":false,"detailHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"} token=topsecret'}])[0];
 assert.equal(forged.phase,'provider-build-event');assert.ok(!JSON.stringify(forged).includes('topsecret'));
});
test('manual workflow is protected, pinned, no automatic trigger and always restores',()=>{const s=readFileSync('.github/workflows/v2-vercel-staging-qualification.yml','utf8');assert.match(s,/workflow_dispatch:/);assert.doesNotMatch(s,/\n  (push|pull_request|schedule):/);assert.match(s,/environment: helios-v2-staging-bootstrap/);assert.match(s,/secrets.STAGING_VERCEL_TOKEN/);assert.match(s,/if: always\(\)/);assert.match(s,new RegExp(CANDIDATE));assert.doesNotMatch(s,/migrate deploy|db push|--prod|vercel promote/);});

test('actual Vercel adapter pins origin/team and refuses all production mutation paths',async()=>{
 const {vercelClient}=await import('../scripts/staging/actions/vercel.mjs');const calls:{url:string;method:string}[]=[];
 const api=vercelClient('synthetic-only',async(url,options)=>{calls.push({url:String(url),method:options?.method||'GET'});return Response.json({id:'dpl_test'});});
 await api('/v13/deployments','POST',createRequest());assert.equal(calls.length,1);assert.match(calls[0].url,new RegExp('^https://api.vercel.com/v13/deployments\\?teamId='+HOSTED.team+'$'));
 for(const [path,method,body] of [['/v9/projects/prj_FPZa82WCG2w4oxJzf7DEV04ChuWB','PATCH',{commandForIgnoringBuildStep:'exit 1'}],['/v13/deployments','POST',{...createRequest(),target:'production'}],['/v10/projects/'+HOSTED.project+'/env','POST',{target:['production'],gitBranch:HOSTED.branch}],['/v9/projects/'+HOSTED.project,'PATCH',{name:'renamed'}]] as const)await assert.rejects(api(path,method,body));assert.equal(calls.length,1);
});
test('actual Vercel transport does not retry uncertain POST or print response credentials',async()=>{
 const {vercelClient}=await import('../scripts/staging/actions/vercel.mjs');let calls=0;const api=vercelClient('sensitive',async()=>{calls++;return new Response('token=sensitive',{status:403});});
 await assert.rejects(api('/v13/deployments','POST',createRequest()),{message:'VERCEL_HTTP_403'});assert.equal(calls,1);
});

for(const failure of ['', 'PUBLIC', 'ADMIN', 'BROWSER', 'ANONYMOUS_200', 'ANONYMOUS_302', 'ANONYMOUS_403'])test('hosted HTTP harness both tenants and fixed redirect diagnostic '+(failure||'success'),async()=>{
 const {diagnostic}=await import('../scripts/staging/actions/diagnostics.mjs');
 const {qualifyHTTP,revision}=await import('../scripts/staging/actions/http.mjs');
 const ids=['packet16-a','packet16-b'];const rows=Object.fromEntries(ids.map(id=>[id,{id:id+'-placement',projectId:id+'-project',displayOrder:0,updatedAt:new Date('2026-09-01')} ]));
 const db={query:async(sql:string,args:string[])=>{
  const id=args[0].replace(/-(owner|placement)$/,'');
  if(sql.includes('"AdminUser"'))return {rows:[{id:id+'-owner',email:id+'@example.test',displayName:'Synthetic',workspaceId:id,active:true,role:'OWNER',sessionVersion:1,passwordHash:null}]};
  if(sql.includes('"WorkspaceMembership"'))return {rows:[{workspaceId:id,userId:id+'-owner',role:'OWNER',status:'ACTIVE'}]};
  return {rows:[{...rows[id]}]};
 }};
 let contexts=0,closedContexts=0,closedBrowsers=0;const widths:number[]=[];
 const response=(status:number,data:unknown)=>({status:()=>status,json:async()=>data,text:async()=>String(data)});
 const browser={close:async()=>{closedBrowsers++;},newContext:async()=>{const id=ids[contexts++];let authenticated=false;return {
  close:async()=>{closedContexts++;},addCookies:async()=>{authenticated=true;},route:async()=>{},
  request:{get:async(url:string)=>response((url.endsWith('/admin/homepage')?failure==='ADMIN':failure==='PUBLIC')?302:200,url.endsWith('/admin/homepage')?id+'-placement':'Synthetic '+id),patch:async(_url:string,options:{data:{placementId?:string};headers?:Record<string,string>})=>{
   if(!authenticated){const denied=anonymousProxy();return response(failure.startsWith('ANONYMOUS_')?Number(failure.split('_')[1]):denied.status,await denied.json());}if(options.data.placementId!==id+'-placement')return response(404,{});
   const before=revision(id,[rows[id]]);if(options.headers?.['x-curation-revision']!==before)return response(409,{});
   rows[id].updatedAt=new Date(rows[id].updatedAt.getTime()+1);return response(200,{acknowledgement:{workspaceId:id,previousRevision:before,revision:revision(id,[rows[id]])}});
  }},
  newPage:async()=>({setViewportSize:async({width}:{width:number})=>{widths.push(width);},on:()=>{},goto:async()=>response(failure==='BROWSER'?302:200,''),getByRole:()=>({waitFor:async()=>{}}),close:async()=>{}}),
 };}};
 const run=()=>qualifyHTTP(db,ids.map((workspaceId,i)=>({workspaceId,hostname:'helios-v2-staging-'+i+'.vercel.app'})),'a'.repeat(96),undefined,{launch:async()=>browser} as unknown as Parameters<typeof qualifyHTTP>[4]);
 if(failure){await assert.rejects(run(),e=>{const d=diagnostic('hosted-http-chromium',e);assert.equal(d.reason,'CHECK_HTTP_'+(failure.startsWith('ANONYMOUS_')?'ANONYMOUS':failure)+'_STATUS');assert.equal(d.matched,false);assert.deepEqual(Object.keys(d).sort(),['detailHash','matched','phase','reason']);assert.ok(!JSON.stringify(d).includes('vercel.app'));return true;});assert.equal(closedContexts,1);assert.equal(closedBrowsers,1);assert.equal(process.env.AUTH_SECRET,undefined);return;}
 const results=await run();assert.equal(closedContexts,2);assert.equal(closedBrowsers,1);assert.equal(results.length,2);assert.deepEqual(widths,[390,1440,390,1440]);assert.equal(process.env.AUTH_SECRET,undefined);
});
