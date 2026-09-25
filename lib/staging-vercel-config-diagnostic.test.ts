import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync,readFileSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {classifyVercelConfig,vercelConfigDiagnostic} from '../scripts/staging/vercel-config-diagnostic.mjs';
import {checkDirtyCheckout} from '../scripts/staging/dirty-checkout.mjs';
import {check,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
const secret='private-content-sentinel';
const base='{"crons":[{"path":"/'+secret+'","schedule":"0 * * * *"}]}';
const cases=[
 ['WHITESPACE_ONLY',base,' \n'+base.replace('[','[\n\t')+'\n'],
 ['LINE_ENDING_ONLY',base+'\n',base+'\r\n'],
 ['JSON_EQUIVALENT',base,'{"crons":[{"schedule":"0 * * * *","path":"/'+secret+'"}]}'],
 ['CRON_CHANGED',base,base.replace('0 *','1 *')],
 ['CRON_CHANGED',base,'{"crons":[]}'],
 ['STRUCTURE_CHANGED',base,'{}'],
 ['STRUCTURE_CHANGED',base,'{"crons":null}'],
 ['INVALID_JSON',base,'{'+secret],
 ['INVALID_JSON','{'+secret,base],
 ['OTHER',base,'{"unknown":"'+secret+'"}'],
 ['OTHER',base,base],
 ['OTHER',base,'{"crons":[],"crons":[]}'],
 ['OTHER',base,'x'.repeat(65537)],
] as const;
for(const [index,[category,before,after]]of cases.entries())test('bounded Vercel diagnostic '+category+' '+index,()=>{
 const result=classifyVercelConfig(before,after);assert.equal(result,'SOURCE_DIRTY_VERCEL_CONFIG_'+category);assert.ok(!result.includes(secret));
});
test('string whitespace and cron order remain semantic changes',()=>{
 assert.equal(classifyVercelConfig(base,base.replace('0 *','0  *')),'SOURCE_DIRTY_VERCEL_CONFIG_CRON_CHANGED');
 const rows=[{path:'/a',schedule:'0 * * * *'},{path:'/b',schedule:'1 * * * *'}];
 assert.equal(classifyVercelConfig(JSON.stringify({crons:rows}),JSON.stringify({crons:rows.toReversed()})),'SOURCE_DIRTY_VERCEL_CONFIG_CRON_CHANGED');
});
test('duplicate known keys and unknown nested structure stay conservative',()=>{
 assert.equal(classifyVercelConfig(base,base.replace('"schedule":','"path":"/forged","schedule":')),'SOURCE_DIRTY_VERCEL_CONFIG_OTHER');
 assert.equal(classifyVercelConfig(base,'{"crons":[{"path":"/'+secret+'","schedule":1}]}'),'SOURCE_DIRTY_VERCEL_CONFIG_STRUCTURE_CHANGED');
});
test('diagnostic read and Git failures return fixed OTHER without error material',()=>{
 for(const mode of ['git','file'])assert.equal(vercelConfigDiagnostic(()=>{if(mode==='git')throw Error(secret);return base;},()=>{throw Error(secret);}),'SOURCE_DIRTY_VERCEL_CONFIG_OTHER');
});
test('real HEAD versus working tree diagnostic admits only whitespace and never modifies files',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'vercel-diagnostic-'));
 const run=(args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'});
 try{
  run(['init','-q']);run(['config','user.name','Synthetic']);run(['config','user.email','synthetic@example.invalid']);
  writeFileSync(join(cwd,'vercel.json'),base);run(['add','.']);run(['commit','-qm','fixture']);
  const helper=new URL('../scripts/staging/dirty-checkout.mjs',import.meta.url).href;
  const diagnostics=new URL('../scripts/staging/actions/diagnostics.mjs',import.meta.url).href;
  const script=`import {execFileSync} from 'node:child_process';import {checkDirtyCheckout} from ${JSON.stringify(helper)};import {check,diagnostic} from ${JSON.stringify(diagnostics)};try{check('SOURCE_CLEAN_CHECKOUT',()=>checkDirtyCheckout(()=>execFileSync('git',['diff','--quiet','HEAD','--'],{stdio:'pipe'})));console.log(JSON.stringify({admitted:true}));}catch(e){console.log(JSON.stringify(diagnostic('source-integrity',e)));}`;
  for(const [category,,after]of cases.filter(c=>c[1]===base&&c[2]!==base)){
   writeFileSync(join(cwd,'vercel.json'),after);
   const output=execFileSync(process.execPath,['--input-type=module','-e',script],{cwd,encoding:'utf8',stdio:'pipe'});
   const d=JSON.parse(output);if(category==='WHITESPACE_ONLY'){assert.deepEqual(d,{admitted:true});assert.equal(readFileSync(join(cwd,'vercel.json'),'utf8'),after);continue;}assert.equal(d.reason,'CHECK_SOURCE_CLEAN_CHECKOUT__SOURCE_DIRTY_GENERATED_OR_CONFIG__SOURCE_DIRTY_VERCEL_CONFIG__SOURCE_DIRTY_VERCEL_CONFIG_'+category);
   assert.ok(!output.includes(secret));assert.ok(!output.includes(cwd));assert.ok(!output.includes('vercel.json'));
   assert.equal(readFileSync(join(cwd,'vercel.json'),'utf8'),after);assert.equal(run(['show','HEAD:vercel.json']),base);
   assert.deepEqual(eventsSummary([{text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...d,contents:secret})}])[0],{index:0,type:'other',...d});
  }
  rmSync(join(cwd,'vercel.json'));symlinkSync('/nonexistent/'+secret,join(cwd,'vercel.json'));
  const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd,encoding:'utf8',stdio:'pipe'}));
  assert.ok(result.reason.endsWith('__SOURCE_DIRTY_VERCEL_CONFIG_OTHER'));
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
test('forged mutation labels do not override private diagnostic labels',()=>{
 for(const category of new Set(cases.map(c=>c[0]))){
  const e=Object.assign(Error('failure'),{reason:'CHECK_SOURCE_DIRTY_VERCEL_CONFIG_'+category,code:'SOURCE_DIRTY_VERCEL_CONFIG_'+category});
  assert.equal(diagnostic('source-integrity',e).reason,'CONTRACT_OR_EXECUTION_FAILED');
  assert.throws(()=>checkDirtyCheckout(()=>{throw e;},()=>{throw Error(secret);}),err=>err===e);
  assert.equal(diagnostic('source-integrity',e).reason,'CHECK_SOURCE_DIRTY_OTHER_TRACKED');
 }
 assert.throws(()=>check('SOURCE_DIRTY_VERCEL_CONFIG_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
});
for(const variant of ['sole','staged','mixed','mode','line-ending','cron','structure','invalid','equivalent','unknown','forged'] as const)test('checkout whitespace admission boundary: '+variant,()=>{
 const cwd=mkdtempSync(join(tmpdir(),'vercel-policy-'));
 const git=(args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'});
 const before=base+'\n';
 try{
  git(['init','-q']);git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.invalid']);
  writeFileSync(join(cwd,'vercel.json'),before);writeFileSync(join(cwd,'unknown-secret-name'),'original');git(['add','.']);git(['commit','-qm','fixture']);
  const after=variant==='line-ending'?base+'\r\n':variant==='cron'?base.replace('0 *','1 *'):variant==='structure'?'{}':variant==='invalid'?'{private-secret':variant==='equivalent'?'{"crons":[{"schedule":"0 * * * *","path":"/'+secret+'"}]}':variant==='unknown'?'{}\n': ' \t'+before;
  writeFileSync(join(cwd,'vercel.json'),after);
  if(variant==='mixed'||variant==='forged')writeFileSync(join(cwd,'unknown-secret-name'),'private-secret');
  if(variant==='mode')chmodSync(join(cwd,'vercel.json'),0o755);
  if(variant==='staged')git(['add','vercel.json']);
  const commands:string[][]=[];
  const operation=()=>{commands.push(['quiet']);try{return git(['diff','--quiet','HEAD','--']);}catch(e){if(variant==='forged')Object.assign(e as object,{code:'SOURCE_DIRTY_VERCEL_CONFIG_WHITESPACE_ONLY',reason:'SOURCE_DIRTY_VERCEL_CONFIG_WHITESPACE_ONLY'});throw e;}};
  const invoke=()=>checkDirtyCheckout(operation,(_file,args)=>{commands.push(args);return git(args);},()=>readFileSync(join(cwd,'vercel.json'),'utf8'));
  if(variant==='sole'||variant==='staged')assert.doesNotThrow(invoke);
  else assert.throws(invoke,e=>{const output=JSON.stringify(diagnostic('source-integrity',e));assert.ok(!output.includes(secret));assert.ok(!output.includes('unknown-secret-name'));assert.ok(!output.includes('private-secret'));return true;});
  assert.deepEqual(commands[0],['quiet']);assert.equal(readFileSync(join(cwd,'vercel.json'),'utf8'),after);assert.equal(git(['show','HEAD:vercel.json']),before);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
