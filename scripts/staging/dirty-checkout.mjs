import {execFileSync} from 'node:child_process';
import {check} from './actions/diagnostics.mjs';
import {vercelConfigDiagnostic,readWorkingVercelConfig} from './vercel-config-diagnostic.mjs';
const other='SOURCE_DIRTY_OTHER_TRACKED';
const order=['SOURCE_DIRTY_PACKAGE_LOCK','SOURCE_DIRTY_PACKAGE_JSON','SOURCE_DIRTY_TSCONFIG','SOURCE_DIRTY_PRISMA_SCHEMA','SOURCE_DIRTY_MIGRATION','SOURCE_DIRTY_GENERATED_OR_CONFIG','SOURCE_DIRTY_MODE_ONLY',other];
const generated=new Map([
 ['next-env.d.ts','SOURCE_DIRTY_NEXT_ENV'],['tsconfig.tsbuildinfo','SOURCE_DIRTY_TSCONFIG_BUILDINFO'],
 ['prisma.config.ts','SOURCE_DIRTY_PRISMA_CONFIG'],['next.config.ts','SOURCE_DIRTY_NEXT_CONFIG'],
 ['eslint.config.mjs','SOURCE_DIRTY_ESLINT_CONFIG'],['postcss.config.mjs','SOURCE_DIRTY_POSTCSS_CONFIG'],['vercel.json','SOURCE_DIRTY_VERCEL_CONFIG'],
]);
const generatedPrisma='SOURCE_DIRTY_GENERATED_PRISMA',generatedUnknown='SOURCE_DIRTY_GENERATED_OR_CONFIG_UNKNOWN';
const diagnosticOrder=[...order.slice(0,6),...generated.values(),generatedPrisma,generatedUnknown,...order.slice(6)];
const exact=new Map([
 ['package-lock.json',order[0]],['package.json',order[1]],['tsconfig.json',order[2]],['prisma/schema.prisma',order[3]],
 ...Array.from(generated.keys(),name=>[name,order[5]]),
]);
const limit=1024*1024;
// Parse only bounded NUL-delimited Git metadata, never file contents or patch text.
export function dirtyCategories(raw,numstat){
 try{
  if(typeof raw!=='string'||typeof numstat!=='string'||raw.length>limit||numstat.length>limit||!raw.endsWith('\0')||!numstat.endsWith('\0'))return [other];
  const fields=raw.slice(0,-1).split('\0'),stats=new Map();
  if(fields.length%2||fields.length>8192)return [other];
  for(const row of numstat.slice(0,-1).split('\0')){
   const match=/^(\d+|-)\t(\d+|-)\t([\s\S]+)$/.exec(row);
   if(!match||stats.has(match[3]))return [other];stats.set(match[3],[match[1],match[2]]);
  }
  const found=new Set(),seen=new Set();
  for(let i=0;i<fields.length;i+=2){
   const meta=/^:(\d{6}) (\d{6}) [a-f0-9]{40,64} [a-f0-9]{40,64} ([AMDT])$/.exec(fields[i]),name=fields[i+1],stat=stats.get(name);
   if(!meta||!stat||seen.has(name))return [other];seen.add(name);
   if(meta[3]==='M'&&['100644','100755'].includes(meta[1])&&['100644','100755'].includes(meta[2])&&meta[1]!==meta[2]&&stat[0]==='0'&&stat[1]==='0')found.add(order[6]);
   else {
    const prisma=/^app\/generated\/prisma\/[A-Za-z0-9_./-]+$/.test(name)&&!name.split('/').includes('..');
    const category=exact.get(name)||(/^prisma\/migrations\/(?:[A-Za-z0-9_-]+\/migration\.sql|migration_lock\.toml)$/.test(name)?order[4]:name.startsWith('app/generated/prisma/')?order[5]:other);
    found.add(category);
    if(category===order[5])found.add(generated.get(name)||(prisma?generatedPrisma:generatedUnknown));
   }
  }
  if(seen.size!==stats.size||!seen.size)return [other];
  return diagnosticOrder.filter(code=>found.has(code));
 }catch{return [other];}
}
/** @param {() => unknown} operation
 * @param {(file: string, args: string[], options: import('node:child_process').ExecFileSyncOptionsWithStringEncoding) => string} run
 */
export function checkDirtyCheckout(operation,run=execFileSync,readConfig=readWorkingVercelConfig){
 try{return operation();}catch(error){
  let codes=[other];
  try{
   if(error?.status===1){
    const options={encoding:'utf8',stdio:'pipe',timeout:5000,maxBuffer:limit};
    const common=['--no-ext-diff','--no-textconv','--no-renames'];
    const raw=run('git',['diff',...common,'--raw','--no-abbrev','-z','HEAD','--'],options);
    const stats=run('git',['diff',...common,'--numstat','-z','HEAD','--'],options);
    codes=dirtyCategories(raw,stats);
    if(codes.includes('SOURCE_DIRTY_VERCEL_CONFIG'))codes.push(vercelConfigDiagnostic(run,readConfig));
   }
  }catch{/* Diagnostic collection can never turn the authoritative failure into admission. */}
  function reject(index){if(index===codes.length)throw error;return check(codes[index],()=>reject(index+1));}
  return reject(0);
 }
}
