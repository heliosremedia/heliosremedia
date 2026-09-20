// Manual exact-target bootstrap only. Never deployment admission or a generic migration CLI.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {TARGET,ENVIRONMENT,invocation,protection,targetConnection,jsonGet} from './policy.mjs';
import {sourceIdentity} from '../release/gate.mjs';
import {admission} from '../release/policy.mjs';
import {inspect} from '../migrations/bootstrap/inspect.mjs';
let db;
try {
 const candidate=invocation(process.env);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidate);
 execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});
 const api='https://api.github.com/repos/heliosremedia/heliosremedia/environments/'+ENVIRONMENT;
 const github=process.env.STAGING_GITHUB_READ_TOKEN||process.env.GITHUB_TOKEN;
 const environment=await jsonGet(api,github),branches=await jsonGet(api+'/deployment-branch-policies',github);
 protection(environment,branches);
 const context=JSON.parse(await readFile('.packet12-context.json','utf8'));
 assert.equal(context.candidate,candidate);
 const identity=await sourceIdentity(context.artifact,context.reference);
 const tests=JSON.parse(await readFile('release-evidence/tests.json','utf8'));
 assert.equal(tests.candidate,candidate);assert.equal(tests.status,'passed');assert.equal(tests.failed,0);assert.ok(tests.count>0);
 const base='https://console.neon.tech/api/v2/projects/'+TARGET.project,token=process.env.STAGING_NEON_API_KEY;
 const project=await jsonGet(base,token),branch=await jsonGet(base+'/branches/'+TARGET.branch,token);
 const endpoints=await jsonGet(base+'/endpoints',token),databases=await jsonGet(base+'/branches/'+TARGET.branch+'/databases',token);
 const connection=targetConnection({project:project.project,branch:branch.branch,endpoints:endpoints.endpoints,databases:databases.databases},process.env.STAGING_DIRECT_URL);
 db=new pg.Client(connection);await db.connect();
 assert.equal((await db.query('SELECT current_database() name')).rows[0].name,TARGET.database);
 assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true);
 const before=await inspect(db,context.reference);admission(before,process.env.STAGING_TRACK);
 // Only the checksum-verified generated baseline directory is passed to actual Prisma.
 // Suppress raw Prisma output/errors: they may contain credentials or provider diagnostics.
 async function deploy(){
  const code=await new Promise((resolve,reject)=>{
   const p=spawn(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--config',context.artifact.dir+'/prisma.config.ts'],{
    env:{PATH:process.env.PATH,HOME:process.env.HOME,DIRECT_URL:process.env.STAGING_DIRECT_URL},stdio:'ignore'});
   const timeout=setTimeout(()=>{p.kill('SIGTERM');},300000);
   p.on('error',reject);p.on('exit',code=>{clearTimeout(timeout);resolve(code);});
  });assert.equal(code,0,'Prisma failed; stop and inspect ledger read-only, never auto-repair');
 }
 await deploy();const after=await inspect(db,context.reference);admission(after,'current-baseline');
 await deploy();const repeated=await inspect(db,context.reference);assert.equal(repeated.ledgerHash,after.ledgerHash);assert.equal(repeated.schemaHash,after.schemaHash);
 const safe=s=>({state:s.state,track:s.track,schemaHash:s.schemaHash,ledgerHash:s.ledgerHash,entries:s.ledger.length});
 await mkdir('staging-evidence',{recursive:true});await writeFile('staging-evidence/bootstrap.json',JSON.stringify({version:1,candidate,target:TARGET,identity,observedAt:new Date().toISOString(),before:safe(before),after:safe(after),repeatNoop:true,deployable:false,applicationVerified:false},null,2)+'\n');
 console.log('PASS staging bootstrap, exact schema/ledger, repeated no-op; NOT application/deployment admission');
} catch {
 console.error('STAGING_BOOTSTRAP_BLOCKED: no automatic retry/repair. Review protected configuration and read-only ledger. Raw diagnostics suppressed.');process.exitCode=1;
} finally {if(db)await db.end().catch(()=>{});}
