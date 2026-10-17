import test from 'node:test';
import assert from 'node:assert/strict';
import {HOSTED,BRANCH,CONFIRMATION,invocation,deployment,createRequest,apiClient,qualifiedRun,project} from './current-preview/policy.mjs';
import {executePreview} from './current-preview/execute.mjs';
const candidate='a'.repeat(40),executor='b'.repeat(40),ref='refs/heads/codex/v2-neon-staging-bootstrap';
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'heliosremedia/heliosremedia',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:ref,GITHUB_WORKFLOW_REF:'heliosremedia/heliosremedia/.github/workflows/v2-vercel-staging-qualification.yml@'+ref,GITHUB_SHA:executor,STAGING_EXECUTOR_SHA:executor,STAGING_CANDIDATE_SHA:candidate,STAGING_CONFIRMATION:'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging',STAGING_HOSTED_CONFIRMATION:CONFIRMATION,STAGING_RELEASE_RUN_ID:'123',STAGING_PREVIEW_REHEARSAL_RUN:'456',STAGING_PREVIEW_REHEARSAL_SHA:candidate};
const d=()=>({id:'dpl_synthetic',projectId:HOSTED.project,ownerId:HOSTED.team,target:null,gitSource:{type:'github',repoId:HOSTED.repository,sha:candidate,ref:BRANCH},url:'helios-v2-staging-fixture.vercel.app',alias:['helios-v2-staging-alias.vercel.app'],readyState:'READY'});
test('admits exact protected current-source Preview invocation',()=>assert.equal(invocation(env,candidate),candidate));
for(const key of Object.keys(env))test('blocks invalid Preview '+key,()=>assert.throws(()=>invocation({...env,[key]:'invalid'},candidate)));
for(const key of ['VERCEL','VERCEL_ENV','HELIOS_RELEASE_TARGET'])test('blocks hosted executor '+key,()=>assert.throws(()=>invocation({...env,[key]:'production'},candidate)));
for(const [key,value] of Object.entries({target:'production',ownerId:'foreign',projectId:'foreign',gitSource:{...d().gitSource,ref:ref.slice(11)},customEnvironment:{id:'foreign'},url:'heliosrealestatemedia.com'}))test('blocks deployment '+key,()=>assert.throws(()=>deployment({...d(),[key]:value},candidate)));
const run={head_sha:candidate,head_branch:BRANCH,repository:{full_name:'heliosremedia/heliosremedia'},event:'push',path:'.github/workflows/v2-regression.yml',status:'completed',conclusion:'success'};
test('requires integration-source regression, not a historical passing run',()=>{qualifiedRun(run,candidate,run.path,{integration:true});assert.throws(()=>qualifiedRun({...run,head_branch:'main'},candidate,run.path,{integration:true}));assert.throws(()=>qualifiedRun({...run,head_sha:executor},candidate,run.path));});
test('current branch cannot be the staging production branch',()=>{const p={id:HOSTED.project,accountId:HOSTED.team,name:'helios-v2-staging',link:{type:'github',repoId:HOSTED.repository,productionBranch:BRANCH},commandForIgnoringBuildStep:'exit 0',autoExposeSystemEnvs:true};assert.throws(()=>project(p,{domains:[{name:'helios-v2-staging.vercel.app'}]}));});
function harness(fail){
 const calls=[],evidence=[],before={schemaHash:'schema',ledgerHash:'ledger'};
 const effect=name=>async()=>{calls.push(name);if(name===fail)throw Error('private-password-sentinel');};
 const deps={preflight:async()=>{await effect('preflight')();return before;},configure:effect('configure'),create:async()=>{await effect('create')();return d();},wait:async()=>{await effect('wait')();return d();},receipt:async()=>{await effect('receipt')();return {valid:true};},bind:async()=>{await effect('bind')();return ['packet16-a','packet16-b'].map((workspaceId,i)=>({workspaceId,hostname:[d().url,d().alias[0]][i]}));},qualify:async()=>{await effect('qualify')();return {ordinaryPasswordLogin:true};},suppress:effect('suppress'),unconfigure:effect('unconfigure'),unbind:effect('unbind'),postflight:async()=>{await effect('postflight')();return before;},events:async()=>{await effect('events')();return [];},persist:async e=>evidence.push(e)};
 return {deps,calls,evidence};
}
test('successful qualification retains host bindings after cleanup and publishes two testing URLs',async()=>{const h=harness();const result=await executePreview(h.deps,{candidate,executor});assert.equal(result.success,true);assert.equal(result.ownerAccessQualified,true);assert.equal(result.testingURLs.length,2);assert.ok(!h.calls.includes('unbind'));assert.equal(h.calls.filter(x=>x==='create').length,1);assert.deepEqual(h.calls.slice(-4),['suppress','unconfigure','postflight','events']);});
for(const failure of ['preflight','configure','create','wait','receipt','bind','qualify','suppress','unconfigure','postflight','events'])test('fails closed at '+failure+' without automatic redeployment or retained testing URL',async()=>{const h=harness(failure);await assert.rejects(executePreview(h.deps,{candidate,executor}),/CURRENT_OWNER_PREVIEW_BLOCKED/);assert.ok(h.calls.filter(x=>x==='create').length<=1);const e=h.evidence[0];assert.equal(e.ownerAccessQualified,false);assert.ok(!e.testingURLs);assert.ok(!JSON.stringify(e).includes('private-password-sentinel'));if(failure==='preflight')assert.deepEqual(h.calls,['preflight']);else assert.ok(h.calls.includes('suppress')&&h.calls.includes('unconfigure')&&h.calls.includes('unbind'));});
test('unexpected successful-POST metadata is rejected and never retried',async()=>{const h=harness();h.deps.create=async()=>({...d(),target:'production'});await assert.rejects(executePreview(h.deps,{candidate,executor}));assert.ok(!h.calls.includes('wait'));assert.ok(h.calls.includes('suppress'));});
test('Vercel transport accepts only the exact candidate Preview request',async()=>{let sends=0;const api=apiClient('synthetic-only',candidate,'studio-owner-preview-123',async(url,options)=>{sends++;assert.ok(url.startsWith('https://api.vercel.com/v13/deployments?teamId='+HOSTED.team));assert.equal(options.redirect,'error');return {ok:true,status:200,json:async()=>d()};});await api('/v13/deployments','POST',createRequest(candidate));assert.equal(sends,1);await assert.rejects(api('/v13/deployments','POST',{...createRequest(candidate),target:'production'}));assert.equal(sends,1);await assert.rejects(api('/v9/projects/production','PATCH',{commandForIgnoringBuildStep:'exit 1'}));});
test('rejects provider keys, production targets, foreign branches and unmarked environment writes before network',async()=>{const api=apiClient('synthetic',candidate,'studio-owner-preview-123',()=>{throw Error('network must not be called');});const b={key:'AUTH_SECRET',value:'synthetic',type:'encrypted',target:['preview'],gitBranch:BRANCH,comment:'studio-owner-preview-123'};for(const bad of [{...b,key:'RESEND_API_KEY'},{...b,target:['production']},{...b,gitBranch:'main'},{...b,comment:'foreign'}])await assert.rejects(api('/v10/projects/'+HOSTED.project+'/env','POST',bad),/Unsupported/);});

