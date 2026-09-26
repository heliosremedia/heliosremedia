import assert from 'node:assert/strict';
import {HOSTED,IGNORE,createRequest} from './policy.mjs';
export function vercelClient(token,transport=fetch){
 assert.ok(token,'Missing staging credential');
 const projectPath='/v9/projects/'+HOSTED.project;
 return async function api(path,method='GET',body){
  const projectRead=method==='GET'&&(path===projectPath||path===projectPath+'/domains'||path===projectPath+'/env');
  const suppression=method==='PATCH'&&path===projectPath&&Object.keys(body||{}).length===1&&[IGNORE,'exit 0'].includes(body.commandForIgnoringBuildStep);
  const envWrite=method==='POST'&&path==='/v10/projects/'+HOSTED.project+'/env'&&body.gitBranch===HOSTED.branch&&JSON.stringify(body.target)==='["preview"]';
  const envDelete=method==='DELETE'&&new RegExp('^'+projectPath+'/env/[A-Za-z0-9_-]+$').test(path);
  const deploymentCreate=method==='POST'&&path==='/v13/deployments'&&JSON.stringify(body)===JSON.stringify(createRequest());
  const deploymentRead=method==='GET'&&(/^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/.test(path)||/^\/v3\/deployments\/dpl_[A-Za-z0-9]+\/events$/.test(path));
  assert.ok(projectRead||suppression||envWrite||envDelete||deploymentCreate||deploymentRead,'Unsupported Vercel operation');
  const response=await transport('https://api.vercel.com'+path+'?teamId='+HOSTED.team+(path.endsWith('/events')?'&follow=0&limit=-1&builds=1':''),{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw Error('VERCEL_HTTP_'+response.status);return response.status===204?{}:response.json();
 };
}
