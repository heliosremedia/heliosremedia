import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runtime,provenance,receipt,hostnameBindings,HOSTED } from '../scripts/staging/hosted-policy.mjs';
import { executeHosted } from '../scripts/staging/hosted-build.mjs';
import { syntheticCookie } from '../scripts/staging/hosted-session.ts';
import { verifySessionToken } from './auth/token.ts';
const sha='a'.repeat(40),h='b'.repeat(64);
function fixture(){
 const env={STAGING_HOSTED_ADMISSION:'preview-only',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:HOSTED.project,VERCEL_ORG_ID:HOSTED.team,VERCEL_GIT_COMMIT_REF:HOSTED.branch,VERCEL_GIT_COMMIT_SHA:sha,STAGING_CANDIDATE_SHA:sha,STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',AUTH_SECRET:'a'.repeat(96),STAGING_RELEASE_RUN_ID:'123',DATABASE_URL:'postgresql://synthetic:synthetic@ep-crimson-snow-araflu1k.c-4.us-west-2.aws.neon.tech/helios_v2_staging?sslmode=require',DIRECT_URL:'',VERCEL_DEPLOYMENT_ID:'dpl_test',VERCEL_URL:'helios-v2-staging-test.vercel.app'};
 env.DIRECT_URL=env.DATABASE_URL;
 const metadata={project:{id:HOSTED.project,name:'helios-v2-staging',accountId:HOSTED.team,link:{repoId:HOSTED.repository,type:'github'}},deployment:{projectId:HOSTED.project,ownerId:HOSTED.team,target:null,readyState:'BUILDING',id:env.VERCEL_DEPLOYMENT_ID,url:env.VERCEL_URL,gitSource:{type:'github',repoId:HOSTED.repository,sha,ref:HOSTED.branch}},domains:{domains:[{name:'helios-v2-staging.vercel.app'}]},run:{id:123,repository:{full_name:'heliosremedia/heliosremedia'},head_sha:sha,head_branch:HOSTED.branch,path:'.github/workflows/v2-regression.yml',event:'push',status:'completed',conclusion:'success',run_attempt:1},jobs:{total_count:1,jobs:[{name:'Tests and TypeScript',conclusion:'success',steps:[{name:'Run isolated regression tests',conclusion:'success'}]}]}};
 return {env,metadata};
}
const state={state:'current-compatible-ledger',track:'baseline',schemaHash:h,ledgerHash:h};
test('staging admission executes read-only preflight before build, postflight before receipt',async()=>{
 const f=fixture(),calls:string[]=[];
 const result=await executeHosted({metadata:async()=>{calls.push('metadata');return f.metadata;},source:async()=>{calls.push('source');return {schema:h};},inspect:async()=>{calls.push('inspect');return state;},build:async()=>{calls.push('build');},digest:async()=>h,persist:async()=>{calls.push('receipt');}},f.env);
 assert.deepEqual(calls,['metadata','source','inspect','build','inspect','receipt']);assert.equal(result.buildDigest,h);assert.equal(result.promotable,false);assert.equal(result.candidate,sha);
});
for(const [key,value] of Object.entries({VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_FPZa82WCG2w4oxJzf7DEV04ChuWB',VERCEL_ORG_ID:'foreign',VERCEL_GIT_COMMIT_REF:'main',VERCEL_GIT_COMMIT_SHA:'c'.repeat(40),STAGING_CANDIDATE_SHA:'bad',STUDIO_V2_TENANT_CONTEXT_ENABLED:'false',AUTH_SECRET:'short',DATABASE_URL:'postgresql://x:y@production.invalid/prod?sslmode=require',DIRECT_URL:'postgresql://x:y@production.invalid/prod?sslmode=require',META_APP_SECRET:'present',LINKEDIN_CLIENT_SECRET:'present',TIKTOK_CLIENT_SECRET:'present',UPTIMEROBOT_API_KEY:'present',NEWSLETTER_NOTIFICATION_EMAIL:'present',INQUIRY_EMAIL_FROM:'present',CRON_SECRET:'present',R2_ACCESS_KEY_ID:'present',RESEND_API_KEY:'present',OPENAI_API_KEY:'present',SOCIAL_TOKEN_ENCRYPTION_KEY:'present',STUDIO_V2_LOCAL_WORKSPACE_SLUG:'packet16-a'})){
 test('admission rejects '+key+' before network/build',async()=>{const f=fixture();let touched=false;await assert.rejects(executeHosted({metadata:async()=>{touched=true;}},{...f.env,[key]:value}));assert.equal(touched,false);});
}
for(const [name,change] of [
 ['wrong provider project',(m:ReturnType<typeof fixture>['metadata'])=>m.project.id='foreign'],['wrong provider account',(m:ReturnType<typeof fixture>['metadata'])=>m.deployment.ownerId='foreign'],['production deployment',(m:ReturnType<typeof fixture>['metadata'])=>Object.assign(m.deployment,{target:'production'})],['wrong source',(m:ReturnType<typeof fixture>['metadata'])=>m.deployment.gitSource.sha='c'.repeat(40)],['wrong deployment',(m:ReturnType<typeof fixture>['metadata'])=>m.deployment.id='dpl_other'],['production custom domain',(m:ReturnType<typeof fixture>['metadata'])=>m.domains.domains.push({name:'heliosrealestatemedia.com'})],['stale release evidence',(m:ReturnType<typeof fixture>['metadata'])=>m.run.head_sha='c'.repeat(40)],['failed CI',(m:ReturnType<typeof fixture>['metadata'])=>m.run.conclusion='failure'],['skipped tests',(m:ReturnType<typeof fixture>['metadata'])=>m.jobs.jobs[0].steps[0].conclusion='skipped'],['paginated domains',(m:ReturnType<typeof fixture>['metadata'])=>Object.assign(m.domains,{pagination:{next:123}})],
] as const){test('authenticated metadata rejects '+name,()=>{const f=fixture();change(f.metadata);assert.throws(()=>provenance(f.metadata,f.env));});}
test('postflight drift or build failure never emits an admission receipt',async()=>{
 for(const broken of ['build','schema','ledger','classification']){const f=fixture();let n=0,persisted=false;await assert.rejects(executeHosted({metadata:async()=>f.metadata,source:async()=>({}),inspect:async()=>++n===1?state:{...state,...(broken==='schema'?{schemaHash:'c'.repeat(64)}:broken==='ledger'?{ledgerHash:'c'.repeat(64)}:broken==='classification'?{state:'schema-mismatch'}:{})},build:async()=>{if(broken==='build')throw Error('failed');},digest:async()=>h,persist:async()=>{persisted=true;}},f.env));assert.equal(persisted,false);}
});
test('hostname plans require two distinct provider-owned preview hosts',()=>{const f=fixture();const dep={...f.metadata.deployment,readyState:'READY',alias:['helios-v2-staging-other.vercel.app']};const bindings=[{workspaceId:'packet16-a',hostname:dep.url},{workspaceId:'packet16-b',hostname:dep.alias[0]}];assert.equal(hostnameBindings(dep,bindings).length,2);assert.throws(()=>hostnameBindings(dep,[bindings[0],{...bindings[1],hostname:'heliosrealestatemedia.com'}]));assert.throws(()=>hostnameBindings(dep,[bindings[0],{...bindings[1],hostname:dep.url}]));});
test('synthetic cookie uses the normal signature verifier and rejects foreign membership',()=>{
 const old=process.env.AUTH_SECRET;process.env.AUTH_SECRET='a'.repeat(96);
 try{const input={workspaceId:'packet16-a',hostname:'helios-v2-staging-test.vercel.app',allowedHosts:['helios-v2-staging-test.vercel.app'],user:{id:'packet16-a-owner',email:'packet16-a@example.test',displayName:'Synthetic',workspaceId:'packet16-a',active:true,role:'OWNER',sessionVersion:1,passwordHash:null},membership:{workspaceId:'packet16-a',userId:'packet16-a-owner',role:'OWNER',status:'ACTIVE'}};
 const c=syntheticCookie(input);assert.equal(verifySessionToken(c.value)?.userId,input.user.id);assert.equal(c.secure,true);assert.equal(c.httpOnly,true);assert.equal(verifySessionToken(c.value+'x'),null);
 assert.throws(()=>syntheticCookie({...input,membership:{...input.membership,workspaceId:'packet16-b'}}));assert.throws(()=>syntheticCookie({...input,user:{...input.user,active:false}}));
 }finally{if(old===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=old;}
});
test('actual production build CLI fails closed even with staging opt-in',()=>{
 const f=fixture();const r=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8',env:{NODE_ENV:"test",PATH:process.env.PATH,...f.env,VERCEL_ENV:'production'}});assert.notEqual(r.status,0);assert.match(r.stderr,/STAGING_HOSTED_BUILD_BLOCKED/);assert.ok(!r.stderr.includes('synthetic:synthetic'));
});
test('receipt checksum is deterministic and binds revision and build digest',()=>{const f=fixture(),p=provenance(f.metadata,f.env);assert.deepEqual(receipt(p,state,state,{},h),receipt(p,state,state,{},h));assert.notEqual(receipt(p,state,state,{},h).checksum,receipt(p,state,state,{},'c'.repeat(64)).checksum);assert.equal(runtime(f.env),sha);});
