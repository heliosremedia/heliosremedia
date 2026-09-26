// Credential-free, fixed-loopback rehearsal. Never accepts a database URL or cloud token.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {HOSTED} from './hosted-policy.mjs';
import {executeHosted,databaseState,buildApplication} from './hosted-build.mjs';
import {databaseUrl} from '../migrations/bootstrap/artifact.mjs';
import {hostedDigest} from './hosted-digest.mjs';
import {readFile} from 'node:fs/promises';
assert.equal(process.env.PACKET12_REHEARSAL,'isolated-only');
for(const k of ['VERCEL','VERCEL_ENV','STAGING_NEON_API_KEY','STAGING_VERCEL_READ_TOKEN','STAGING_GITHUB_READ_TOKEN'])assert.ok(!process.env[k]);
const admin=new pg.Client({connectionString:databaseUrl('packet11_control')});await admin.connect();
let db;
try{
 await admin.query('CREATE DATABASE helios_v2_staging TEMPLATE packet11_noledger');
 const local='postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/helios_v2_staging';
 db=new pg.Client({connectionString:local});await db.connect();
 const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const env={STAGING_HOSTED_ADMISSION:'preview-only',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:HOSTED.project,VERCEL_ORG_ID:HOSTED.team,VERCEL_GIT_COMMIT_REF:HOSTED.branch,VERCEL_GIT_COMMIT_SHA:candidate,STAGING_CANDIDATE_SHA:candidate,STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',AUTH_SECRET:'a'.repeat(96),STAGING_RELEASE_RUN_ID:'123',DATABASE_URL:'postgresql://synthetic:synthetic@ep-crimson-snow-araflu1k.c-4.us-west-2.aws.neon.tech/helios_v2_staging?sslmode=require',DIRECT_URL:'',VERCEL_DEPLOYMENT_ID:'dpl_fixture',VERCEL_URL:'helios-v2-staging-fixture.vercel.app'};env.DIRECT_URL=env.DATABASE_URL;
 const manifest=JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8'));
 const result=await executeHosted({
  metadata:async()=>({project:{id:HOSTED.project,name:'helios-v2-staging',accountId:HOSTED.team,link:{repoId:HOSTED.repository,type:'github'}},deployment:{projectId:HOSTED.project,ownerId:HOSTED.team,target:null,readyState:'BUILDING',id:env.VERCEL_DEPLOYMENT_ID,url:env.VERCEL_URL,gitSource:{type:'github',repoId:HOSTED.repository,sha:candidate,ref:HOSTED.branch}},domains:{domains:[{name:'helios-v2-staging.vercel.app'}]},run:{id:123,repository:{full_name:'heliosremedia/heliosremedia'},head_sha:candidate,head_branch:HOSTED.branch,path:'.github/workflows/v2-regression.yml',event:'push',status:'completed',conclusion:'success',run_attempt:1},jobs:{total_count:1,jobs:[{name:'Tests and TypeScript',conclusion:'success',steps:[{name:'Run isolated regression tests',conclusion:'success'}]}]}}),
  source:async()=>({rehearsal:'synthetic-provider-metadata-real-local-build'}),
  inspect:()=>databaseState(db,manifest),
  build:()=>buildApplication({...env,PATH:process.env.PATH,HOME:process.env.HOME,DATABASE_URL:local,DIRECT_URL:local}),
  digest:()=>hostedDigest(),
  persist:async r=>{await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/hosted-isolated.json',JSON.stringify({...r,mode:'isolated-synthetic-provenance',deployable:false},null,2)+'\n');},
 },env);
 assert.equal(result.promotable,false);
 console.log('PASS real Next build + generated client + PostgreSQL16 schema/ledger postflight; synthetic provider metadata ONLY');
}finally{if(db)await db.end();await admin.end();}
