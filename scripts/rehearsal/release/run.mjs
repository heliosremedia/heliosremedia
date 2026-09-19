import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {prepareArtifact,prisma,databaseUrl,DATABASES,command} from '../../migrations/bootstrap/artifact.mjs';
import {schemaSnapshot,readLedger} from '../../migrations/bootstrap/inspect.mjs';
import {verifyPrismaModel} from '../../migrations/bootstrap/equivalence.mjs';
import {seedHistorical,migrate,backfill} from '../restoration/core.mjs';
import {preflight,migrateApproved,sourceIdentity,head,isolatedEnvironment} from '../../release/gate.mjs';
isolatedEnvironment();
assert.equal((await readdir('.')).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0);
const candidate=head();assert.equal(candidate,process.env.GITHUB_SHA||candidate);
const scratch=await mkdtemp(join(tmpdir(),'packet12-release-'));const clients=[];
const control=new pg.Client({connectionString:databaseUrl('packet11_control')});
const connect=async name=>{const db=new pg.Client({connectionString:databaseUrl(name)});await db.connect();clients.push(db);return db;};
try{
 await control.connect();assert.equal((await control.query('SELECT datname FROM pg_database WHERE datname=ANY($1::text[])',[DATABASES.filter(n=>n!=='packet11_control')])).rows.length,0);
 for(const name of DATABASES.filter(n=>n!=='packet11_control'))await control.query('CREATE DATABASE "'+name+'"');
 console.log('PostgreSQL',(await control.query('SELECT version()')).rows[0].version);
 const artifact=await prepareArtifact(scratch);
 const ref=await connect('packet11_reference');await ref.query(artifact.raw);const pinnedHistorical=await schemaSnapshot(ref);await ref.query(artifact.guards);const historical=await schemaSnapshot(ref);
 await seedHistorical(ref);await migrate(ref);const current=await schemaSnapshot(ref);
 const reference={historical,current,pinnedHistorical,manifest:artifact.manifest,baselineChecksum:artifact.baselineChecksum};
 // Establish a historical baseline fixture by actually deploying the one baseline to EMPTY DB.
 // This does not mark an existing no-ledger target applied and never calls migrate resolve.
 await prisma(artifact,'packet11_noledger',['migrate','deploy']);
 const noledger=await connect('packet11_replay');await noledger.query(artifact.sql);
 const old=await connect('packet11_historical');await old.query(artifact.sql);
 await old.query(`CREATE TABLE "_prisma_migrations" (id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)`);
 for(const [name,checksum] of Object.entries(artifact.manifest).filter(([n])=>!n.startsWith('2026091')))await old.query(`INSERT INTO "_prisma_migrations" VALUES (gen_random_uuid()::text,$1,'2026-09-01',$2,NULL,NULL,'2026-09-01',1)`,[checksum,name]);
 const oldLedger=await readLedger(old);
 await artifact.expand();
 const options=(database,selected)=>({artifact,reference,database,selected,candidate});
 await sourceIdentity(artifact,reference);
 const model=await connect('packet11_model');await model.query(await command(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{DIRECT_URL:databaseUrl('packet11_control')}));verifyPrismaModel(current,await schemaSnapshot(model));
 // No-ledger and missing-guard paths stop before any migration. Preserve exact ledger/schema.
 await assert.rejects(migrateApproved(options('packet11_replay','verified-baseline')),/baseline establishment/);
 assert.equal((await readLedger(noledger)).length,0);
 await noledger.query('ALTER TABLE "NewsletterSeries" DROP CONSTRAINT "NewsletterSeries_send_time_check"');
 await assert.rejects(migrateApproved(options('packet11_replay','verified-baseline')),/does not match/);
 assert.equal((await readLedger(noledger)).length,0);
 console.log('PASS no-ledger requires explicit baseline; missing guard rejected; no resolve');
 // Prevent the known data-bearing brand migration from failing after earlier migrations committed.
 await old.query(`INSERT INTO "Testimonial" (id,"agentName",testimonial,"updatedAt") VALUES ('ambiguous','Synthetic','Fixture',now())`);
 await assert.rejects(migrateApproved(options('packet11_historical','historical-ledger')),/ownership migration plan/);
 assert.deepEqual(await readLedger(old),oldLedger);
 await old.query(`DELETE FROM "Testimonial" WHERE id='ambiguous'`);
 console.log('PASS ambiguous historical brand ownership stops before any migration');
 const results=[];
 for(const [database,selected] of [['packet11_clean','clean-bootstrap'],['packet11_noledger','verified-baseline'],['packet11_historical','historical-ledger']]){
  const result=await migrateApproved(options(database,selected));results.push(result);
  const again=await migrateApproved(options(database,'current-'+result.after.track));assert.equal(again.after.ledgerHash,result.after.ledgerHash);
  console.log('PASS approved track migrated and repeated idempotently',selected,result.after.track);
 }
 assert.deepEqual((await readLedger(old)).filter(r=>!r.migration_name.startsWith('2026091')),oldLedger);
 const clean=await connect('packet11_clean'),original=await readLedger(clean);
 // Commit each synthetic defect so the actual gate's independent connection sees it.
 // Restore fixture state explicitly after asserting the migration never repaired or advanced it.
 async function fault(label,alter,undo){
  await alter();const damaged=await readLedger(clean);const catalog=await schemaSnapshot(clean);
  await assert.rejects(migrateApproved(options('packet11_clean','current-baseline')));
  assert.deepEqual(await readLedger(clean),damaged);assert.deepEqual(await schemaSnapshot(clean),catalog);
  await undo();assert.deepEqual(await readLedger(clean),original);console.log('PASS unsafe release denied before migration',label);
 }
 const row=original[0];
 await fault('checksum mismatch',()=>clean.query('UPDATE "_prisma_migrations" SET checksum=$1 WHERE id=$2',['0'.repeat(64),row.id]),()=>clean.query('UPDATE "_prisma_migrations" SET checksum=$1 WHERE id=$2',[row.checksum,row.id]));
 await fault('failed/incomplete bootstrap',()=>clean.query('UPDATE "_prisma_migrations" SET finished_at=NULL WHERE id=$1',[row.id]),()=>clean.query('UPDATE "_prisma_migrations" SET finished_at=$1 WHERE id=$2',[row.finished_at,row.id]));
 const last=original.at(-1);
 await fault('missing migration',()=>clean.query('DELETE FROM "_prisma_migrations" WHERE id=$1',[last.id]),()=>clean.query(`INSERT INTO "_prisma_migrations" (id,migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count) SELECT id,migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count FROM jsonb_populate_record(NULL::"_prisma_migrations",$1::jsonb)`,[JSON.stringify(last)]));
 await fault('unknown migration',()=>clean.query('UPDATE "_prisma_migrations" SET migration_name=$1 WHERE id=$2',['unknown',row.id]),()=>clean.query('UPDATE "_prisma_migrations" SET migration_name=$1 WHERE id=$2',[row.migration_name,row.id]));
 await fault('duplicate migration',()=>clean.query(`INSERT INTO "_prisma_migrations" SELECT 'fixture-duplicate',checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count FROM "_prisma_migrations" WHERE id=$1`,[row.id]),()=>clean.query(`DELETE FROM "_prisma_migrations" WHERE id='fixture-duplicate'`));
 await fault('schema drift',()=>clean.query('ALTER TABLE "Workspace" ADD COLUMN fixture_drift text'),()=>clean.query('ALTER TABLE "Workspace" DROP COLUMN fixture_drift'));
 await fault('missing historical guard',()=>clean.query('ALTER TABLE "NewsletterSeries" DROP CONSTRAINT "NewsletterSeries_send_time_check"'),()=>clean.query(artifact.guards.split('\n').find(s=>s.includes('NewsletterSeries_send_time_check'))));
 await assert.rejects(migrateApproved(options('packet11_clean','current-historical')));
 await assert.rejects(migrateApproved({...options('packet11_clean','current-baseline'),candidate:'0'.repeat(40)}));
 await assert.rejects(migrateApproved({...options('packet11_clean','current-baseline'),artifact:{...artifact,baselineChecksum:'0'.repeat(64)}}));
 // Actual interrupted baseline has a failed Prisma ledger; gate must not resolve/retry it.
 const broken=await connect('packet11_failure');await broken.query(`CREATE FUNCTION packet12_interrupt() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN IF tg_tag='CREATE INDEX' THEN RAISE EXCEPTION 'synthetic interrupted baseline'; END IF; END $$;CREATE EVENT TRIGGER packet12_interrupt ON ddl_command_start EXECUTE FUNCTION packet12_interrupt();`);
 await assert.rejects(prisma(artifact,'packet11_failure',['migrate','deploy']));
 await broken.query('DROP EVENT TRIGGER packet12_interrupt;DROP FUNCTION packet12_interrupt()');
 const failed=await readLedger(broken);await assert.rejects(migrateApproved(options('packet11_failure','clean-bootstrap')));assert.deepEqual(await readLedger(broken),failed);
 console.log('PASS wrong track/candidate/baseline and actual interrupted Prisma denied');
 // Fixture insertion/backfill is independent of release admission, never provider work.
 await seedHistorical(clean);await backfill(clean);
 const dump=join(scratch,'approved.dump');await command('/usr/lib/postgresql/16/bin/pg_dump',['--dbname',databaseUrl('packet11_clean'),'--format=custom','--no-owner','--no-acl','--file',dump]);
 await command('/usr/lib/postgresql/16/bin/pg_restore',['--dbname',databaseUrl('helios_packet9'),'--single-transaction','--exit-on-error','--no-owner','--no-acl',dump]);
 const app=await connect('helios_packet9');await app.query(`INSERT INTO "WorkspaceMembership" (id,"workspaceId","userId",role,status,"updatedAt") VALUES ('fixture-a','a','ua','OWNER','ACTIVE',now()),('fixture-b','b','ub','OWNER','ACTIVE',now())`);
 const appPreflight=await preflight(options('helios_packet9','current-baseline'));
 await mkdir('release-evidence',{recursive:true});
 await writeFile('release-evidence/track-results.json',JSON.stringify({candidate,results,appPreflight},null,2));
 await writeFile('.packet12-context.json',JSON.stringify({candidate,artifact:{dir:artifact.dir,sql:artifact.sql,manifest:artifact.manifest,baselineChecksum:artifact.baselineChecksum},reference,database:'helios_packet9',selected:'current-baseline'}));
 console.log('PASS isolated migration track matrix; release context ready for gated build');
}finally{await Promise.all(clients.map(c=>c.end()));await control.end();}
