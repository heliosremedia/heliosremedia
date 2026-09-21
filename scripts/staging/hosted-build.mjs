// Native Vercel build entry. No migrate/deploy/resolve/db-push command exists here.
import assert from 'node:assert/strict';
import {diagnostic} from './actions/diagnostics.mjs';
import {readFile,readdir,access,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {hostedDigest} from './hosted-digest.mjs';
import {runtime,provenance,receipt,HOSTED} from './hosted-policy.mjs';
import {TARGET,jsonGet,targetConnection} from './policy.mjs';
import {schemaSnapshot,readLedger,classify,hash} from '../migrations/bootstrap/inspect.mjs';
import {BASELINE_CHECKSUM,CURRENT_SCHEMA} from '../release/policy.mjs';
import {generatedClientCheck} from '../release/gate.mjs';
export async function databaseState(db,manifest){
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
  assert.equal((await db.query('SELECT current_database() name')).rows[0].name,TARGET.database);
  assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
  const schema=await schemaSnapshot(db),ledger=await readLedger(db);
  assert.equal(hash(schema),CURRENT_SCHEMA,'Unreviewed schema');
  const state=classify({ledger,schema,current:schema,historical:{},manifest,baselineChecksum:BASELINE_CHECKSUM});
  assert.equal(state.state,'current-compatible-ledger');assert.equal(state.track,'baseline');
  await db.query('COMMIT');return {...state,schemaHash:hash(schema),ledgerHash:hash(ledger)};
 }catch(e){await db.query('ROLLBACK');throw e;}
}
export async function executeHosted(deps,env){
 let phase='runtime';
 try {
  const candidate=runtime(env);
  phase='provider-provenance';const proof=provenance(await deps.metadata(),env);
  phase='source-integrity';const identity=await deps.source(candidate);
  phase='database-preflight';const before=await deps.inspect();
  assert.equal(before.state,'current-compatible-ledger');assert.equal(before.track,'baseline');
  phase='application-build';await deps.build();
  phase='database-postflight';const after=await deps.inspect();
  phase='artifact-digest';const result=receipt(proof,before,after,identity,await deps.digest());
  phase='receipt-persistence';await deps.persist(result);return result;
 } catch(error) {const safe=new Error('STAGING_HOSTED_BUILD_BLOCKED');safe.safeDiagnostic=diagnostic(phase,error);throw safe;}

}
export async function main(env=process.env){
 let db;
 try{
  runtime(env);
  const v='https://api.vercel.com',team='?teamId='+HOSTED.team,g='https://api.github.com/repos/heliosremedia/heliosremedia';
  let manifest;
  const result=await executeHosted({
   metadata:async()=>{
    const get=url=>jsonGet(url,env.STAGING_VERCEL_READ_TOKEN),gh=url=>jsonGet(url,env.STAGING_GITHUB_READ_TOKEN);
    const [project,deployment,domains,run,jobs]=await Promise.all([get(v+'/v9/projects/'+HOSTED.project+team),get(v+'/v13/deployments/'+encodeURIComponent(env.VERCEL_DEPLOYMENT_ID)+team),get(v+'/v9/projects/'+HOSTED.project+'/domains'+team),gh(g+'/actions/runs/'+env.STAGING_RELEASE_RUN_ID),gh(g+'/actions/runs/'+env.STAGING_RELEASE_RUN_ID+'/jobs')]);
    const n='https://console.neon.tech/api/v2/projects/'+TARGET.project,ng=url=>jsonGet(url,env.STAGING_NEON_API_KEY);
    const [p,b,e,d]=await Promise.all([ng(n),ng(n+'/branches/'+TARGET.branch),ng(n+'/endpoints'),ng(n+'/branches/'+TARGET.branch+'/databases')]);
    const connection=targetConnection({project:p.project,branch:b.branch,endpoints:e.endpoints,databases:d.databases},env.DIRECT_URL);
    db=new pg.Client(connection);await db.connect();assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true);return {project,deployment,domains,run,jobs};
   },
   source:async candidate=>{
    assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidate);execFileSync('git',['diff','--quiet','HEAD','--']);
    for(const name of ['.env','.env.local','.env.production','.env.production.local']){let exists=true;try{await access(name);}catch{exists=false;}assert.equal(exists,false,'Environment file not allowed');}
    const raw=await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8');assert.equal(hash(raw),'8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a');manifest=JSON.parse(raw);
    assert.deepEqual((await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort(),Object.keys(manifest).sort());
    for(const [name,h] of Object.entries(manifest))assert.equal(hash(await readFile('prisma/migrations/'+name+'/migration.sql','utf8')),h);
    const schema=hash(await readFile('prisma/schema.prisma','utf8'));assert.equal(schema,'ede3650c4b65f8704a125672ed32f7b7110a78a83cdacf14744e6419d02a0892');
    return {migrationManifest:hash(raw),prismaSchema:schema,baselineChecksum:BASELINE_CHECKSUM,lockfile:hash(await readFile('package-lock.json','utf8'))};
   },
   inspect:()=>databaseState(db,manifest),
   build:()=>buildApplication(env),
   digest:()=>hostedDigest(),
   persist:async result=>{await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/hosted-build.json',JSON.stringify(result,null,2)+'\n');},
  },env);
  console.log('STAGING_BUILD_RECEIPT '+JSON.stringify(result));
 }catch(error){console.error('STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify(error.safeDiagnostic||diagnostic('runtime',error)));process.exitCode=1;}
 finally{if(db)await db.end().catch(()=>{});}
}

export async function buildApplication(env){
    // Admission credentials never enter the Next child process.
    const child={PATH:env.PATH,HOME:env.HOME,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:env.DATABASE_URL,DIRECT_URL:env.DIRECT_URL,AUTH_SECRET:env.AUTH_SECRET,STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:HOSTED.project,STAGING_HOSTED_ADMISSION:'preview-only',VERCEL_URL:env.VERCEL_URL};
    for(const pkg of ['prisma','@prisma/client'])assert.equal(JSON.parse(await readFile('node_modules/'+pkg+'/package.json','utf8')).version,'7.8.0');
    execFileSync(process.execPath,['node_modules/prisma/build/index.js','generate'],{env:child,stdio:'pipe'});
    await generatedClientCheck(process.cwd());
    execFileSync(process.execPath,['node_modules/next/dist/bin/next','build'],{env:child,stdio:'pipe'});
}
