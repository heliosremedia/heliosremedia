// Disposable PostgreSQL rehearsal only. No live target, credentials or admission changes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, writeFile, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {prepareArtifact, prisma, databaseUrl, command} from '../../migrations/bootstrap/artifact.mjs';
import {schemaSnapshot, readLedger, hash, inspect} from '../../migrations/bootstrap/inspect.mjs';
import {verifyPrismaModel} from '../../migrations/bootstrap/equivalence.mjs';
import {snapshot} from '../restoration/core.mjs';
import {CURRENT_SCHEMA, BASELINE_CHECKSUM} from '../../release/policy.mjs';

assert.equal(process.env.STUDIO_STAGING_UPGRADE, 'isolated-only');
assert.equal(process.env.PACKET11_REHEARSAL, 'isolated-only');
assert.ok(!process.env.VERCEL && !process.env.STAGING_DIRECT_URL && !process.env.HELIOS_RELEASE_TARGET);
const root=process.cwd();
assert.equal((await readdir(root)).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0);
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('git',['diff','--quiet','HEAD','--']);
const hostedSource='2999055b2b59467fcfef446c33a47212e72d4712';
const scratch=await mkdtemp(join(tmpdir(),'studio-staging-upgrade-'));
const old=join(scratch,'hosted-source');
const extensions=JSON.parse(await readFile('scripts/rehearsal/staging-upgrade/migrations.json','utf8'));
const manifest=JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8'));
assert.equal(hash(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8')),'8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a');
assert.equal(Object.keys(extensions).length,6);
assert.deepEqual((await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort(),[...Object.keys(manifest),...Object.keys(extensions)].sort());
for(const [name,checksum] of Object.entries({...manifest,...extensions}))
  assert.equal(hash(await readFile('prisma/migrations/'+name+'/migration.sql','utf8')),checksum,'Immutable migration '+name);
const control=new pg.Client({connectionString:databaseUrl('packet11_control')});
const clients=[];
async function connect(name){const db=new pg.Client({connectionString:databaseUrl(name)});await db.connect();clients.push(db);return db;}
try {
  await control.connect();
  assert.equal(Math.floor(Number((await control.query('SHOW server_version_num')).rows[0].server_version_num)/10000),16);
  assert.equal((await control.query('SELECT datname FROM pg_database WHERE datname=ANY($1::text[])',[['packet11_clean','packet11_model']])).rows.length,0,'Refuse existing rehearsal databases');
  for(const name of ['packet11_clean','packet11_model'])await control.query('CREATE DATABASE "'+name+'"');
  execFileSync('git',['worktree','add','--detach',old,hostedSource],{stdio:'pipe'});
  await symlink(join(root,'node_modules'),join(old,'node_modules'),'dir');
  let artifact;
  process.chdir(old);
  try {artifact=await prepareArtifact(join(scratch,'artifact'));await artifact.expand();}
  finally {process.chdir(root);}
  assert.equal(artifact.baselineChecksum,BASELINE_CHECKSUM);
  const db=await connect('packet11_clean');
  await prisma(artifact,'packet11_clean',['migrate','deploy']);
  const beforeSchema=await schemaSnapshot(db),beforeLedger=await readLedger(db);
  assert.equal(hash(beforeSchema),CURRENT_SCHEMA,'Reproduce last hosted catalog before extension');
  const admission=await inspect(db,{current:beforeSchema,historical:{},manifest,baselineChecksum:BASELINE_CHECKSUM});
  assert.equal(admission.state,'current-compatible-ledger');assert.equal(admission.track,'baseline');
  assert.equal(beforeLedger.length,19);
  // Stored private project data in two companies must survive the upgrade exactly.
  for(const id of ['upgrade-a','upgrade-b']) {
    await db.query('INSERT INTO "Workspace" (id,name,slug,"updatedAt") VALUES ($1,$1,$1,$2)',[id,'2026-09-26T12:00:00Z']);
    await db.query('INSERT INTO "Project" (id,"workspaceId",title,slug,status,"updatedAt") VALUES ($1,$2,$1,$1,\'DRAFT\',$3)',[id+'-project',id,'2026-09-26T12:00:00Z']);
  }
  const beforeData=await snapshot(db);
  for(const name of Object.keys(extensions).sort()) {
    await mkdir(join(artifact.dir,'migrations',name));
    await writeFile(join(artifact.dir,'migrations',name,'migration.sql'),await readFile('prisma/migrations/'+name+'/migration.sql'));
  }
  await prisma(artifact,'packet11_clean',['migrate','deploy']);
  const afterSchema=await schemaSnapshot(db),afterLedger=await readLedger(db),afterData=await snapshot(db);
  assert.deepEqual(afterLedger.filter(r=>!Object.hasOwn(extensions,r.migration_name)),beforeLedger,'Existing ledger rows unchanged');
  const added=afterLedger.filter(r=>Object.hasOwn(extensions,r.migration_name));
  assert.equal(added.length,6);
  for(const r of added){assert.equal(r.checksum,extensions[r.migration_name]);assert.ok(r.finished_at&&!r.rolled_back_at&&r.applied_steps_count>0);}
  for(const [table,rows] of Object.entries(beforeData)) {
    if(table==='_prisma_migrations')continue;
    const normalized=structuredClone(afterData[table]);
    if(table==='Workspace')for(const row of normalized){assert.equal(row.lifecycleState,'ACTIVE');assert.equal(row.lifecycleRevision,0);assert.equal(row.lastReactivatedAt,null);delete row.lifecycleState;delete row.lifecycleRevision;delete row.lastReactivatedAt;}
    assert.deepEqual(normalized,rows,'Stored rows retained: '+table);
  }
  for(const table of Object.keys(afterData).filter(t=>!Object.hasOwn(beforeData,t)))assert.deepEqual(afterData[table],[],'No implicit enrollment: '+table);
  const model=await connect('packet11_model');
  const sql=await command(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{DIRECT_URL:databaseUrl('packet11_control')});
  await model.query(sql);
  verifyPrismaModel(afterSchema,await schemaSnapshot(model));
  await prisma(artifact,'packet11_clean',['migrate','deploy']);
  assert.deepEqual(await readLedger(db),afterLedger,'Second deployment is a no-op');
  assert.deepEqual(await schemaSnapshot(db),afterSchema);
  assert.deepEqual(await snapshot(db),afterData);
  await mkdir('staging-evidence',{recursive:true});
  await writeFile('staging-evidence/current-upgrade.json',JSON.stringify({candidate,hostedSource,result:'passed',baselineChecksum:BASELINE_CHECKSUM,beforeSchemaHash:hash(beforeSchema),afterSchemaHash:hash(afterSchema),beforeLedgerHash:hash(beforeLedger),afterLedgerHash:hash(afterLedger),migrations:extensions,existingLedgerRowsPreserved:true,twoCompanyRowsPreserved:true,noImplicitEnrollment:true,prismaModelEquivalent:true,repeatedDeployNoOp:true,hosted:false,deployable:false},null,2)+'\n');
  console.log('CURRENT_STAGING_UPGRADE_REHEARSAL_PASSED');
} finally {
  process.chdir(root);
  await Promise.allSettled(clients.map(db=>db.end()));
  await control.end().catch(()=>{});
  // Only the generated detached checkout is removed; CI tears down disposable PostgreSQL.
  try {execFileSync('git',['worktree','remove',old],{stdio:'pipe'});}catch{}
}
