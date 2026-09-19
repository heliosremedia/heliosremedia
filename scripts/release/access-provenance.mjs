// Read-only access discovery. No environment loading, mutation, retry, or synthetic fallback.
const id=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const sha=value=>typeof value==='string' && /^[a-f0-9]{40}$/.test(value);
const sum=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
class AccessError extends Error { constructor(code){super(code);this.code=code;} }
const need=(condition,code)=>{if(!condition)throw new AccessError(code);};
const blocked=(mode,reason)=>({version:1,provider:'vercel',mode,result:'blocked',reason,deployable:false});

export async function inventoryVercel({token,teamId,fetchImpl=fetch,timeoutMs=10000}){
 if(!token)return blocked('authenticated-read-only','NO_CREDENTIALS');
 if(!id(teamId))return blocked('authenticated-read-only','TEAM_REQUIRED');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)return blocked('authenticated-read-only','INVALID_TIMEOUT');
 const get=async path=>{
  let timer;
  const controller=new AbortController();
  try {
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AccessError('PROVIDER_UNAVAILABLE'));},timeoutMs);});
   return await Promise.race([timeout,(async()=>{
    const response=await fetchImpl('https://api.vercel.com'+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:controller.signal});
    need(response.status!==401 && response.status!==403,'ACCESS_DENIED');
    need(response.status===200,'PROVIDER_UNAVAILABLE');
    return await response.json();
   })()]);
  }finally{clearTimeout(timer);}
 };
 try {
  const teams=await get('/v2/teams');
  need(Array.isArray(teams.teams),'PARTIAL_METADATA');
  need(teams.teams.some(t=>t.id===teamId),'TEAM_NOT_VISIBLE');
  const projects=await get('/v9/projects?teamId='+encodeURIComponent(teamId));
  need(Array.isArray(projects.projects),'PARTIAL_METADATA');
  // Never persist provider responses: project responses may contain environment values.
  const visible=projects.projects.map(p=>{need(id(p.id),'PARTIAL_METADATA');return {id:p.id};});
  const complete=!projects.pagination?.next;
  return {version:1,provider:'vercel',mode:'authenticated-read-only',teamId,projectIds:visible.map(p=>p.id),projectsComplete:complete,
   result:'blocked',reason:!complete?'INCOMPLETE_INVENTORY':visible.length?'TARGET_QUALIFICATION_REQUIRED':'PROJECT_NOT_VISIBLE',deployable:false};
 }catch(error){return blocked('authenticated-read-only',error instanceof AccessError?error.code:'PROVIDER_UNAVAILABLE');}
}

// Pure qualification of separately retrieved snapshots. Does not claim authentication
// of caller-supplied JSON and cannot turn #320 synthetic receipts into live admission.
export function qualifyProvenance({project,deployment,domains,expected,database,artifactProof,observedAt,now}){
 try {
  need(expected && id(expected.teamId) && id(expected.projectId) && id(expected.deploymentId),'TARGET_REQUIRED');
  need(['candidate','rollback'].includes(expected.role),'ROLE_MISMATCH');
  need(sha(expected.sourceSha) && sum(expected.manifestDigest),'PARTIAL_METADATA');
  need(Number.isSafeInteger(now) && Number.isSafeInteger(observedAt) && now>=observedAt && now-observedAt<=60000,'STALE_OBSERVATION');
  need(project && deployment,'DEPLOYMENT_NOT_FOUND');
  need(project.id===expected.projectId && deployment.projectId===project.id,'PROJECT_MISMATCH');
  need(project.accountId===expected.teamId && deployment.ownerId===expected.teamId,'TEAM_MISMATCH');
  need(deployment.id===expected.deploymentId,'DEPLOYMENT_MISMATCH');
  need(deployment.target!=='production','PRODUCTION_ENVIRONMENT');
  // Explicit null means preview in Vercel's API; missing/undefined is NOT preview.
  need(Object.hasOwn(deployment,'target') && deployment.target===null,'UNKNOWN_ENVIRONMENT');
  need(deployment.readyState==='READY','DEPLOYMENT_NOT_READY');
  need(Number.isSafeInteger(deployment.createdAt) && deployment.createdAt>=expected.notBefore && deployment.createdAt<=now,'STALE_DEPLOYMENT');
  need(Array.isArray(domains) && Array.isArray(deployment.alias),'PARTIAL_METADATA');
  need(domains.length===0 && deployment.alias.length===0,'DOMAIN_OR_ALIAS_PRESENT');
  need(typeof deployment.url==='string' && /^[a-z0-9-]+\.vercel\.app$/.test(deployment.url),'PARTIAL_METADATA');
  need(deployment.gitSource?.sha===expected.sourceSha,'SOURCE_MISMATCH');
  need(database?.classification!=='production','PRODUCTION_DATABASE');
  need(database?.classification==='isolated-non-production','DATABASE_UNKNOWN');
  need(id(expected.databaseId) && database.id===expected.databaseId && database.ownerTeamId===expected.teamId,'DATABASE_MISMATCH');
  need(database.isolationVerified===true && database.disposable===true && database.providers==='synthetic-only','DATABASE_UNKNOWN');
  need(database.checkedAt===observedAt && sum(database.schemaHash) && sum(database.ledgerHash),'DATABASE_UNKNOWN');
  need(database.ledgerState==='current-compatible-ledger','DATABASE_UNKNOWN');
  // A provider source SHA is not evidence that #320's exact build was uploaded.
  need(artifactProof?.role===expected.role,'ROLE_MISMATCH');
  need(artifactProof?.deploymentId===deployment.id && artifactProof?.manifestDigest===expected.manifestDigest && artifactProof?.sourceSha===expected.sourceSha,'ARTIFACT_CORRELATION_MISSING');
  need(artifactProof?.authenticatedUploadReceipt===true,'ARTIFACT_CORRELATION_MISSING');
  return {version:1,provider:'vercel',mode:'snapshot-validation-only',result:'metadata-consistent',deployable:false,
   projectId:project.id,deploymentId:deployment.id,environment:'preview',sourceSha:expected.sourceSha,manifestDigest:expected.manifestDigest,role:expected.role,
   reason:'LIVE_ADMISSION_NOT_ENABLED'};
 }catch(error){return blocked('snapshot-validation-only',error instanceof AccessError?error.code:'PARTIAL_METADATA');}
}
