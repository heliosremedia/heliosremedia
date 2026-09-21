import {createHash} from 'node:crypto';
import {CHECK_CODES} from './check-codes.mjs';
const allowed=new Set(CHECK_CODES);
const labels=new WeakMap();
function label(code,error){
 // Preserve original errors and throw semantics; labels cannot come from provider error properties.
 if(error && (typeof error==='object'||typeof error==='function')){
  const prior=labels.get(error)||[];labels.set(error,[...prior,code]);
 }
 return error;
}
export function check(code,operation){
 if(!allowed.has(code))throw new Error('UNKNOWN_DIAGNOSTIC_CHECK');
 try{return operation();}catch(error){throw label(code,error);}
}
export async function checked(code,operation){
 if(!allowed.has(code))throw new Error('UNKNOWN_DIAGNOSTIC_CHECK');
 try{return await operation();}catch(error){throw label(code,error);}
}
const phases=new Set(['preflight','executor','configure-preview','create-preview','wait-build','build-receipt','hosted-http-chromium','restore-suppression','restore-fixtures','remove-temporary-configuration','schema-ledger-postflight','collect-build-diagnostics','provider-build-event','runtime','provider-provenance','source-integrity','database-preflight','application-build','database-postflight','artifact-digest','receipt-persistence']);
// Never serialize raw Error, response bodies, URLs, request headers or environment values.
export function blockedError(original){
 const safe=new Error('STAGING_EXECUTOR_BLOCKED');
 const codes=labels.get(original);if(codes)labels.set(safe,codes);
 return safe;
}
export function diagnostic(phase,error){
 phase=phases.has(phase)?phase:'executor';
 const text=String(error?.stderr||error?.message||'');
 const codes=labels.get(error);
 if(codes?.length)return {phase,reason:'CHECK_'+codes.slice().reverse().join('__'),matched:false,detailHash:createHash('sha256').update(text).digest('hex')};
 const http=/VERCEL_HTTP_(\d{3})/.exec(text);if(http)return {phase,reason:'VERCEL_HTTP_'+http[1],detailHash:createHash('sha256').update(text).digest('hex')};
 const patterns=[['SCHEMA_LEDGER_REJECTED',/schema|ledger|migration/i],['MISSING_CONFIGURATION',/Missing|environment variable/i],['PROVIDER_DISABLED',/R2_DISABLED|provider configuration/i],['BUILD_FAILED',/Command failed|Build error|compile/i],['NETWORK_OR_TIMEOUT',/timeout|fetch|network|ECONN/i],['IDENTITY_OR_CONTRACT_MISMATCH',/Assertion|match|equal/i]];
 return {phase,reason:patterns.find(([,p])=>p.test(text))?.[0]||'CONTRACT_OR_EXECUTION_FAILED',detailHash:createHash('sha256').update(text).digest('hex')};
}
export function eventsSummary(events){
 if(!Array.isArray(events))throw Error('Invalid events');
 return events.map((e,index)=>({index,type:['stdout','stderr','command','exit','deployment-state'].includes(e.type)?e.type:'other',...diagnostic('provider-build-event',{message:String(e.text||e.payload?.text||'')})}));
}
