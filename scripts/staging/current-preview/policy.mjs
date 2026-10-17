import assert from 'node:assert/strict';
import {HOSTED,CURRENT_STUDIO_SOURCE_BRANCH as BRANCH} from '../hosted-policy.mjs';
import {REF,TARGET} from '../policy.mjs';
import {project as legacyProject} from '../actions/policy.mjs';
export {HOSTED,BRANCH};
export const CONFIRMATION='retain-current-preview-for-synthetic-owner-testing-only';
export function invocation(e,checkout){
 assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,'heliosremedia/heliosremedia');
 assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(e.GITHUB_REF,REF);
 assert.equal(e.GITHUB_WORKFLOW_REF,'heliosremedia/heliosremedia/.github/workflows/v2-vercel-staging-qualification.yml@'+REF);
 assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(e.STAGING_EXECUTOR_SHA,e.GITHUB_SHA);
 assert.match(e.STAGING_CANDIDATE_SHA||'',/^[a-f0-9]{40}$/);assert.equal(checkout,e.STAGING_CANDIDATE_SHA);
 assert.equal(e.STAGING_CONFIRMATION,TARGET.project+'/'+TARGET.branch+'/'+TARGET.database);
 assert.equal(e.STAGING_HOSTED_CONFIRMATION,CONFIRMATION);
 assert.match(e.STAGING_PREVIEW_REHEARSAL_SHA||'',/^[a-f0-9]{40}$/);assert.match(e.STAGING_RELEASE_RUN_ID||'',/^[1-9][0-9]+$/);assert.match(e.STAGING_PREVIEW_REHEARSAL_RUN||'',/^[1-9][0-9]+$/);
 assert.ok(!e.VERCEL&&!e.VERCEL_ENV&&!e.HELIOS_RELEASE_TARGET);
 return checkout;
}
export function project(p,domains){legacyProject(p,domains);assert.notEqual(p.link?.productionBranch,BRANCH);}
export function qualifiedRun(run,candidate,path,{integration=false}={}){
 assert.equal(run.head_sha,candidate);assert.equal(run.repository?.full_name,'heliosremedia/heliosremedia');
 assert.equal(run.event,'push');assert.equal(run.path,path);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 if(integration)assert.equal(run.head_branch,BRANCH);
}
export function deployment(d,candidate,id){
 assert.equal(d.projectId,HOSTED.project);assert.equal(d.ownerId,HOSTED.team);assert.equal(d.target,null);assert.ok(!d.customEnvironment);
 assert.equal(d.gitSource?.type,'github');assert.equal(String(d.gitSource.repoId),String(HOSTED.repository));
 assert.equal(d.gitSource.sha,candidate);assert.equal(d.gitSource.ref,BRANCH);assert.match(d.id,/^dpl_[A-Za-z0-9]+$/);
 if(id)assert.equal(d.id,id);
 for(const host of [d.url,...(d.alias||[])])assert.match(host,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/);
 assert.ok(['QUEUED','INITIALIZING','BUILDING','READY','ERROR','CANCELED'].includes(d.readyState));
 return {id:d.id,url:d.url,source:candidate,state:d.readyState,target:'preview',project:HOSTED.project,team:HOSTED.team};
}
export function createRequest(candidate){assert.match(candidate,/^[a-f0-9]{40}$/);return {name:'helios-v2-staging',project:HOSTED.project,gitSource:{type:'github',repoId:HOSTED.repository,ref:BRANCH,sha:candidate},withLatestCommit:false};}
export function ignore(candidate){assert.match(candidate,/^[a-f0-9]{40}$/);return `if [ "$VERCEL_ENV" = preview ] && [ "$VERCEL_GIT_COMMIT_SHA" = ${candidate} ]; then exit 1; else exit 0; fi`;}
export const CONFIG_KEYS=Object.freeze(['DATABASE_URL','DIRECT_URL','AUTH_SECRET','STUDIO_V2_TENANT_CONTEXT_ENABLED','STUDIO_V2_SHELL_ENABLED','STUDIO_V2_SHELL_WORKSPACE_IDS','STAGING_SCHEMA_PROFILE','STAGING_HOSTED_ADMISSION','STAGING_CANDIDATE_SHA','STAGING_RELEASE_RUN_ID','STAGING_VERCEL_READ_TOKEN','STAGING_GITHUB_READ_TOKEN','STAGING_NEON_API_KEY','VERCEL_ORG_ID','VERCEL_PROJECT_ID']);
export function apiClient(token,candidate,marker,transport=fetch){
 assert.ok(token);createRequest(candidate);assert.match(marker,/^studio-owner-preview-[1-9][0-9]+$/);
 const p='/v9/projects/'+HOSTED.project;
 return async(path,method='GET',body)=>{
  const read=method==='GET'&&([p,p+'/domains',p+'/env'].includes(path)||/^\/v13\/deployments\/dpl_[A-Za-z0-9]+$/.test(path)||/^\/v3\/deployments\/dpl_[A-Za-z0-9]+\/events$/.test(path));
  const suppress=method==='PATCH'&&path===p&&Object.keys(body||{}).length===1&&[ignore(candidate),'exit 0'].includes(body.commandForIgnoringBuildStep);
  const env=method==='POST'&&path==='/v10/projects/'+HOSTED.project+'/env'&&CONFIG_KEYS.includes(body.key)&&body.gitBranch===BRANCH&&JSON.stringify(body.target)==='["preview"]'&&body.comment===marker&&['plain','encrypted'].includes(body.type)&&typeof body.value==='string'&&body.value.length>0;
  const remove=method==='DELETE'&&new RegExp('^'+p+'/env/[A-Za-z0-9_-]+$').test(path);
  const create=method==='POST'&&path==='/v13/deployments'&&JSON.stringify(body)===JSON.stringify(createRequest(candidate));
  assert.ok(read||suppress||env||remove||create,'Unsupported current Preview operation');
  const r=await transport('https://api.vercel.com'+path+'?teamId='+HOSTED.team+(path.endsWith('/events')?'&follow=0&limit=-1&builds=1':''),{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw Error('VERCEL_HTTP_'+r.status);return r.status===204?{}:r.json();
 };
}
