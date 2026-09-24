import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {check,checked,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
import {BASELINE_CHECKSUM} from '../scripts/release/policy.mjs';

const candidate='a'.repeat(40),secret='private-file-content-and-credential-sentinel';
const manifestPath='scripts/migrations/bootstrap/history-sha256.json';
const manifestRaw=readFileSync(manifestPath,'utf8');
const manifest=JSON.parse(manifestRaw) as Record<string,string>;
const migrationNames=Object.keys(manifest).sort();
const schemaRaw=readFileSync('prisma/schema.prisma','utf8');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const ast=ts.createSourceFile('hosted-build.mjs',readFileSync('scripts/staging/hosted-build.mjs','utf8'),ts.ScriptTarget.Latest,true);
let sourceBody='';
function find(node:ts.Node){
 if(ts.isPropertyAssignment(node)&&node.name.getText(ast)==='source'&&ts.isArrowFunction(node.initializer))sourceBody=node.initializer.body.getText(ast);
 ts.forEachChild(node,find);
}
find(ast);assert.ok(sourceBody);
function harness(options:{gitSha?:string;dirty?:boolean;envFile?:string;missing?:string;rawManifest?:string;directories?:string[];migrationDrift?:boolean;schemaDrift?:boolean;parseFailure?:boolean;digestFailure?:boolean}={}){
 const calls:string[]=[];
 const original=Object.assign(new Error(secret),{stderr:Buffer.from(secret),path:'/private/'+secret,reason:'CHECK_SOURCE_FORGED'});
 const context={assert,check,checked,BASELINE_CHECKSUM,Object,manifest:undefined,
  execFileSync:(_command:string,args:string[])=>{calls.push(args[0]);if(args[0]==='rev-parse')return (options.gitSha??candidate)+'\n';if(options.dirty)throw original;return Buffer.alloc(0);},
  access:async(name:string)=>{calls.push('access:'+name);if(name!==options.envFile)throw Error('absent');},
  readFile:async(name:string)=>{
   calls.push('read:'+name);if(name===options.missing)throw original;
   if(name===manifestPath)return options.rawManifest??manifestRaw;
   if(name==='prisma/schema.prisma')return options.schemaDrift?secret:schemaRaw;
   if(name==='package-lock.json')return secret;
   return options.migrationDrift?secret:readFileSync(name,'utf8');
  },
  readdir:async()=>{calls.push('directories');return options.directories??migrationNames;},
  hash:(value:string)=>{if(options.digestFailure&&value===secret)throw original;return hash(value);},
  JSON:options.parseFailure?{parse:()=>{throw original;}}:JSON,
 };
 const source=runInNewContext('(async candidate=>'+sourceBody+')',context) as (sha:string)=>Promise<Record<string,unknown>>;
 return {source,calls,original};
}
const cases:[string,Parameters<typeof harness>[0]][]=[
 ['SOURCE_CANDIDATE_SHA',{gitSha:'b'.repeat(40)}],
 ['SOURCE_CLEAN_CHECKOUT',{dirty:true}],
 ['SOURCE_ENVIRONMENT_FILE',{envFile:'.env'}],
 ['SOURCE_MANIFEST_READ',{missing:manifestPath}],
 ['SOURCE_MANIFEST_HASH',{rawManifest:'{'+secret}],
 // Valid hash precedes parsing; inject a parser exception to exercise its otherwise unreachable failure label.
 ['SOURCE_MANIFEST_PARSE',{parseFailure:true}],
 ['SOURCE_MIGRATION_DIRECTORY_SET',{directories:[...migrationNames,'20999999_'+secret]}],
 ['SOURCE_HISTORICAL_MIGRATION_CHECKSUM',{migrationDrift:true}],
 ['SOURCE_PRISMA_SCHEMA_HASH',{schemaDrift:true}],
 ['SOURCE_LOCKFILE_READ_DIGEST',{missing:'package-lock.json'}],
];
for(const [code,options] of cases)test('actual source callback rejects with fixed '+code,async()=>{
 const h=harness(options);
 await assert.rejects(h.source(candidate),(error:Error)=>{
  const d=diagnostic('source-integrity',error);
  assert.deepEqual(Object.keys(d).sort(),['detailHash','matched','phase','reason']);
  assert.equal(d.phase,'source-integrity');assert.equal(d.reason,'CHECK_'+code);assert.equal(d.matched,false);
  assert.match(d.detailHash,/^[a-f0-9]{64}$/);
  const retained=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...d,file:secret,contents:secret,observedHash:hash(secret)})}]);
  assert.deepEqual(retained,[{index:0,type:'stderr',...d}]);
  const serialized=JSON.stringify([d,retained]);
  for(const forbidden of [secret,'/private/',manifestPath,'20999999_'])assert.ok(!serialized.includes(forbidden));
  return true;
 });
 if(code==='SOURCE_CANDIDATE_SHA')assert.deepEqual(h.calls,['rev-parse']);
 if(code==='SOURCE_CLEAN_CHECKOUT')assert.deepEqual(h.calls,['rev-parse','diff']);
});
test('all source rejection categories are distinct',()=>assert.equal(new Set(cases.map(([code])=>code)).size,cases.length));
for(const name of ['.env','.env.local','.env.production','.env.production.local'])test('forbidden environment file fails closed: '+name,async()=>{
 const h=harness({envFile:name});await assert.rejects(h.source(candidate),(e:Error)=>diagnostic('source-integrity',e).reason==='CHECK_SOURCE_ENVIRONMENT_FILE');
 assert.ok(!h.calls.includes('read:'+manifestPath));
});
for(const [name,code] of [['prisma/migrations/'+migrationNames[0]+'/migration.sql','SOURCE_HISTORICAL_MIGRATION_CHECKSUM'],['prisma/schema.prisma','SOURCE_PRISMA_SCHEMA_HASH']] as const)test('missing source file remains rejected: '+code,async()=>{
 const h=harness({missing:name});await assert.rejects(h.source(candidate),(e:Error)=>e===h.original&&diagnostic('source-integrity',e).reason==='CHECK_'+code);
});
test('lockfile digest failure preserves original error and fixed label',async()=>{
 const h=harness({digestFailure:true});await assert.rejects(h.source(candidate),(e:Error)=>e===h.original&&diagnostic('source-integrity',e).reason==='CHECK_SOURCE_LOCKFILE_READ_DIGEST');
});
test('successful source callback preserves operation order and identity',async()=>{
 const h=harness();const identity=await h.source(candidate);
 assert.equal(JSON.stringify(identity),JSON.stringify({migrationManifest:hash(manifestRaw),prismaSchema:hash(schemaRaw),baselineChecksum:BASELINE_CHECKSUM,lockfile:hash(secret)}));
 assert.deepEqual(h.calls,['rev-parse','diff',...['.env','.env.local','.env.production','.env.production.local'].map(n=>'access:'+n),'read:'+manifestPath,'directories',...Object.keys(manifest).map(n=>'read:prisma/migrations/'+n+'/migration.sql'),'read:prisma/schema.prisma','read:package-lock.json']);
});
test('source diagnostic properties cannot forge private labels and unknown codes fail closed',()=>{
 const forged=Object.assign(new Error('failure'),{reason:'CHECK_SOURCE_CLEAN_CHECKOUT',code:'SOURCE_CANDIDATE_SHA',safeDiagnostic:{phase:'source-integrity',reason:'CHECK_SOURCE_MANIFEST_HASH'}});
 assert.equal(diagnostic('source-integrity',forged).reason,'CONTRACT_OR_EXECUTION_FAILED');
 assert.throws(()=>check('SOURCE_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
 const event=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({phase:'source-integrity',reason:'CHECK_SOURCE_FORGED',detailHash:'a'.repeat(64),file:secret})}])[0];
 assert.notEqual(event.reason,'CHECK_SOURCE_FORGED');assert.ok(!JSON.stringify(event).includes(secret));
});
