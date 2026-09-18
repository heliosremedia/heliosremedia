import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {HISTORICAL,databaseUrl,requireDatabase,seedHistorical,migrate,backfill,snapshot,digest,DATABASES,catalog} from './core.mjs';
assert.equal(process.env.PACKET10_REHEARSAL,'isolated-only');
assert.equal((await readdir('.')).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0);
const env={PATH:process.env.PATH,HOME:process.env.HOME,NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:databaseUrl('packet10_source'),DIRECT_URL:databaseUrl('packet10_source')};
const scratch=await mkdtemp(join(tmpdir(),'helios-restoration-'));
const clients=[];
async function command(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{env,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>out+=x);p.on('error',reject);p.on('exit',code=>code===0?resolve(out):reject(Error(out.slice(-5000))));});}
async function connect(name){const c=new pg.Client({connectionString:requireDatabase(databaseUrl(name))});await c.connect();clients.push(c);return c;}
const control=new pg.Client({connectionString:'postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/packet10_control'});
async function dump(name,path){await command('/usr/lib/postgresql/16/bin/pg_dump',['--dbname',databaseUrl(name),'--format=custom','--no-owner','--no-acl','--file',path]);console.log('BACKUP',name,digest((await readFile(path)).toString('base64')));}
async function restore(name,path){await command('/usr/lib/postgresql/16/bin/pg_restore',['--dbname',databaseUrl(name),'--single-transaction','--exit-on-error','--no-owner','--no-acl',path]);}
try{
 await control.connect();assert.equal((await control.query('SELECT datname FROM pg_database WHERE datname=ANY($1::text[])',[DATABASES])).rows.length,0,'Refuse existing rehearsal databases');
 for(const n of DATABASES)await control.query('CREATE DATABASE "'+n+'"');
 console.log('PostgreSQL', (await control.query('SELECT version()')).rows[0].version);
 console.log(await command('/usr/lib/postgresql/16/bin/pg_dump',['--version']));
 const history=await connect('packet10_history');let historicalFailure;
 for(const n of (await readdir('prisma/migrations')).filter(n=>/^20260[78]/.test(n)).sort()){try{await history.query(await readFile('prisma/migrations/'+n+'/migration.sql','utf8'));}catch(e){historicalFailure={migration:n,message:e.message};break;}}
 assert.equal(historicalFailure?.migration,'20260727190000_social_direct_publishing');assert.match(historicalFailure.message,/SocialConnectionState/);console.log('CONFIRMED historical empty-database replay blocker',historicalFailure);
 const historical=join(scratch,'historical.prisma');await writeFile(historical,await command('git',['show',HISTORICAL+':prisma/schema.prisma']));
 const schema=await command(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema',historical,'--script']);
 // CLI diagnostics go to stderr; retain only the generated SQL after its first DDL comment.
 const sql=schema.slice(schema.indexOf('-- Create'));
 const source=await connect('packet10_source');await source.query(sql);await seedHistorical(source);
 const pre=await snapshot(source);const preCatalog=await catalog(source);console.log('PRE SNAPSHOT',digest(pre),Object.fromEntries(Object.entries(pre).filter(([,v])=>v.length).map(([k,v])=>[k,v.length])));
 const preDump=join(scratch,'pre.dump');await dump('packet10_source',preDump);
 await migrate(source,{negative:true});await backfill(source,{negative:true});
 await source.query(`INSERT INTO "WorkspaceAsset" (id,"workspaceId",provider,"providerNamespace","providerKey",status,provenance,"updatedAt") VALUES ('retained-preparation','a','R2','synthetic:synthetic','workspaces/a/retained.webp','UPLOAD_PROVISIONED','{"intent":"synthetic-retained"}','2026-09-01T12:00:00Z')`);
 const post=await snapshot(source);const semantic=await snapshot(source,{semantic:true});const postCatalog=await catalog(source);console.log('POST SNAPSHOT',digest(post));
 const postDump=join(scratch,'post.dump');await dump('packet10_source',postDump);
 await restore('packet10_pre_restore',preDump);const restored=await connect('packet10_pre_restore');assert.deepEqual(await snapshot(restored),pre);assert.deepEqual(await catalog(restored),preCatalog);await migrate(restored);await backfill(restored);await restored.query(`INSERT INTO "WorkspaceAsset" SELECT * FROM jsonb_populate_record(NULL::"WorkspaceAsset",$1::jsonb)`,[JSON.stringify(post.WorkspaceAsset[0])]);assert.deepEqual(await snapshot(restored,{semantic:true}),semantic);console.log('PASS pre-migration dump restored exactly; real migration/backfills repeat semantically');
 await restore('packet10_post_restore',postDump);const postRestored=await connect('packet10_post_restore');assert.deepEqual(await snapshot(postRestored),post);assert.deepEqual(await catalog(postRestored),postCatalog);assert.ok((await postRestored.query(`SELECT indexname FROM pg_indexes WHERE indexname='LegalDocument_legacy_type_guard'`)).rows.length);console.log('PASS post-migration dump restored rows and compatibility index exactly');
 const corrupt=join(scratch,'corrupt.dump');const bytes=await readFile(postDump);await writeFile(corrupt,bytes.subarray(0,Math.floor(bytes.length/2)));await assert.rejects(restore('packet10_corrupt',corrupt));const damaged=await connect('packet10_corrupt');assert.deepEqual(await snapshot(damaged),{});console.log('PASS truncated dump rejected atomically; empty restore target remains empty');
 await restore('helios_packet9',postDump);const application=await connect('helios_packet9');assert.deepEqual(await snapshot(application),post);console.log('PASS application database restored from post-migration logical backup');
 await command(process.execPath,['node_modules/prisma/build/index.js','generate']);
 console.log('PASS Packet10 migration/backup/restore phase; application verification follows');
}finally{await Promise.all(clients.map(c=>c.end()));await control.end();await rm(scratch,{recursive:true,force:true});}
