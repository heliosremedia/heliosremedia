import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {prepareArtifact,prisma,databaseUrl,DATABASES,command} from '../../migrations/bootstrap/artifact.mjs';
import {BASELINE,schemaSnapshot,readLedger,inspect,hash} from '../../migrations/bootstrap/inspect.mjs';
import {withoutHistoricalGuards,verifyPrismaModel} from '../../migrations/bootstrap/equivalence.mjs';
import {seedHistorical,migrate,backfill,operator,snapshot} from '../restoration/core.mjs';
assert.equal(process.env.PACKET11_REHEARSAL,'isolated-only');
assert.equal((await readdir('.')).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0);
const clients=[];const control=new pg.Client({connectionString:databaseUrl('packet11_control')});
const scratch=await mkdtemp(join(tmpdir(),'packet11-bootstrap-'));
async function connect(name){const db=new pg.Client({connectionString:databaseUrl(name)});await db.connect();clients.push(db);return db;}
try{
 await control.connect();assert.equal((await control.query('SELECT datname FROM pg_database WHERE datname=ANY($1::text[])',[DATABASES.filter(n=>n!=='packet11_control')])).rows.length,0,'Refuse existing rehearsal targets');
 for(const name of DATABASES.filter(n=>n!=='packet11_control'))await control.query('CREATE DATABASE "'+name+'"');
 console.log('PostgreSQL',(await control.query('SELECT version()')).rows[0].version);
 const artifact=await prepareArtifact(scratch);console.log('BASELINE SQL SHA256',artifact.baselineChecksum);
 const ref=await connect('packet11_reference');await ref.query(artifact.raw);const pinnedHistorical=await schemaSnapshot(ref);await ref.query(artifact.guards);const historical=await schemaSnapshot(ref);
 await seedHistorical(ref);await migrate(ref);const current=await schemaSnapshot(ref);console.log('SCHEMA HASHES',hash(historical),hash(current));const reference={historical,current,pinnedHistorical,manifest:artifact.manifest,baselineChecksum:artifact.baselineChecksum};
 const empty=await connect('packet11_clean');assert.equal((await inspect(empty,reference)).state,'clean-bootstrap-candidate');
 console.log(await prisma(artifact,'packet11_clean',['migrate','deploy']));assert.deepEqual(await schemaSnapshot(empty),historical);
 const cleanLedger=await readLedger(empty);assert.equal(cleanLedger.length,1);assert.equal(cleanLedger[0].checksum,artifact.baselineChecksum);
 assert.equal((await inspect(empty,reference)).state,'supported-historical-ledger');
 // A true historical schema without ledger is baselined only after exact catalog equality.
 const noledger=await connect('packet11_noledger');await noledger.query(artifact.raw);
 assert.equal((await inspect(noledger,reference)).state,'historical-baseline-guards-required');
 await noledger.query('BEGIN;'+artifact.guards+'COMMIT;');
 assert.equal((await inspect(noledger,reference)).mayBaseline,true);
 await prisma(artifact,'packet11_noledger',['migrate','resolve','--applied',BASELINE]);
 assert.equal((await inspect(noledger,reference)).state,'supported-historical-ledger');
 // Deliberately synthetic ledger fixture, NOT a claim that old SQL ran in this order.
 const existing=await connect('packet11_historical');await existing.query(artifact.sql);
 await existing.query(`CREATE TABLE "_prisma_migrations" (id varchar(36) PRIMARY KEY,checksum varchar(64) NOT NULL,finished_at timestamptz,migration_name varchar(255) NOT NULL,logs text,rolled_back_at timestamptz,started_at timestamptz NOT NULL DEFAULT now(),applied_steps_count integer NOT NULL DEFAULT 0)`);
 for(const [name,checksum] of Object.entries(artifact.manifest).filter(([n])=>!n.startsWith('2026091')))await existing.query(`INSERT INTO "_prisma_migrations" VALUES (gen_random_uuid()::text,$1,'2026-09-01',$2,NULL,NULL,'2026-09-01',1)`,[checksum,name]);
 assert.equal((await inspect(existing,reference)).state,'supported-historical-ledger');
 const original=await readLedger(existing);const first=original[0];
 async function fault(sql,params,state){await existing.query('BEGIN');try{await existing.query(sql,params);const ledger=await readLedger(existing),schema=await schemaSnapshot(existing);const {classify}=await import('../../migrations/bootstrap/inspect.mjs');assert.equal(classify({...reference,ledger,schema}).state,state);console.log('PASS ledger fixture',state);}finally{await existing.query('ROLLBACK');}assert.deepEqual(await readLedger(existing),original);}
 await fault('UPDATE "_prisma_migrations" SET checksum=$1 WHERE id=$2',['0'.repeat(64),first.id],'checksum-mismatch');
 await fault('UPDATE "_prisma_migrations" SET finished_at=NULL WHERE id=$1',[first.id],'incomplete-migration');
 await fault('UPDATE "_prisma_migrations" SET rolled_back_at=now() WHERE id=$1',[first.id],'rolled-back-history-review');
 await fault('DELETE FROM "_prisma_migrations" WHERE id=$1',[first.id],'incomplete-ledger');
 await fault('UPDATE "_prisma_migrations" SET migration_name=$1 WHERE id=$2',['unknown-migration',first.id],'unknown-migration');
 await fault('ALTER TABLE "SocialConnection" DROP COLUMN "providerUsername"',[],'schema-mismatch');
 await fault('ALTER TABLE "SiteSettings" ALTER COLUMN "businessName" TYPE text COLLATE "C"',[],'schema-mismatch');
 await fault('UPDATE "_prisma_migrations" SET finished_at=started_at-interval \'1 day\' WHERE id=$1',[first.id],'invalid-ledger-metadata');
 console.log('PASS historical ledger fixtures preserve original records; no repairs');
 // Reproduce exact committed history failure independently from the new baseline track.
 const replay=await connect('packet11_replay');let failed;
 for(const n of Object.keys(artifact.manifest).filter(n=>!n.startsWith('2026091'))){try{await replay.query(await readFile('prisma/migrations/'+n+'/migration.sql','utf8'));}catch(e){failed={name:n,message:e.message};break;}}
 assert.equal(failed.name,'20260727190000_social_direct_publishing');assert.match(failed.message,/SocialConnectionState/);console.log('PASS immutable main history failure reproduced',failed);
 // Deterministic interruption of the actual Prisma baseline; all its DDL rolls back.
 const broken=await connect('packet11_failure');await broken.query(`CREATE FUNCTION packet11_interrupt() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN IF tg_tag='CREATE INDEX' THEN RAISE EXCEPTION 'synthetic interrupted baseline'; END IF; END $$;CREATE EVENT TRIGGER packet11_interrupt ON ddl_command_start EXECUTE FUNCTION packet11_interrupt();`);
 await assert.rejects(prisma(artifact,'packet11_failure',['migrate','deploy']),/synthetic interrupted baseline|current transaction is aborted/);
 await broken.query('DROP EVENT TRIGGER packet11_interrupt;DROP FUNCTION packet11_interrupt()');
 assert.equal((await inspect(broken,reference)).state,'incomplete-migration');
 assert.equal((await broken.query(`SELECT to_regclass('public."Workspace"') value`)).rows[0].value,null);
 console.log('PASS interrupted actual Prisma baseline is not healthy; no automatic resolve');
 await artifact.expand();
 await seedHistorical(existing);
 // Verified fixture mapping on this disposable database only, inherited by Prisma's migration connection.
 await control.query("ALTER DATABASE packet11_historical SET helios.legacy_brand_workspace_id='a'");
 // Compare raw #317 schema path and all expected Prisma definitions explicitly.
 const modelDb=await connect('packet11_model');
 const modelSql=await command(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{DIRECT_URL:databaseUrl('packet11_control')});
 await modelDb.query(modelSql);verifyPrismaModel(current,await schemaSnapshot(modelDb));
 const raw317=await connect('packet11_packet10');await raw317.query(artifact.raw);await seedHistorical(raw317);await migrate(raw317);
 assert.deepEqual(withoutHistoricalGuards(current),await schemaSnapshot(raw317));console.log('PASS exact #317 schema equivalence except seven restored historical checks and one partial index');
 console.log('PASS generated Prisma model equivalence, with explicit retained database-only guards');
 // Real migrate deploy, both existing-original-history and new-baseline tracks.
 for(const [name,db,track] of [['packet11_clean',empty,'baseline'],['packet11_noledger',noledger,'baseline'],['packet11_historical',existing,'historical']]){
  assert.equal((await inspect(db,reference)).mayDeploy,true);
  console.log(await prisma(artifact,name,['migrate','deploy'],{track}));
  assert.deepEqual(await schemaSnapshot(db),current);
  assert.equal((await inspect(db,reference)).state,'current-compatible-ledger');
  const before=await readLedger(db);await prisma(artifact,name,['migrate','deploy'],{track});assert.deepEqual(await readLedger(db),before);
 }
 await control.query('ALTER DATABASE packet11_historical RESET helios.legacy_brand_workspace_id');
 assert.deepEqual((await readLedger(existing)).filter(r=>!r.migration_name.startsWith('2026091')),original);
 console.log('PASS clean, verified-no-ledger and original-ledger paths have equal full schema semantics and idempotent deploy');
 // Empty current bootstrap backfills must be no-ops with explicit empty mapping tables.
 await empty.query('CREATE TEMP TABLE "ContentOwnershipMapping" (kind text,id text,"workspaceId" text);CREATE TEMP TABLE "BrandOwnershipMapping" (kind text,id text,"workspaceId" text);CREATE TEMP TABLE "LegalOwnershipMapping" (id text,"workspaceId" text)');
 const emptyBefore=await snapshot(empty);
 for(const name of ['backfill-content-ownership.sql','backfill-brand-ownership.sql','backfill-legal-ownership.sql']){await operator(empty,name);await operator(empty,name);}
 assert.deepEqual(await snapshot(empty),emptyBefore);
 await empty.query('DROP TABLE pg_temp."ContentOwnershipMapping",pg_temp."BrandOwnershipMapping",pg_temp."LegalOwnershipMapping"');
 console.log('PASS empty current bootstrap backfills are idempotent and leave ledger unchanged');
 // Actual #317 schema + fixture + SQL/backfill path is independent of Prisma deploy.
 await backfill(ref);await backfill(existing);await seedHistorical(empty);await backfill(empty);
 for(const table of ['BlogPost','BlogSeries','NewsletterSeries','Testimonial','TrustedLogo','LegalDocument','SiteSettings','Project','LocationPage']){
  const sql='SELECT id,"workspaceId" FROM "'+table+'" ORDER BY id';assert.deepEqual((await empty.query(sql)).rows,(await ref.query(sql)).rows);assert.deepEqual((await existing.query(sql)).rows,(await ref.query(sql)).rows);
 }
 // Empty/current backfills and later mapped fixtures are safe and repeatable; no inferred owners.
 console.log('PASS actual operators preserve equal two-company fixture state');
 // Restore clean bootstrap to the fixed application harness DB, retaining its real ledger.
 const dump=join(scratch,'bootstrap.dump');await command('/usr/lib/postgresql/16/bin/pg_dump',['--dbname',databaseUrl('packet11_clean'),'--format=custom','--no-owner','--no-acl','--file',dump]);
 await command('/usr/lib/postgresql/16/bin/pg_restore',['--dbname',databaseUrl('helios_packet9'),'--single-transaction','--exit-on-error','--no-owner','--no-acl',dump]);
 const app=await connect('helios_packet9');
 // Fixture users were inserted after foundation; create explicit current memberships, not a guessed backfill.
 await app.query(`INSERT INTO "WorkspaceMembership" (id,"workspaceId","userId",role,status,"updatedAt") VALUES ('fixture-a','a','ua','OWNER','ACTIVE',now()),('fixture-b','b','ub','OWNER','ACTIVE',now())`);
 const ledger=await readLedger(app);await writeFile(join(process.cwd(),'.packet11-ledger-before.json'),JSON.stringify(ledger));
 await writeFile(join(process.cwd(),'.packet11-reference.json'),JSON.stringify(reference));
 console.log('PASS Packet11 bootstrap/schema/ledger/backfill; application checks follow');
}finally{await Promise.all(clients.map(c=>c.end()));await control.end();console.log('Retained isolated artifacts',scratch);}
