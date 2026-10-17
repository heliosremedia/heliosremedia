import {execFileSync} from 'node:child_process';
import {openSync,readSync,fstatSync,closeSync,constants} from 'node:fs';
const limit=65536;
const code=name=>'SOURCE_DIRTY_VERCEL_CONFIG_'+name;
// Only JSON whitespace outside quoted strings is removed, in memory only.
function compact(text){return text.match(/"(?:[^"\\]|\\.)*"|[^ \t\r\n]/g)?.join('')||'';}
function known(value){
 if(!value||Array.isArray(value)||typeof value!=='object')return false;
 if(Object.keys(value).some(k=>k!=='crons'))return false;
 return Array.isArray(value.crons)&&value.crons.length<=128&&value.crons.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===2&&Object.hasOwn(row,'path')&&Object.hasOwn(row,'schedule')&&typeof row.path==='string'&&typeof row.schedule==='string');
}
export function classifyVercelConfig(before,after){
 try{
  if(typeof before!=='string'||typeof after!=='string'||Buffer.byteLength(before)>limit||Buffer.byteLength(after)>limit||before===after)return code('OTHER');
  let a,b;try{a=JSON.parse(before);b=JSON.parse(after);}catch{return code('INVALID_JSON');}
  // Unknown structures and duplicate keys never claim semantic equivalence.
  const keys=text=>Array.from(text.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g),m=>JSON.parse(m[1]));
  if(!known(a)||!known(b)){
   const unfamiliar=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).some(k=>k!=='crons');
   return code(unfamiliar(a)||unfamiliar(b)?'OTHER':'STRUCTURE_CHANGED');
  }
  if(keys(before).length!==1+2*a.crons.length||keys(after).length!==1+2*b.crons.length)return code('OTHER');
  if(before.replace(/\r\n/g,'\n')===after.replace(/\r\n/g,'\n'))return code('LINE_ENDING_ONLY');
  if(compact(before)===compact(after))return code('WHITESPACE_ONLY');
  if(a.crons.length!==b.crons.length||a.crons.some((row,i)=>row.path!==b.crons[i].path||row.schedule!==b.crons[i].schedule))return code('CRON_CHANGED');
  return code('JSON_EQUIVALENT');
 }catch{return code('OTHER');}
}
// Fixed path only, bounded read, no symlink following and no diagnostic output.
export function readWorkingVercelConfig(){
 const fd=openSync('vercel.json',constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const stat=fstatSync(fd);if(!stat.isFile()||stat.size>limit)throw Error('CONFIG_DIAGNOSTIC_UNAVAILABLE');
  const bytes=Buffer.alloc(limit+1);let size=0,n;
  while(size<bytes.length&&(n=readSync(fd,bytes,size,bytes.length-size,null))>0)size+=n;
  if(size>limit)throw Error('CONFIG_DIAGNOSTIC_UNAVAILABLE');
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size));
 }finally{closeSync(fd);}
}
/** @param {(file: string, args: string[], options: import('node:child_process').ExecFileSyncOptionsWithStringEncoding) => string} run */
export function vercelConfigDiagnostic(run=execFileSync,read=readWorkingVercelConfig){
 try{return classifyVercelConfig(run('git',['show','HEAD:vercel.json'],{encoding:'utf8',stdio:'pipe',timeout:5000,maxBuffer:limit}),read());}
 catch{return code('OTHER');}
}
