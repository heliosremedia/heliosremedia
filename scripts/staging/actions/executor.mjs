import assert from 'node:assert/strict';
import {invocation,deployment,CANDIDATE} from './policy.mjs';
import {diagnostic,blockedError} from './diagnostics.mjs';
// Effects injected for exhaustive failure-order tests. POST is admitted once, never retried.
export async function execute(deps,env){
 invocation(env);let phase='preflight',before,id,firstFailure,qualified=false;const evidence={candidate:CANDIDATE,executor:env.GITHUB_SHA,phases:[],failures:[]};
 try{
  before=await deps.preflight();evidence.before=before;evidence.phases.push(phase);
  phase='configure-preview';await deps.configure();evidence.phases.push(phase);
  phase='create-preview';const created=await deps.create();id=created.id;evidence.deployment=deployment(created);evidence.phases.push(phase);
  phase='wait-build';const ready=await deps.wait(id);evidence.deployment=deployment(ready,id);assert.equal(ready.readyState,'READY');evidence.phases.push(phase);
  phase='build-receipt';evidence.build=await deps.receipt(id);evidence.phases.push(phase);
  phase='hosted-http-chromium';evidence.qualification=await deps.qualify(ready);qualified=true;evidence.phases.push(phase);
 }catch(error){firstFailure=error;evidence.failures.push(diagnostic(phase,error));}
 finally{
  // Preflight rejection must cause no mutation, including "cleanup" against an unqualified target.
  if(before){
   for(const [name,fn] of [['restore-suppression',()=>deps.suppress()],['restore-fixtures',()=>deps.unbind()],['remove-temporary-configuration',()=>deps.unconfigure()],['schema-ledger-postflight',async()=>{const after=await deps.postflight();assert.deepEqual(after,before);evidence.after=after;}]]){
    try{await fn();evidence.phases.push(name);}catch(error){evidence.failures.push(diagnostic(name,error));}
   }
  }
  if(id){try{evidence.events=await deps.diagnostics(id);}catch(error){evidence.failures.push(diagnostic('collect-build-diagnostics',error));}}
  evidence.success=qualified&&evidence.failures.length===0;await deps.persist(evidence);
 }
 if(!evidence.success)throw blockedError(firstFailure);return evidence;
}
