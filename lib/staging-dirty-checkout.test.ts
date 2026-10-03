import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync, type ExecFileSyncOptionsWithStringEncoding} from 'node:child_process';
import {checkDirtyCheckout,dirtyCategories} from '../scripts/staging/dirty-checkout.mjs';
import {check,diagnostic,eventsSummary} from '../scripts/staging/actions/diagnostics.mjs';
const secret='secret-content-and-arbitrary-path-sentinel';
const generatedCases=[['next-env.d.ts','NEXT_ENV'],['tsconfig.tsbuildinfo','TSCONFIG_BUILDINFO'],['prisma.config.ts','PRISMA_CONFIG'],['next.config.ts','NEXT_CONFIG'],['eslint.config.mjs','ESLINT_CONFIG'],['postcss.config.mjs','POSTCSS_CONFIG'],['vercel.json','VERCEL_CONFIG'],['app/generated/prisma/client.ts','GENERATED_PRISMA'],['app/generated/prisma/'+secret+' unusual.ts','GENERATED_OR_CONFIG_UNKNOWN']] as const;
const cases=[['package-lock.json','PACKAGE_LOCK'],['package.json','PACKAGE_JSON'],['tsconfig.json','TSCONFIG'],['prisma/schema.prisma','PRISMA_SCHEMA'],['prisma/migrations/20260901_example/migration.sql','MIGRATION'],...generatedCases,[secret,'OTHER_TRACKED']] as const;
function repo(){
 const cwd=mkdtempSync(join(tmpdir(),'dirty-checkout-'));
 const run=(cmd:string,args:string[],options:ExecFileSyncOptionsWithStringEncoding={encoding:'utf8'})=>execFileSync(cmd,args,{...options,cwd,encoding:'utf8',stdio:'pipe'});
 const put=(name:string,value:string)=>{const p=join(cwd,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,value);};
 run('git',['init','-q']);run('git',['config','user.name','Synthetic Test']);run('git',['config','user.email','synthetic@example.invalid']);run('git',['config','core.filemode','true']);
 for(const [name] of cases)put(name,'original\n');
 run('git',['add','.']);run('git',['commit','-qm','synthetic fixture']);
 const cleanup=()=>rmSync(cwd,{recursive:true,force:true});
 return {cwd,run,put,cleanup};
}
function rejection(f:ReturnType<typeof repo>,expected:string[]){
 const calls:string[][]=[];let original:unknown;
 const operation=()=>{try{return f.run('git',['diff','--quiet','HEAD','--']);}catch(e){original=e;throw e;}};
 assert.throws(()=>check('SOURCE_CLEAN_CHECKOUT',()=>checkDirtyCheckout(operation,(cmd:string,args:string[],options:ExecFileSyncOptionsWithStringEncoding)=>{calls.push(args);return f.run(cmd,args,options);},()=>readFileSync(join(f.cwd,'vercel.json'),'utf8'))),e=>{
  assert.equal(e,original);
  const d=diagnostic('source-integrity',e);
  assert.equal(d.reason,'CHECK_SOURCE_CLEAN_CHECKOUT__'+[...expected,...(expected.includes('VERCEL_CONFIG')?['VERCEL_CONFIG_INVALID_JSON']:[])].map(c=>'SOURCE_DIRTY_'+c).join('__'));
  const events=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({...d,path:secret,contents:secret,output:secret})}]);
  assert.deepEqual(events,[{index:0,type:'stderr',...d}]);
  for(const forbidden of [secret,f.cwd,...cases.map(([name])=>name)])assert.ok(!JSON.stringify([d,events]).includes(forbidden));
  return true;
 });
 assert.equal(calls.length,expected.includes('VERCEL_CONFIG')?3:2);assert.ok(calls.slice(0,2).every(a=>a.includes('--no-ext-diff')&&a.includes('--no-textconv')&&a.includes('-z')));
}
for(const [name,category] of cases)test('real tracked change maps to '+category+' '+name,()=>{
 const f=repo();try{f.put(name,secret+'\n');rejection(f,generatedCases.some(([path])=>path===name)?['GENERATED_OR_CONFIG',category]:[category]);}finally{f.cleanup();}
});
test('mixed tracked changes retain each distinct fixed category in stable order',()=>{
 const f=repo();try{for(const [name] of cases)f.put(name,secret+'\n');rejection(f,['PACKAGE_LOCK','PACKAGE_JSON','TSCONFIG','PRISMA_SCHEMA','MIGRATION','GENERATED_OR_CONFIG',...generatedCases.map(([,code])=>code),'OTHER_TRACKED']);}finally{f.cleanup();}
});
test('mode-only change is distinct from content change',()=>{
 const f=repo();try{chmodSync(join(f.cwd,'package-lock.json'),0o755);rejection(f,['MODE_ONLY']);f.put('package-lock.json',secret+'\n');rejection(f,['PACKAGE_LOCK']);}finally{f.cleanup();}
});
test('mode-only and credential-like unknown filenames do not mask package drift',()=>{
 const f=repo();try{chmodSync(join(f.cwd,'package.json'),0o755);f.put('package-lock.json',secret+'\n');f.put(secret,secret+'\n');rejection(f,['PACKAGE_LOCK','MODE_ONLY','OTHER_TRACKED']);}finally{f.cleanup();}
});
test('indexed changes remain subject to the authoritative HEAD comparison',()=>{
 const f=repo();try{f.put('tsconfig.json',secret+'\n');f.run('git',['add','tsconfig.json']);rejection(f,['TSCONFIG']);}finally{f.cleanup();}
});
test('clean checkout returns original result without diagnostic commands; untracked files stay irrelevant',()=>{
 const f=repo();try{f.put('untracked',secret);let touched=false;const value=checkDirtyCheckout(()=>f.run('git',['diff','--quiet','HEAD','--']),()=>{touched=true;throw Error('must not run');});assert.equal(value,'');assert.equal(touched,false);}finally{f.cleanup();}
});
for(const output of ['',secret,'x'.repeat(1024*1024+1),':100644 100644 bad bad M\0'+secret+'\0'])test('malformed or oversized metadata fails closed '+output.length,()=>{
 assert.deepEqual(dirtyCategories(output,'0\t0\t'+secret+'\0'),['SOURCE_DIRTY_OTHER_TRACKED']);
});
test('unknown filenames, tabs, newlines and forged category strings map only to OTHER_TRACKED',()=>{
 for(const path of [secret,'SOURCE_DIRTY_PACKAGE_LOCK','package-lock.json\n'+secret,'package-lock.json\t'+secret,'../package-lock.json']){
  assert.deepEqual(dirtyCategories(':100644 100644 '+'a'.repeat(40)+' '+'0'.repeat(40)+' M\0'+path+'\0','1\t1\t'+path+'\0'),['SOURCE_DIRTY_OTHER_TRACKED']);
 }
});
test('diagnostic failure, Git error, or disappearing diff never changes original rejection',()=>{
 for(const status of [1,128,undefined])for(const mode of ['throw','empty']){
  const original=Object.assign(new Error(secret),{status,reason:'CHECK_SOURCE_DIRTY_PACKAGE_LOCK',dirtyCategories:['SOURCE_DIRTY_PACKAGE_JSON']});let touched=false;
  assert.throws(()=>checkDirtyCheckout(()=>{throw original;},()=>{touched=true;if(mode==='throw')throw Error(secret);return '';}),e=>{
   assert.equal(e,original);assert.equal(diagnostic('source-integrity',e).reason,'CHECK_SOURCE_DIRTY_OTHER_TRACKED');return true;
  });assert.equal(touched,status===1);
 }
});
test('forged diagnostic properties and unknown codes cannot enter retained classification',()=>{
 const error=Object.assign(new Error('failure'),{reason:'CHECK_SOURCE_DIRTY_PACKAGE_LOCK',code:'SOURCE_DIRTY_MODE_ONLY'});
 assert.equal(diagnostic('source-integrity',error).reason,'CONTRACT_OR_EXECUTION_FAILED');
 assert.throws(()=>check('SOURCE_DIRTY_FORGED',()=>{}),/UNKNOWN_DIAGNOSTIC_CHECK/);
 const event=eventsSummary([{type:'stderr',text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({phase:'source-integrity',reason:'CHECK_SOURCE_DIRTY_FORGED',detailHash:'a'.repeat(64),path:secret})}])[0];
 assert.notEqual(event.reason,'CHECK_SOURCE_DIRTY_FORGED');assert.ok(!JSON.stringify(event).includes(secret));
});

