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

test('actual R2 module imports without credentials only for exact disabled staging context',async()=>{
 const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');const ts=(await import('typescript')).default;
 const code=ts.transpileModule(readFileSync('lib/r2.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 let clients=0;const load=(env:Record<string,string>)=>{const exports:{r2Config?:{bucketName:string};r2Client?:{send:unknown}}={};runInNewContext(code,{exports,process:{env},require:()=>({S3Client:class{constructor(){clients++;}}})});return exports;};
 const env={STAGING_HOSTED_ADMISSION:'preview-only',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:HOSTED.project};
 const r=load(env);assert.equal(clients,0);assert.throws(()=>r.r2Config!.bucketName,/R2_DISABLED/);assert.throws(()=>r.r2Client!.send,/R2_DISABLED/);
 assert.throws(()=>load({...env,VERCEL_ENV:'production'}),/Missing required/);assert.throws(()=>load({...env,VERCEL_PROJECT_ID:'foreign'}),/Missing required/);
 load({R2_ACCOUNT_ID:'synthetic',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET_NAME:'synthetic',R2_PUBLIC_URL:'https://assets.invalid'});assert.equal(clients,1);
});

test('native build digest binds linked dependency bytes and rejects escapes and cycles',async()=>{
 const {mkdtemp,mkdir,writeFile,symlink,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {hostedDigest}=await import('../scripts/staging/hosted-digest.mjs');
 const dir=await mkdtemp(join(tmpdir(),'staging-digest-'));const root=join(dir,'build'),deps=join(dir,'deps');
 try{await mkdir(join(root,'node_modules'),{recursive:true});await mkdir(deps);await writeFile(join(deps,'module.js'),'first');await symlink(deps,join(root,'node_modules','package'));
 const first=await hostedDigest(root,deps);assert.equal(await hostedDigest(root,deps),first);await writeFile(join(deps,'module.js'),'changed');assert.notEqual(await hostedDigest(root,deps),first);
 await symlink(dir,join(root,'node_modules','escape'));await assert.rejects(hostedDigest(root,deps),/escapes/);await rm(join(root,'node_modules','escape'));
 await symlink(deps,join(deps,'cycle'));await assert.rejects(hostedDigest(root,deps),/cycle/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

// Independently enumerated fixtures cover every arm of the existing deny expression.
import {check,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
const providerCases=[
 ['R2_PRIVATE_SENTINEL','R2'],['CLOUDFLARE_PRIVATE_SENTINEL','CLOUDFLARE'],
 ['AWS_PRIVATE_SENTINEL','AWS'],['RESEND_PRIVATE_SENTINEL','RESEND'],
 ['OPENAI_PRIVATE_SENTINEL','OPENAI'],['GOOGLE_PRIVATE_SENTINEL','GOOGLE'],
 ['SOCIAL_PRIVATE_SENTINEL','SOCIAL'],['META_PRIVATE_SENTINEL','META'],
 ['LINKEDIN_PRIVATE_SENTINEL','LINKEDIN'],['TIKTOK_PRIVATE_SENTINEL','TIKTOK'],
 ['UPTIMEROBOT_PRIVATE_SENTINEL','UPTIMEROBOT'],['NEWSLETTER_PRIVATE_SENTINEL','NEWSLETTER'],
 ['INQUIRY_PRIVATE_SENTINEL','INQUIRY'],['HDPH_PRIVATE_SENTINEL','HDPH'],
 ['CRON_SECRET','CRON'],['HELIOS_ADMIN_PRIVATE_SENTINEL','HELIOS_ADMIN'],
 ['INQUIRY_NOTIFICATION_PRIVATE_SENTINEL','INQUIRY'],['NEXT_PUBLIC_GA_PRIVATE_SENTINEL','ANALYTICS'],
 ['NEXT_PUBLIC_SITE_URL','PRODUCTION_SITE'],['CAMPAIGN_PRIVATE_SENTINEL','CAMPAIGN'],
 ['PORTAL_PRIVATE_SENTINEL','PORTAL'],
] as const;
for(const [key,family] of providerCases){
 test('runtime privately labels forbidden family '+family+' '+key,async()=>{
  const value='https://credential-sentinel:secret-sentinel@provider.invalid/private';
  const env={...fixture().env,[key]:value};
  let touched=false;
  await assert.rejects(executeHosted({metadata:async()=>{touched=true;}},env),(error:Error & {safeDiagnostic:Record<string,unknown>})=>{
   const d=error.safeDiagnostic;
   assert.deepEqual(Object.keys(d).sort(),['detailHash','matched','phase','reason']);
   assert.equal(d.phase,'runtime');assert.equal(d.reason,family==='AWS'?'CHECK_PROVIDER_AWS_UNKNOWN':'CHECK_PROVIDER_FAMILY_'+family);assert.equal(d.matched,false);
   assert.match(String(d.detailHash),/^[a-f0-9]{64}$/);
   const retained=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify(d)}])[0];
   assert.equal(retained.reason,d.reason);assert.equal(retained.phase,'runtime');
   const serialized=JSON.stringify([error,d,retained]);
   for(const secret of [key,value,'credential-sentinel','secret-sentinel','provider.invalid'])assert.ok(!serialized.includes(secret));
   return true;
  });
  assert.equal(touched,false);
  assert.equal(runtime({...fixture().env,[key]:''}),sha);
 });
}
test('provider diagnostic rejects unknown codes and ignores forged error metadata',()=>{
 assert.throws(()=>check('PROVIDER_FAMILY_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
 const forged=Object.assign(new Error('External provider configuration forbidden'),{reason:'CHECK_PROVIDER_FAMILY_AWS',providerFamily:'AWS',key:'AWS_PRIVATE_SENTINEL',value:'secret-sentinel'});
 assert.equal(diagnostic('runtime',forged).reason,'PROVIDER_DISABLED');
 const retained=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({phase:'runtime',reason:'CHECK_PROVIDER_FAMILY_FORGED',detailHash:h,key:'secret-sentinel'})}])[0];
 assert.notEqual(retained.reason,'CHECK_PROVIDER_FAMILY_FORGED');assert.ok(!JSON.stringify(retained).includes('secret-sentinel'));
});
test('provider family matching preserves case, prefix, exact-key and empty-value admission boundaries',()=>{
 for(const key of ['aws_PRIVATE_SENTINEL','PREFIX_AWS_PRIVATE_SENTINEL','CRON_SECRET_SUFFIX','NEXT_PUBLIC_SITE_URL_SUFFIX','UNRECOGNIZED_PRIVATE_SENTINEL'])assert.equal(runtime({...fixture().env,[key]:'synthetic'}),sha);
 for(const [key] of providerCases)for(const value of ['0','false',' '])assert.throws(()=>runtime({...fixture().env,[key]:value}));
});

test('runtime restrictions are byte-identical to reviewed guard after removing diagnostic wrapper',async()=>{
 const {readFileSync}=await import('node:fs');const {createHash}=await import('node:crypto');
 const source=readFileSync('scripts/staging/hosted-policy.mjs','utf8');
 const guard=source.slice(source.indexOf('export function runtime'),source.indexOf('export function provenance'))
  .replace('check(providerFamily(key),()=>assert.ok(', 'assert.ok(')
  .replace("'External provider configuration forbidden'));", "'External provider configuration forbidden');");
 assert.equal(createHash('sha256').update(guard).digest('hex'),'92fa2e9cda62692e3b1c4041632626ca3ae2ddeedae9808991681c96e7a8940e');
});

const awsKeyCases=[
 ['AWS_ACCESS_KEY_ID','CHECK_PROVIDER_AWS_ACCESS_KEY_ID'],
 ['AWS_SECRET_ACCESS_KEY','CHECK_PROVIDER_AWS_SECRET_ACCESS_KEY'],
 ['AWS_SESSION_TOKEN','CHECK_PROVIDER_AWS_SESSION_TOKEN'],
 ['AWS_SECURITY_TOKEN','CHECK_PROVIDER_AWS_SECURITY_TOKEN'],
 ['AWS_REGION','CHECK_PROVIDER_AWS_REGION'],
 ['AWS_DEFAULT_REGION','CHECK_PROVIDER_AWS_DEFAULT_REGION'],
 ['AWS_PROFILE','CHECK_PROVIDER_AWS_PROFILE'],
 ['AWS_DEFAULT_PROFILE','CHECK_PROVIDER_AWS_DEFAULT_PROFILE'],
 ['AWS_ROLE_ARN','CHECK_PROVIDER_AWS_ROLE_ARN'],
 ['AWS_WEB_IDENTITY_TOKEN_FILE','CHECK_PROVIDER_AWS_WEB_IDENTITY_TOKEN_FILE'],
 ['AWS_SHARED_CREDENTIALS_FILE','CHECK_PROVIDER_AWS_SHARED_CREDENTIALS_FILE'],
 ['AWS_CONFIG_FILE','CHECK_PROVIDER_AWS_CONFIG_FILE'],
 ['AWS_SDK_LOAD_CONFIG','CHECK_PROVIDER_AWS_SDK_LOAD_CONFIG'],
 ['AWS_CONTAINER_CREDENTIALS_RELATIVE_URI','CHECK_PROVIDER_AWS_CONTAINER_CREDENTIALS_RELATIVE_URI'],
 ['AWS_CONTAINER_CREDENTIALS_FULL_URI','CHECK_PROVIDER_AWS_CONTAINER_CREDENTIALS_FULL_URI'],
 ['AWS_CONTAINER_AUTHORIZATION_TOKEN','CHECK_PROVIDER_AWS_CONTAINER_AUTHORIZATION_TOKEN'],
 ['AWS_EXECUTION_ENV','CHECK_PROVIDER_AWS_EXECUTION_ENV'],
 ['AWS_LAMBDA_FUNCTION_NAME','CHECK_PROVIDER_AWS_LAMBDA_FUNCTION_NAME'],
 ['AWS_LAMBDA_FUNCTION_VERSION','CHECK_PROVIDER_AWS_LAMBDA_FUNCTION_VERSION'],
 ['AWS_LAMBDA_LOG_GROUP_NAME','CHECK_PROVIDER_AWS_LAMBDA_LOG_GROUP_NAME'],
 ['AWS_LAMBDA_LOG_STREAM_NAME','CHECK_PROVIDER_AWS_LAMBDA_LOG_STREAM_NAME'],
] as const;
for(const [key,code] of awsKeyCases){
 test('AWS runtime emits only fixed category '+code,async()=>{
  const value='https://private-sentinel:credential-sentinel@secret.invalid/private';
  let touched=false;
  await assert.rejects(executeHosted({metadata:async()=>{touched=true;}},{...fixture().env,[key]:value}),(error:Error & {safeDiagnostic:Record<string,unknown>})=>{
   const d=error.safeDiagnostic;
   assert.deepEqual(Object.keys(d).sort(),['detailHash','matched','phase','reason']);
   assert.equal(d.reason,code);assert.equal(d.phase,'runtime');assert.equal(d.matched,false);
   assert.match(String(d.detailHash),/^[a-f0-9]{64}$/);
   const event=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...d,key,value,url:value})}])[0];
   assert.deepEqual(event,{index:0,type:'stderr',...d});
   // Only the explicitly allowlisted reason may identify the known key category.
   const {reason,...rest}=d;assert.equal(reason,code);
   for(const secret of [key,value,'private-sentinel','credential-sentinel','secret.invalid'])assert.ok(!JSON.stringify(rest).includes(secret));
   assert.ok(!JSON.stringify([error,event]).includes(value));
   return true;
  });
  assert.equal(touched,false);
  assert.equal(runtime({...fixture().env,[key]:''}),sha);
  for(const value of ['0','false',' '])assert.throws(()=>runtime({...fixture().env,[key]:value}));
 });
}
test('unknown AWS keys and near matches remain rejected with one fixed code',()=>{
 for(const key of ['AWS_','AWS_PRIVATE_KEY_SENTINEL','AWS_REGION_SUFFIX','AWS_region','AWS_constructor','AWS___proto__','AWS_\nsecret-sentinel']){
  assert.throws(()=>runtime({...fixture().env,[key]:'credential-sentinel'}),(error:Error)=>{
   const d=diagnostic('runtime',error);assert.equal(d.reason,'CHECK_PROVIDER_AWS_UNKNOWN');
   assert.ok(!JSON.stringify(d).includes('secret-sentinel'));assert.ok(!JSON.stringify(d).includes('credential-sentinel'));return true;
  });
 }
});
test('AWS diagnostics cannot be forged through error properties or unknown event codes',()=>{
 for(const reason of ['CHECK_PROVIDER_AWS_REGION','CHECK_PROVIDER_AWS_FORGED']){
  const error=Object.assign(new Error('External provider configuration forbidden'),{reason,code:reason,key:'AWS_REGION',value:'credential-sentinel',safeDiagnostic:{phase:'runtime',reason,detailHash:h}});
  assert.equal(diagnostic('runtime',error).reason,'PROVIDER_DISABLED');
 }
 assert.throws(()=>check('PROVIDER_AWS_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
 for(const reason of ['CHECK_PROVIDER_AWS_FORGED','CHECK_PROVIDER_AWS_REGION__FORGED']){
  const event=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({phase:'runtime',reason,detailHash:h,value:'credential-sentinel'})}])[0];
  assert.notEqual(event.reason,reason);assert.ok(!JSON.stringify(event).includes('credential-sentinel'));
 }
});
