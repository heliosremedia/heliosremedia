import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {vercelClient} from './vercel.mjs';
import {execute} from './executor.mjs';
import {HOSTED,CANDIDATE,RELEASE_RUN,IGNORE,project,deployment,createRequest,environmentInventory,invocation} from './policy.mjs';
import {diagnostic,eventsSummary,check,checked} from './diagnostics.mjs';
import {TARGET,ENVIRONMENT,protection,jsonGet,targetConnection} from '../policy.mjs';
import {databaseState} from '../hosted-build.mjs';
import {hostnameBindings} from '../hosted-policy.mjs';
import {digest} from '../../release/policy.mjs';
import {qualifyHTTP} from './http.mjs';
const env=process.env,projectPath='/v9/projects/'+HOSTED.project;
let db,before,bindings=[];const secret=randomBytes(48).toString('hex');
const manifest=JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8'));
// Construct lazily so missing secrets are reported only through safe diagnostics.
const api=(...args)=>vercelClient(env.STAGING_VERCEL_TOKEN)(...args);
async function suppress(){const p=await api(projectPath);check('RESTORE_PROJECT_ID', ()=>assert.equal(p.id,HOSTED.project));check('RESTORE_TEAM_ID', ()=>assert.equal(p.accountId,HOSTED.team));await api(projectPath,'PATCH',{commandForIgnoringBuildStep:'exit 0'});await checked('RESTORE_SUPPRESSION', async ()=>assert.equal((await api(projectPath)).commandForIgnoringBuildStep,'exit 0'));}
async function footprint(){
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'")).rows;
 const expected=new Set(['Workspace','AdminUser','WorkspaceMembership','SiteSettings','Project','HomepageProject','WorkspaceDomain']);
 for(const {tablename:t} of tables){check('FIXTURE_TABLE_NAME', ()=>assert.match(t,/^[A-Za-z_]+$/));await checked('FIXTURE_TABLE_COUNT', async ()=>assert.equal(Number((await db.query('SELECT count(*) n FROM "'+t+'"')).rows[0].n),expected.has(t)?2:0,'Unexpected fixture data'));}
 for(const id of ['packet16-a','packet16-b']){
  await checked('FIXTURE_WORKSPACE', async ()=>assert.equal((await db.query('SELECT id FROM "Workspace" WHERE id=$1',[id])).rowCount,1));
  await checked('FIXTURE_OWNER_MEMBERSHIP', async ()=>assert.equal((await db.query('SELECT u.id FROM "AdminUser" u JOIN "WorkspaceMembership" m ON m."userId"=u.id AND m."workspaceId"=u."workspaceId" WHERE u.id=$1 AND u."workspaceId"=$2 AND u.email=$3 AND u.active=true AND u.role=$4 AND u."passwordHash" IS NULL AND u."sessionVersion"=1 AND m.status=$5 AND m.role=$4',[id+'-owner',id,id+'@example.test','OWNER','ACTIVE'])).rowCount,1));
  await checked('FIXTURE_SETTINGS', async ()=>assert.equal((await db.query('SELECT id FROM "SiteSettings" WHERE id=$1 AND "workspaceId"=$2',[id+'-settings',id])).rowCount,1));
  await checked('FIXTURE_PROJECT_PARENT', async ()=>assert.equal((await db.query('SELECT h.id FROM "HomepageProject" h JOIN "Project" p ON p.id=h."projectId" WHERE h.id=$1 AND p.id=$2 AND p."workspaceId"=$3',[id+'-placement',id+'-project',id])).rowCount,1));
 }
}
async function unbind(){if(!db)return;await db.query('BEGIN');try{for(const b of bindings){const r=await db.query('UPDATE "WorkspaceDomain" SET hostname=$1 WHERE "workspaceId"=$2 AND hostname=$3',[b.workspaceId+'.example.test',b.workspaceId,b.hostname]);if(r.rowCount===0)await checked('RESTORE_HOSTNAME', async ()=>assert.equal((await db.query('SELECT id FROM "WorkspaceDomain" WHERE "workspaceId"=$1 AND hostname=$2',[b.workspaceId,b.workspaceId+'.example.test'])).rowCount,1));else check('RESTORE_HOSTNAME_COUNT', ()=>assert.equal(r.rowCount,1));}await db.query('COMMIT');bindings=[];}catch(e){await db.query('ROLLBACK');throw e;}}
async function unconfigure(){
 // Discover only this run's newly-created rows, including an uncertain POST response.
 const rows=(await api(projectPath+'/env')).envs;for(const r of rows){if(r.comment===marker&&r.gitBranch===HOSTED.branch&&JSON.stringify(r.target)==='["preview"]'){await api(projectPath+'/env/'+encodeURIComponent(r.id),'DELETE');}}

}
const marker='packet16-actions-'+env.GITHUB_RUN_ID;
async function events(id){return api('/v3/deployments/'+id+'/events');}
try{
 invocation(env);check('VERCEL_CREDENTIAL_PRESENCE', ()=>assert.ok(env.STAGING_VERCEL_TOKEN));check('EXECUTOR_CHECKOUT_SHA', ()=>assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),env.GITHUB_SHA));
 check('CANDIDATE_CHECKOUT_SHA', ()=>assert.equal(execFileSync('git',['-C','.candidate','rev-parse','HEAD'],{encoding:'utf8'}).trim(),CANDIDATE));
 check('CANDIDATE_CHECKOUT_CLEAN', ()=>execFileSync('git',['-C','.candidate','diff','--quiet','HEAD','--']));
 if(process.argv[2]==='--restore-suppression'){const journal=JSON.parse(await readFile('staging-evidence/restoration-needed.json','utf8'));check('RESTORE_JOURNAL_RUN', ()=>assert.equal(journal.run,env.GITHUB_RUN_ID));check('RESTORE_JOURNAL_EXECUTOR', ()=>assert.equal(journal.executor,env.GITHUB_SHA));await suppress();console.log('STAGING_SUPPRESSION_RESTORED');}
 else{check('EXECUTOR_ARGUMENTS', ()=>assert.equal(process.argv.length,2));await execute({
  preflight:async()=>{
   const gh=env.STAGING_GITHUB_READ_TOKEN||env.GITHUB_TOKEN,g='https://api.github.com/repos/heliosremedia/heliosremedia';
   protection(await checked('GITHUB_ENVIRONMENT_READ', async()=>jsonGet(g+'/environments/'+ENVIRONMENT,gh)),await checked('GITHUB_BRANCH_POLICY_READ', async()=>jsonGet(g+'/environments/'+ENVIRONMENT+'/deployment-branch-policies',gh)));
   const run=await checked('GITHUB_RUN_READ', async()=>jsonGet(g+'/actions/runs/'+RELEASE_RUN,gh));check('GITHUB_RUN_SHA', ()=>assert.equal(run.head_sha,CANDIDATE));check('GITHUB_RUN_BRANCH', ()=>assert.equal(run.head_branch,HOSTED.branch));check('GITHUB_RUN_STATUS', ()=>assert.equal(run.status,'completed'));check('GITHUB_RUN_CONCLUSION', ()=>assert.equal(run.conclusion,'success'));check('GITHUB_RUN_WORKFLOW', ()=>assert.equal(run.path,'.github/workflows/v2-regression.yml'));
   project(await checked('VERCEL_PROJECT_READ', async()=>api(projectPath)),await checked('VERCEL_DOMAINS_READ', async()=>api(projectPath+'/domains')));environmentInventory((await checked('VERCEL_ENVIRONMENT_READ', async()=>api(projectPath+'/env'))).envs);
   const n='https://console.neon.tech/api/v2/projects/'+TARGET.project,t=env.STAGING_NEON_API_KEY;
   const [p,b,e,d]=await Promise.all([checked('NEON_PROJECT_READ', async()=>jsonGet(n,t)),checked('NEON_BRANCH_READ', async()=>jsonGet(n+'/branches/'+TARGET.branch,t)),checked('NEON_ENDPOINTS_READ', async()=>jsonGet(n+'/endpoints',t)),checked('NEON_DATABASES_READ', async()=>jsonGet(n+'/branches/'+TARGET.branch+'/databases',t))]);
   db=new pg.Client(targetConnection({project:p.project,branch:b.branch,endpoints:e.endpoints,databases:d.databases},env.STAGING_DIRECT_URL));await checked('DATABASE_CONNECTION', async()=>db.connect());
   await checked('DATABASE_ADVISORY_LOCK', async ()=>assert.equal((await db.query('SELECT pg_try_advisory_lock(1200320) locked')).rows[0].locked,true));before=await checked('DATABASE_STATE', async()=>databaseState(db,manifest));await checked('FIXTURE_STATE', async()=>footprint());
   for(const id of ['packet16-a','packet16-b'])await checked('FIXTURE_HOSTNAME', async ()=>assert.equal((await db.query('SELECT id FROM "WorkspaceDomain" WHERE "workspaceId"=$1 AND hostname=$2 AND status=$3 AND purpose=$4',[id,id+'.example.test','ACTIVE','PUBLIC_SITE'])).rowCount,1));
   await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/restoration-needed.json',JSON.stringify({run:env.GITHUB_RUN_ID,executor:env.GITHUB_SHA}));return before;
  },
  configure:async()=>{
   const vars={DATABASE_URL:env.STAGING_DIRECT_URL,DIRECT_URL:env.STAGING_DIRECT_URL,AUTH_SECRET:secret,STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',STAGING_HOSTED_ADMISSION:'preview-only',STAGING_CANDIDATE_SHA:CANDIDATE,STAGING_RELEASE_RUN_ID:String(RELEASE_RUN),STAGING_VERCEL_READ_TOKEN:env.STAGING_VERCEL_TOKEN,STAGING_GITHUB_READ_TOKEN:env.STAGING_GITHUB_READ_TOKEN||env.GITHUB_TOKEN,STAGING_NEON_API_KEY:env.STAGING_NEON_API_KEY,VERCEL_ORG_ID:HOSTED.team,VERCEL_PROJECT_ID:HOSTED.project};
   for(const [key,value] of Object.entries(vars)){assert.ok(value);const row=await api('/v10/projects/'+HOSTED.project+'/env','POST',{key,value,type:'encrypted',target:['preview'],gitBranch:HOSTED.branch,comment:marker});assert.ok(row.id||row.created);}
   await api(projectPath,'PATCH',{commandForIgnoringBuildStep:IGNORE});assert.equal((await api(projectPath)).commandForIgnoringBuildStep,IGNORE);
  },
  create:async()=>{const d=await api('/v13/deployments','POST',createRequest());return d;},
  wait:async id=>{for(let i=0;i<90;i++){const d=await api('/v13/deployments/'+id);deployment(d,id);if(['READY','ERROR','CANCELED'].includes(d.readyState))return d;await new Promise(r=>setTimeout(r,10000));}throw Error('Build timeout');},
  receipt:async id=>{
   const logs=await events(id);check('BUILD_RECEIPT_EVENT_ARRAY',()=>assert.ok(Array.isArray(logs)));const lines=logs.map(e=>e.text||e.payload?.text||'').filter(s=>s.startsWith('STAGING_BUILD_RECEIPT '));check('BUILD_RECEIPT_COUNT',()=>assert.equal(lines.length,1));
   const raw=check('BUILD_RECEIPT_JSON_PARSE',()=>JSON.parse(lines[0].slice('STAGING_BUILD_RECEIPT '.length))),{checksum,...body}=raw;check('BUILD_RECEIPT_CHECKSUM',()=>assert.equal(digest(body),checksum));
   check('BUILD_RECEIPT_CANDIDATE',()=>assert.equal(raw.candidate,CANDIDATE));check('BUILD_RECEIPT_DEPLOYMENT',()=>assert.equal(raw.deployment,id));check('BUILD_RECEIPT_PROJECT',()=>assert.equal(raw.project,HOSTED.project));check('BUILD_RECEIPT_TEAM',()=>assert.equal(raw.team,HOSTED.team));check('BUILD_RECEIPT_ENVIRONMENT',()=>assert.equal(raw.environment,'preview'));check('BUILD_RECEIPT_TEST_RUN',()=>assert.equal(raw.tests.run,RELEASE_RUN));
   check('BUILD_RECEIPT_DATABASE_TARGET',()=>assert.deepEqual(raw.database,TARGET));check('BUILD_RECEIPT_SCHEMA_HASH',()=>assert.equal(raw.schemaHash,before.schemaHash));check('BUILD_RECEIPT_LEDGER_HASH',()=>assert.equal(raw.ledgerHash,before.ledgerHash));check('BUILD_RECEIPT_DIGEST_FORMAT',()=>assert.match(raw.buildDigest,/^[a-f0-9]{64}$/));
   return {candidate:CANDIDATE,deployment:id,buildDigest:raw.buildDigest,schemaHash:raw.schemaHash,ledgerHash:raw.ledgerHash,checksum};
  },
  qualify:async d=>{
   const hosts=[...new Set([d.url,...(d.alias||[])])];assert.ok(hosts.length>=2,'Two provider-owned hosts required');
   const plan=hostnameBindings(d,['packet16-a','packet16-b'].map((workspaceId,i)=>({workspaceId,hostname:hosts[i]})));
   bindings=plan;await db.query('BEGIN');try{for(const b of plan){const r=await db.query('UPDATE "WorkspaceDomain" SET hostname=$1 WHERE "workspaceId"=$2 AND hostname=$3',[b.hostname,b.workspaceId,b.workspaceId+'.example.test']);assert.equal(r.rowCount,1);}await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
   return qualifyHTTP(db,bindings,secret,env.STAGING_VERCEL_BYPASS_SECRET);
  },suppress,unbind,unconfigure,
  postflight:async()=>{await footprint();return databaseState(db,manifest);},
  diagnostics:async id=>eventsSummary(await events(id)),
  persist:async result=>{await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/hosted-actions.json',JSON.stringify(result,null,2)+'\n');},
 },env);console.log('STAGING_HOSTED_QUALIFICATION_PASSED');}
}catch(error){console.error(JSON.stringify(diagnostic('executor',error)));process.exitCode=1;}
finally{if(db)await db.end().catch(()=>{});}
