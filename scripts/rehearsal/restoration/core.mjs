import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const HISTORICAL='72dab34568cb6885f3e93b5ed9db38edca156835';
export const STAMP='2026-09-01T12:00:00.000Z';
export const DATABASES=['packet10_source','packet10_pre_restore','packet10_post_restore','packet10_corrupt','packet10_history','helios_packet9'];
export function databaseUrl(name){assert.ok(DATABASES.includes(name),'Unknown rehearsal database');return `postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/${name}`;}
export function requireDatabase(value){assert.ok(DATABASES.some(n=>databaseUrl(n)===value),'Only exact disposable databases permitted');return value;}
const q=x=>'"'+x.replaceAll('"','""')+'"';
export async function snapshot(db,{semantic=false}={}){
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const result={};for(const {tablename} of tables){const rows=(await db.query(`SELECT to_jsonb(t) value FROM ${q(tablename)} t`)).rows.map(r=>r.value);if(semantic&&tablename==='WorkspaceMembership')for(const row of rows){delete row.createdAt;delete row.updatedAt;}result[tablename]=rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}return result;
}
export function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export async function seedHistorical(db){
 for(const id of ['a','b']){
  await db.query(`INSERT INTO "Workspace" (id,name,slug,"updatedAt") VALUES ($1,$2,$3,$4)`,[id,'Synthetic '+id,'synthetic-'+id,STAMP]);
  await db.query(`INSERT INTO "AdminUser" (id,email,"displayName",role,"workspaceId",disciplines,"sessionVersion","updatedAt","homepageCurationPreferences") VALUES ($1,$2,$3,'OWNER',$4,'{}',1,$5,$6::jsonb)`,['u'+id,id+'@example.test','Synthetic '+id,id,STAMP,JSON.stringify({order:['our-work','hero'],collapsed:['hero'],layoutGeneration:'historical-retained-generation'})]);
  await db.query(`INSERT INTO "SiteSettings" (id,"workspaceId","businessName","privacyPolicyPublished","termsOfServicePublished","updatedAt") VALUES ($1,$2,$3,$4,$5,$6)`,[id==='a'?'default':'settings-b',id==='a'?null:id,'REHEARSAL COMPANY '+id,id==='a',id==='b',STAMP]);
  await db.query(`INSERT INTO "Project" (id,"workspaceId",title,slug,status,"updatedAt") VALUES ($1,$2,$3,$4,'PUBLISHED',$5)`,['p'+id,id,'Project '+id,'synthetic-project-'+id,STAMP]);
  await db.query(`INSERT INTO "HomepageProject" (id,"projectId","titleOverride","updatedAt") VALUES ($1,$2,$3,$4)`,['hp'+id,'p'+id,'Initial '+id,STAMP]);
  for(let i=1;i<=2;i++){await db.query(`INSERT INTO "Service" (id,"workspaceId",name,slug,"updatedAt") VALUES ($1,$2,$3,$4,$5)`,['s'+id+i,id,'Service '+id+i,'service-'+id+i,STAMP]);await db.query(`INSERT INTO "HomepageWorkCard" (id,"serviceId","titleOverride","displayOrder","updatedAt") VALUES ($1,$2,$3,$4,$5)`,['c'+id+i,'s'+id+i,'Card '+id+i,i-1,STAMP]);}
  await db.query(`INSERT INTO "Media" (id,"projectId","serviceId","sourceType","mediaCategory","storageKey","updatedAt") VALUES ($1,$2,$5,'UPLOADED_IMAGE','PHOTOGRAPHY',$3,$4)`,['m'+id,'p'+id,'projects/'+id+'/legacy.webp',STAMP,'s'+id+'1']);
  await db.query(`INSERT INTO "LocationPage" (id,"workspaceId",slug,city,county,"seoTitle","seoDescription","heroLead",introduction,"marketTitle","marketCopy","localDetails","serviceArea",published,"updatedAt") VALUES ($1,$2,'same-city',$3,'Synthetic','Synthetic','Synthetic','Synthetic','Synthetic','Synthetic','Synthetic','[]','Synthetic',true,$4)`,['l'+id,id,'Location '+id,STAMP]);
  await db.query(`INSERT INTO "BlogSeries" (id,name,purpose,"targetAudience","contentPillars","brandVoice","updatedAt") VALUES ($1,$2,'Fixture','Fixture','[]','Fixture',$3)`,['bs'+id,'Series '+id,STAMP]);
  await db.query(`INSERT INTO "BlogPost" (id,title,slug,content,"seriesId","featuredMediaId",status,"updatedAt") VALUES ($1,$2,$3,'Synthetic historical text',$4,$5,'PUBLISHED',$6)`,['bp'+id,'Post '+id,'post-'+id,'bs'+id,'m'+id,STAMP]);
  await db.query(`INSERT INTO "NewsletterSeries" (id,name,status,"sendRecurrenceKind","sendLocalTime","generationMode","createdById","nextGenerationAt","updatedAt") VALUES ($1,$2,'PAUSED','DAY_OF_MONTH','09:00','MANUAL','ua',$3,$4)`,['ns'+id,'Newsletter '+id,'2026-10-01T12:00:00Z',STAMP]);
  await db.query(`INSERT INTO "LegalDocument" (id,type,title,content,published,"updatedAt") VALUES ($1,$2,$3,$4,true,$5)`,['legal-'+id,id==='a'?'PRIVACY_POLICY':'TERMS_OF_SERVICE','Synthetic legal '+id,'<p>Historical synthetic fixture '+id+'. No legal commitments.</p>',STAMP]);
 }
 await db.query(`INSERT INTO "Testimonial" (id,"agentName",testimonial,"updatedAt") VALUES ('ta','Synthetic','Fixture',$1);`,[STAMP]);
 await db.query(`INSERT INTO "TrustedLogo" (id,"organizationName","updatedAt") VALUES ('logo-a','Synthetic',$1)`,[STAMP]);
}
export async function transactionSql(db,sql){try{await db.query('BEGIN');await db.query(sql);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}}
export async function migrate(db,{negative=false}={}){
 const names=(await readdir('prisma/migrations')).filter(n=>/^2026091/.test(n)).sort();
 for(const n of names){const sql=await readFile(`prisma/migrations/${n}/migration.sql`,'utf8');if(negative&&n.includes('testimonial_logo')){const before=await snapshot(db);await assert.rejects(transactionSql(db,sql),/Verified legacy brand workspace/);assert.deepEqual(await snapshot(db),before);assert.equal((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='Testimonial' AND column_name='workspaceId'`)).rows.length,0);console.log('PASS ambiguous brand expansion rejected; DDL/data rolled back');}
  if(n.includes('testimonial_logo'))await db.query("SELECT set_config('helios.legacy_brand_workspace_id','a',false)");await transactionSql(db,sql);console.log('APPLIED',n,createHash('sha256').update(sql).digest('hex'));
 }
}
export async function operator(db,name){try{await db.query(await readFile('scripts/migrations/'+name,'utf8'));}catch(e){await db.query('ROLLBACK');throw e;}}
export async function backfill(db,{negative=false}={}){
 if(negative){const before=await snapshot(db);for(const n of ['backfill-content-ownership.sql','backfill-brand-ownership.sql','backfill-legal-ownership.sql'])await assert.rejects(operator(db,n),/mapping.*required/i);assert.deepEqual(await snapshot(db),before);}
 await db.query(`CREATE TEMP TABLE "ContentOwnershipMapping" (kind text NOT NULL,id text NOT NULL,"workspaceId" text NOT NULL,PRIMARY KEY(kind,id));CREATE TEMP TABLE "BrandOwnershipMapping" (kind text NOT NULL,id text NOT NULL,"workspaceId" text NOT NULL,PRIMARY KEY(kind,id));CREATE TEMP TABLE "LegalOwnershipMapping" (id text PRIMARY KEY,"workspaceId" text NOT NULL);`);
 for(const id of ['a','b']){for(const [kind,prefix] of [['BlogPost','bp'],['BlogSeries','bs'],['NewsletterSeries','ns']])await db.query(`INSERT INTO "ContentOwnershipMapping" VALUES ($1,$2,$3)`,[kind,prefix+id,id]);await db.query(`INSERT INTO "LegalOwnershipMapping" VALUES ($1,$2)`,['legal-'+id,id]);}
 await db.query(`INSERT INTO "BrandOwnershipMapping" VALUES ('Testimonial','ta','a'),('TrustedLogo','logo-a','a')`);
 if(negative){
  const before=await snapshot(db);await db.query(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='b' WHERE id='bpa'`);await assert.rejects(operator(db,'backfill-content-ownership.sql'),/ownership mismatch/);assert.deepEqual(await snapshot(db),before);await db.query(`UPDATE "ContentOwnershipMapping" SET "workspaceId"='a' WHERE id='bpa'`);
  await db.query(`CREATE FUNCTION packet10_interrupt() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic interrupted backfill'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER packet10_interrupt BEFORE UPDATE ON "NewsletterSeries" FOR EACH ROW EXECUTE FUNCTION packet10_interrupt();`);
  await assert.rejects(operator(db,'backfill-content-ownership.sql'),/synthetic interrupted/);assert.deepEqual(await snapshot(db),before);await db.query(`DROP TRIGGER packet10_interrupt ON "NewsletterSeries";DROP FUNCTION packet10_interrupt();`);console.log('PASS missing/contradictory/interrupted mappings fail atomically');
 }
 for(const n of ['backfill-content-ownership.sql','backfill-brand-ownership.sql','backfill-legal-ownership.sql']){await operator(db,n);const before=await snapshot(db);await operator(db,n);assert.deepEqual(await snapshot(db),before);}
 // Explicit fixture mapping for the historical default singleton. No repository-wide owner inference.
 const changed=await db.query(`UPDATE "SiteSettings" SET "workspaceId"='a' WHERE id='default' AND "workspaceId" IS NULL RETURNING id`);assert.equal(changed.rows.length,1);
 for(const [id,host] of [['a','127.0.0.1'],['b','localhost']])await db.query(`INSERT INTO "WorkspaceDomain" (id,"workspaceId",hostname,purpose,status,"createdAt","updatedAt") VALUES ($1,$2,$3,'PUBLIC_SITE','ACTIVE',$4,$4)`,['domain-'+id,id,host,STAMP]);
 assert.equal((await db.query(`SELECT "workspaceId" FROM "NewsletterSeries" WHERE id='nsa'`)).rows[0].workspaceId,'a');
 assert.equal((await db.query(`SELECT count(*)::int n FROM "Media" WHERE "assetId" IS NULL`)).rows[0].n,2);
 await assert.rejects(db.query(`INSERT INTO "LocationPage" SELECT (jsonb_populate_record(NULL::"LocationPage",to_jsonb(t)||'{"id":"duplicate-location"}'::jsonb)).* FROM "LocationPage" t WHERE id='la'`),/LocationPage_workspaceId_slug_key/);
 await assert.rejects(db.query(`INSERT INTO "LegalDocument" (id,type,title,content,published,"workspaceId","updatedAt") VALUES ('duplicate','PRIVACY_POLICY','Fixture','Fixture',false,'b',CURRENT_TIMESTAMP)`),/duplicate key/);
 assert.ok((await db.query(`SELECT indexname FROM pg_indexes WHERE indexname='LegalDocument_legacy_type_guard'`)).rows.length);console.log('PASS explicit ownership, idempotence, retained global legal guard and legacy unregistered media');
}

export async function catalog(db){return {indexes:(await db.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows,triggers:(await db.query("SELECT t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgname")).rows};}
