import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {BASELINE,hash} from './inspect.mjs';
export const PIN='72dab34568cb6885f3e93b5ed9db38edca156835';
export const DATABASES=['packet11_control','packet11_reference','packet11_clean','packet11_historical','packet11_noledger','packet11_failure','packet11_replay','packet11_model','packet11_packet10','helios_packet9'];
export function databaseUrl(name){assert.ok(DATABASES.includes(name));return 'postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/'+name;}
export function requireDatabase(url){assert.ok(DATABASES.some(n=>databaseUrl(n)===url),'Exact isolated database required');return url;}
export async function command(cmd,args,extra={}){
 const env={PATH:process.env.PATH,HOME:process.env.HOME,NEXT_TELEMETRY_DISABLED:'1',...extra};
 return new Promise((yes,no)=>{const p=spawn(cmd,args,{env,stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',no);p.on('exit',code=>code===0?yes(out):no(Error(err.slice(-5000)+'\n'+out.slice(-5000))));});
}
export async function prepareArtifact(dir){
 assert.equal(JSON.parse(await readFile('node_modules/prisma/package.json','utf8')).version,'7.8.0');
 const manifest=JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8'));
 assert.deepEqual((await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort(),Object.keys(manifest).sort());
 for(const [name,checksum] of Object.entries(manifest))assert.equal(hash(await readFile('prisma/migrations/'+name+'/migration.sql','utf8')),checksum,'Immutable migration '+name);
 await mkdir(dir,{recursive:true});const historical=join(dir,'historical.prisma');
 await writeFile(historical,await command('git',['show',PIN+':prisma/schema.prisma']));
 const raw=await command(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema',historical,'--script'],{DIRECT_URL:databaseUrl('packet11_control')});
 assert.match(raw,/CREATE TABLE "SocialConnection"/);
 const guards=await historicalGuards();
 const sql='-- Verified pre-V2 schema baseline. No historical data-repair replay.\n-- Source '+PIN+'; Prisma 7.8.0.\nBEGIN;\n'+raw+'\n'+guards+'\nCOMMIT;\n';
 const migrations=join(dir,'migrations');await mkdir(join(migrations,BASELINE),{recursive:true});await writeFile(join(migrations,BASELINE,'migration.sql'),sql);await writeFile(join(migrations,'migration_lock.toml'),'provider = "postgresql"\n');
 const config=(path)=>'export default '+JSON.stringify({schema:resolve('prisma/schema.prisma'),migrations:{path},datasource:{url:'URL_PLACEHOLDER'}}).replace('"URL_PLACEHOLDER"','process.env.DIRECT_URL')+';\n';
 await writeFile(join(dir,'prisma.config.ts'),config(migrations));
 await writeFile(join(dir,'historical.config.ts'),config(resolve('prisma/migrations')));
 return {dir,sql,raw,guards,manifest,baselineChecksum:hash(sql),async expand(){for(const n of Object.keys(manifest).filter(n=>n.startsWith('2026091'))){await mkdir(join(migrations,n));await writeFile(join(migrations,n,'migration.sql'),await readFile('prisma/migrations/'+n+'/migration.sql'));}}};
}
export async function prisma(artifact,name,args,{track='baseline',verifiedBrandOwner}={}){
 requireDatabase(databaseUrl(name));assert.equal(process.env.PACKET11_REHEARSAL,'isolated-only');
 assert.ok(!verifiedBrandOwner||verifiedBrandOwner==='a','Only reviewed synthetic mapping accepted');
 return command(process.execPath,['node_modules/prisma/build/index.js',...args,'--config',join(artifact.dir,track==='baseline'?'prisma.config.ts':'historical.config.ts')],{DIRECT_URL:databaseUrl(name),DATABASE_URL:databaseUrl(name),...(verifiedBrandOwner?{PGOPTIONS:'-c helios.legacy_brand_workspace_id=a'}:{})});
}

export async function historicalGuards(){
 const constraints=[
  ['20260725120000_add_newsletter_studio','NewsletterSeries'],
  ['20260730090000_v187_ai_social_series','SocialSeries'],
 ];
 const statements=[];
 for(const [migration,table] of constraints){
  const sql=await readFile('prisma/migrations/'+migration+'/migration.sql','utf8');
  for(const match of sql.matchAll(/CONSTRAINT "([^"]+)" CHECK \([\s\S]*?(?=,\n\s*CONSTRAINT|\n\);)/g))statements.push('ALTER TABLE "'+table+'" ADD '+match[0]+';');
 }
 assert.equal(statements.length,7,'Exactly seven pinned historical checks');
 const sql=await readFile('prisma/migrations/20260812140000_v195_film_comparison/migration.sql','utf8');
 statements.push(sql.split('\n').find(s=>s.startsWith('CREATE UNIQUE INDEX "VideoComparisonPlacement_one_featured_per_offering"')));
 return statements.join('\n');
}
