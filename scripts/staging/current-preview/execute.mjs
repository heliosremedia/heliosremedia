import assert from 'node:assert/strict';
import {deployment} from './policy.mjs';
// Retain host bindings only after every qualification and cleanup gate succeeds.
// Cleanup always suppresses builds; uncertainty never causes another deployment POST.
export async function executePreview(deps,{candidate,executor}){
 let phase='preflight',before,id,qualified=false;
 const evidence={version:1,candidate,executor,phases:[],failures:[],ownerAccessQualified:false};
 const fail=p=>evidence.failures.push({phase:p,reason:'blocked'});
 try{
  before=await deps.preflight();evidence.before=before;evidence.phases.push(phase);
  phase='configure-preview';await deps.configure();evidence.phases.push(phase);
  phase='create-preview';const created=await deps.create();id=created.id;evidence.deployment=deployment(created,candidate);evidence.phases.push(phase);
  phase='wait-build';const ready=await deps.wait(id);evidence.deployment=deployment(ready,candidate,id);assert.equal(ready.readyState,'READY');evidence.phases.push(phase);
  phase='build-receipt';evidence.build=await deps.receipt(id);evidence.phases.push(phase);
  phase='bind-owner-hosts';evidence.bindings=await deps.bind(ready);evidence.phases.push(phase);
  phase='ordinary-owner-http-chromium';evidence.qualification=await deps.qualify(evidence.bindings);qualified=true;evidence.phases.push(phase);
 }catch{fail(phase);}
 if(before){
  for(const [name,fn] of [['restore-suppression',deps.suppress],['remove-run-configuration',deps.unconfigure],['verify-stored-transition',async()=>{evidence.after=await deps.postflight(qualified);} ]]){
   try{await fn();evidence.phases.push(name);}catch{fail(name);}
  }
  if(!qualified||evidence.failures.length){try{await deps.unbind();evidence.phases.push('restore-hosts');}catch{fail('restore-hosts');}}
 }
 evidence.success=qualified&&evidence.failures.length===0;evidence.ownerAccessQualified=evidence.success;
 if(evidence.success){evidence.testingURLs=evidence.bindings.map(b=>({workspace:b.workspaceId,url:'https://'+b.hostname+'/login?next=%2Fadmin%2Fstudio'}));evidence.persistentHostnameBindings=true;}
 if(id)try{evidence.events=await deps.events(id);}catch{fail('event-diagnostics');evidence.success=false;evidence.ownerAccessQualified=false;delete evidence.testingURLs;delete evidence.persistentHostnameBindings;try{await deps.unbind();}catch{fail('restore-hosts');}}
 await deps.persist(evidence);if(!evidence.success)throw Error('CURRENT_OWNER_PREVIEW_BLOCKED');return evidence;
}
