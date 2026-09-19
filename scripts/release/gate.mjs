import assert from 'node:assert/strict';
import {readFile,readdir,lstat,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {databaseUrl,requireDatabase,prisma,command} from '../migrations/bootstrap/artifact.mjs';
import {inspect,hash} from '../migrations/bootstrap/inspect.mjs';
import {admission,requireCandidate,BASELINE_CHECKSUM,HISTORICAL_SCHEMA,CURRENT_SCHEMA,baselineIdentity,digest} from './policy.mjs';

/** @param {Record<string, string | undefined>} env */
export function isolatedEnvironment(env=process.env){
 assert.equal(env.PACKET12_REHEARSAL,'isolated-only','Explicit isolated release target required');
 assert.ok(!env.VERCEL_ENV&&!env.VERCEL,'Hosted builds are not authorized');
}
export async function sourceIdentity(artifact,reference){
 assert.equal(artifact.baselineChecksum,BASELINE_CHECKSUM,'Unexpected baseline checksum');
 assert.equal(hash(artifact.sql),BASELINE_CHECKSUM);
 assert.equal(reference.baselineChecksum,BASELINE_CHECKSUM);
 assert.equal(hash(reference.historical),HISTORICAL_SCHEMA,'Untrusted historical reference');
 assert.equal(hash(reference.current),CURRENT_SCHEMA,'Untrusted current reference');
 const manifestText=await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8');
 assert.equal(hash(manifestText),'8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a','Reviewed migration manifest changed');
 assert.equal(hash(await readFile('prisma/schema.prisma','utf8')),'ede3650c4b65f8704a125672ed32f7b7110a78a83cdacf14744e6419d02a0892','Schema needs a new reviewed compatibility reference');
 const manifest=JSON.parse(manifestText);
 assert.deepEqual(artifact.manifest,manifest);assert.deepEqual(reference.manifest,manifest);
 assert.deepEqual((await readdir('prisma/migrations')).filter(n=>/^\d/.test(n)).sort(),Object.keys(manifest).sort());
 for(const [name,sha] of Object.entries(manifest))assert.equal(hash(await readFile('prisma/migrations/'+name+'/migration.sql','utf8')),sha,'Migration changed');
 const expanded=Object.keys(manifest).filter(n=>n.startsWith('2026091'));
 const names=(await readdir(join(artifact.dir,'migrations'))).filter(n=>/^\d/.test(n)).sort();
 assert.deepEqual(names,[baselineIdentity.version,...expanded].sort(),'Unexpected pending migration');
 for(const name of names)assert.equal(hash(await readFile(join(artifact.dir,'migrations',name,'migration.sql'),'utf8')),name===baselineIdentity.version?BASELINE_CHECKSUM:manifest[name]);
 const config=path=>'export default '+JSON.stringify({schema:resolve('prisma/schema.prisma'),migrations:{path},datasource:{url:'URL_PLACEHOLDER'}}).replace('"URL_PLACEHOLDER"','process.env.DIRECT_URL')+';\n';
 assert.equal(await readFile(join(artifact.dir,'prisma.config.ts'),'utf8'),config(join(artifact.dir,'migrations')),'Altered baseline execution config');
 assert.equal(await readFile(join(artifact.dir,'historical.config.ts'),'utf8'),config(resolve('prisma/migrations')),'Altered historical execution config');
 const versions=await Promise.all(['prisma','@prisma/client'].map(async n=>JSON.parse(await readFile('node_modules/'+n+'/package.json','utf8')).version));
 assert.deepEqual(versions,['7.8.0','7.8.0']);
 return {migrationManifest:digest(manifest),baseline:baselineIdentity,prismaSchema:hash(await readFile('prisma/schema.prisma','utf8')),lockfile:hash(await readFile('package-lock.json','utf8')),prisma:'7.8.0'};
}
export function head(){return requireCandidate(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());}
export function stateEvidence(state,database){return {state:state.state,track:state.track,schemaHash:state.schemaHash,ledgerHash:state.ledgerHash,database};}
export async function preflight({artifact,reference,database,selected,candidate}){
 isolatedEnvironment();requireCandidate(candidate);assert.equal(candidate,head(),'Candidate does not match checkout');
 try{execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'ignore'});}catch{throw Error('Tracked checkout changed since candidate commit');}
 const identity=await sourceIdentity(artifact,reference);
 requireDatabase(databaseUrl(database));
 const db=new pg.Client({connectionString:databaseUrl(database)});await db.connect();
 try{
  const state=await inspect(db,reference);const track=admission(state,selected);
  if(state.state==='supported-historical-ledger'){
   const legacy=(await db.query('SELECT EXISTS(SELECT 1 FROM "Testimonial") OR EXISTS(SELECT 1 FROM "TrustedLogo") AS present')).rows[0].present;
   assert.equal(legacy,false,'Historical brand rows need a separately reviewed ownership migration plan');
  }
  return {identity,selected,candidate,...stateEvidence(state,database),track};
 }finally{await db.end();}
}
// Serializes cooperating release processes. Arbitrary external DDL must remain quiesced.
// The callback is reached only after a fresh classification, never from a cached receipt.
export async function migrateApproved(options){
 isolatedEnvironment();const db=new pg.Client({connectionString:databaseUrl(options.database)});await db.connect();
 try{
  assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true,'Another release owns this target');
  const before=await preflight(options);
  await prisma(options.artifact,options.database,['migrate','deploy'],{track:before.track});
  const after=await preflight({...options,selected:'current-'+before.track});
  return {before,after};
 }finally{await db.query('SELECT pg_advisory_unlock(1200318)');await db.end();}
}
/** @param {string} root @param {{exclude?: string[]}} options */
export async function treeDigest(root,{exclude=[]}={}){
 const h=createHash('sha256');let count=0;
 async function walk(dir){for(const name of (await readdir(dir)).sort()){
  const path=join(dir,name),rel=relative(root,path).replaceAll('\\','/');if(exclude.some(x=>rel===x||rel.startsWith(x+'/')))continue;
  const s=await lstat(path);assert.equal(s.isSymbolicLink(),false,'Artifact symlink is not allowed');
  if(s.isDirectory())await walk(path);else if(s.isFile()){const bytes=await readFile(path);h.update(rel+'\0'+bytes.length+'\0');h.update(bytes);count++;}
 }}await walk(root);assert.ok(count>0,'Empty artifact');return h.digest('hex');
}
export async function generatedClientCheck(dir){
 const schema=await readFile(join(dir,'prisma/schema.prisma'),'utf8');
 const generated=await readFile(join(dir,'app/generated/prisma/internal/class.ts'),'utf8');
 // Prisma7's generated runtime configuration embeds the precise input schema.
 const match=generated.match(/"inlineSchema":\s*("(?:[^"\\]|\\.)*")/);
 assert.ok(match,'Generated client schema missing');
 const temp=await mkdtemp(join(tmpdir(),'release-schema-'));
 try{
  await writeFile(join(temp,'schema.prisma'),schema);
  await writeFile(join(temp,'config.ts'),'export default {};');
  await command(process.execPath,['node_modules/prisma/build/index.js','format','--schema',join(temp,'schema.prisma'),'--config',join(temp,'config.ts')]);
  assert.equal(hash(JSON.parse(match[1])),hash(await readFile(join(temp,'schema.prisma'),'utf8')),'Stale generated Prisma client');
 }finally{await rm(temp,{recursive:true,force:true});}
}