test('unknown config paths never impersonate reviewed exact paths',()=>{
 for(const path of ['nested/next-env.d.ts','next.config.js','vercel.json.backup','config/'+secret,'app/generated/other/'+secret,'SOURCE_DIRTY_NEXT_ENV']){
  assert.deepEqual(dirtyCategories(':100644 100644 '+'a'.repeat(40)+' '+'0'.repeat(40)+' M\0'+path+'\0','1\t1\t'+path+'\0'),['SOURCE_DIRTY_OTHER_TRACKED']);
 }
});
test('unrecognized paths inside reviewed Prisma namespace use only fixed unknown code',()=>{
 for(const path of ['app/generated/prisma/../'+secret,'app/generated/prisma/'+secret+'\n.ts','app/generated/prisma/'+secret+'\t.ts']){
  assert.deepEqual(dirtyCategories(':100644 100644 '+'a'.repeat(40)+' '+'0'.repeat(40)+' M\0'+path+'\0','1\t1\t'+path+'\0'),['SOURCE_DIRTY_GENERATED_OR_CONFIG','SOURCE_DIRTY_GENERATED_OR_CONFIG_UNKNOWN']);
 }
});
test('generated path mode-only changes remain mode-only',()=>{
 const f=repo();try{chmodSync(join(f.cwd,'next-env.d.ts'),0o755);rejection(f,['MODE_ONLY']);f.put('next-env.d.ts',secret+'\n');rejection(f,['GENERATED_OR_CONFIG','NEXT_ENV']);}finally{f.cleanup();}
});
test('all generated subcategory labels reject forged error properties',()=>{
 for(const [,code] of generatedCases){
  const error=Object.assign(new Error('failure'),{reason:'CHECK_SOURCE_DIRTY_'+code,code:'SOURCE_DIRTY_'+code});
  assert.equal(diagnostic('source-integrity',error).reason,'CONTRACT_OR_EXECUTION_FAILED');
  const events=eventsSummary([{text:'STAGING_HOSTED_BUILD_BLOCKED '+JSON.stringify({phase:'source-integrity',reason:'CHECK_SOURCE_DIRTY_'+code+'__'+secret,detailHash:'a'.repeat(64),path:secret})}]);
  assert.notEqual(events[0].reason,'CHECK_SOURCE_DIRTY_'+code+'__'+secret);assert.ok(!JSON.stringify(events).includes(secret));
 }
});