test('ordinary owner qualifier uses the login form and normal cookie lifecycle, never minted sessions',async()=>{
 const {qualifyOwners}=await import('./current-preview/http.mjs');
 const bindings=['packet16-a','packet16-b'].map((workspaceId,i)=>({workspaceId,hostname:'helios-v2-staging-fixture-'+i+'.vercel.app'}));
 const passwords=['synthetic-a-password-only','synthetic-b-password-only'],calls=[];
 const browser={newContext:async()=>{
  let signed=false,enteredEmail='',enteredPassword='',currentId;
  const response=status=>({status:()=>status});
  const ctx={route:async()=>{},close:async()=>{},request:{
   get:async url=>{calls.push(['GET',new URL(url).pathname]);const path=new URL(url).pathname;
    if(path==='/admin/studio')return response(signed?200:307);
    assert.ok(path.endsWith('/media'),'Use an existing owned GET route');return response(path.includes(currentId+'-project')?200:404);
   },
   post:async(url,options)=>{const path=new URL(url).pathname;calls.push(['POST',path]);
    if(path.endsWith('/logout')){signed=false;return response(200);}
    currentId=options.data.email.split('@')[0];signed=options.data.password===passwords[bindings.findIndex(b=>b.workspaceId===currentId)];return response(signed?200:401);
   }
  },newPage:async()=>({on:()=>{},goto:async()=>{},close:async()=>{},reload:async()=>assert.equal(signed,true),setViewportSize:async()=>{},evaluate:async()=>true,
   getByLabel:label=>({fill:async value=>{if(label==='Email')enteredEmail=value;else enteredPassword=value;}}),
   getByRole:(role,{name})=>role==='heading'?{waitFor:async()=>{assert.equal(name,'Command Center');assert.equal(signed,true);}}:{click:async()=>{assert.equal(name,'Enter workspace');currentId=enteredEmail.split('@')[0];assert.equal(enteredPassword,passwords[bindings.findIndex(b=>b.workspaceId===currentId)]);signed=true;calls.push(['FORM','normal-login']);}}
  })};return ctx;
 },close:async()=>{}};
 const result=await qualifyOwners(bindings,passwords,null,{browserType:{launch:async()=>browser}});
 assert.equal(result.length,2);assert.ok(result.every(r=>r.ordinaryBrowserPasswordLogin&&r.logoutClearsSession&&r.foreignProject===404));
 assert.equal(calls.filter(([method])=>method==='FORM').length,2);assert.equal(calls.filter(([,path])=>path==='/api/admin/auth/logout').length,4);
});
