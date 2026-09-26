// Separate manual qualification: never migrates, deploys, deletes or repairs data.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {TARGET,ENVIRONMENT,invocation,protection,targetConnection,jsonGet} from './policy.mjs';
import {sourceIdentity} from '../release/gate.mjs';
import {admission} from '../release/policy.mjs';
import {inspect} from '../migrations/bootstrap/inspect.mjs';
import {databaseUrl} from '../migrations/bootstrap/artifact.mjs';
import {bundle} from './tenant/bundle.mjs';
let db;
const isolated=process.argv[2]==='--isolated';
try {
 assert.ok(process.argv.length===(isolated?3:2));
 let candidate,connection;
 if(isolated){
  assert.equal(process.env.PACKET12_REHEARSAL,'isolated-only');
  candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  connection={connectionString:databaseUrl('packet11_noledger')};
 } else {
  candidate=invocation(process.env);assert.equal(process.env.STAGING_TRACK,'current-baseline');
  assert.equal(process.env.STAGING_TENANT_CONFIRMATION,'seed-synthetic-tenants-only');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),candidate);
  execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});
  const api='https://api.github.com/repos/heliosremedia/heliosremedia/environments/'+ENVIRONMENT;
  const github=process.env.STAGING_GITHUB_READ_TOKEN||process.env.GITHUB_TOKEN;
  protection(await jsonGet(api,github),await jsonGet(api+'/deployment-branch-policies',github));
  const base='https://console.neon.tech/api/v2/projects/'+TARGET.project,token=process.env.STAGING_NEON_API_KEY;
  const project=await jsonGet(base,token),branch=await jsonGet(base+'/branches/'+TARGET.branch,token);
  const endpoints=await jsonGet(base+'/endpoints',token),databases=await jsonGet(base+'/branches/'+TARGET.branch+'/databases',token);
  connection=targetConnection({project:project.project,branch:branch.branch,endpoints:endpoints.endpoints,databases:databases.databases},process.env.STAGING_DIRECT_URL);
 }
 const context=JSON.parse(await readFile('.packet12-context.json','utf8'));assert.equal(context.candidate,candidate);
 const identity=await sourceIdentity(context.artifact,context.reference);
 const tests=JSON.parse(await readFile('release-evidence/tests.json','utf8'));
 assert.equal(tests.candidate,candidate);assert.equal(tests.status,'passed');assert.equal(tests.failed,0);assert.ok(tests.count>0);
 db=new pg.Client(connection);await db.connect();
 assert.equal((await db.query('SELECT current_database() name')).rows[0].name,isolated?'packet11_noledger':TARGET.database);
 assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
 assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true);
 const before=await inspect(db,context.reference);admission(before,'current-baseline');
 await bundle();const {qualify}=await import('../../.packet16-tenant-driver.mjs');
 // Prevent route error handlers from exposing raw database diagnostics. No values are logged.
 const error=console.error;console.error=()=>{};
 let qualification;
 try{qualification=await qualify(connection);if(isolated)await qualify(connection);}finally{console.error=error;}
 const after=await inspect(db,context.reference);admission(after,'current-baseline');
 assert.equal(after.ledgerHash,before.ledgerHash);assert.equal(after.schemaHash,before.schemaHash);
 await mkdir('staging-evidence',{recursive:true});
 await writeFile('staging-evidence/'+(isolated?'tenant-isolated':'tenant-neon')+'.json',JSON.stringify({version:1,candidate,target:isolated?'disposable-local-postgresql16':TARGET,identity,observedAt:new Date().toISOString(),qualification,schemaHash:after.schemaHash,ledgerHash:after.ledgerHash,ledgerUnchanged:true,deployable:false,hostedApplicationVerified:false},null,2)+'\n');
 console.log('PASS '+(isolated?'isolated repeatability':'Neon')+' tenant route/service qualification; schema/ledger unchanged; NOT hosted HTTP or deployment admission');
}catch(error){
 // Only the fixed credential-free loopback harness can expose diagnostics.
 if(isolated&&process.env.PACKET12_REHEARSAL==='isolated-only')console.error(error);
 console.error('STAGING_TENANT_QUALIFICATION_BLOCKED: no retry, repair, deletion or deployment. Review protected inputs and synthetic fixture state. Raw diagnostics suppressed.');process.exitCode=1;
}finally{if(db)await db.end().catch(()=>{});}
