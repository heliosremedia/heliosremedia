import {createHash} from 'node:crypto';
// Never serialize raw Error, response bodies, URLs, request headers or environment values.
export function diagnostic(phase,error){
 const text=String(error?.stderr||error?.message||'');
 const http=/VERCEL_HTTP_(\d{3})/.exec(text);if(http)return {phase,reason:'VERCEL_HTTP_'+http[1],detailHash:createHash('sha256').update(text).digest('hex')};
 const patterns=[['SCHEMA_LEDGER_REJECTED',/schema|ledger|migration/i],['MISSING_CONFIGURATION',/Missing|environment variable/i],['PROVIDER_DISABLED',/R2_DISABLED|provider configuration/i],['BUILD_FAILED',/Command failed|Build error|compile/i],['NETWORK_OR_TIMEOUT',/timeout|fetch|network|ECONN/i],['IDENTITY_OR_CONTRACT_MISMATCH',/Assertion|match|equal/i]];
 return {phase,reason:patterns.find(([,p])=>p.test(text))?.[0]||'CONTRACT_OR_EXECUTION_FAILED',detailHash:createHash('sha256').update(text).digest('hex')};
}
export function eventsSummary(events){
 if(!Array.isArray(events))throw Error('Invalid events');
 return events.map((e,index)=>({index,type:['stdout','stderr','command','exit','deployment-state'].includes(e.type)?e.type:'other',...diagnostic('provider-build-event',{message:String(e.text||e.payload?.text||'')})}));
}
