import assert from 'node:assert/strict';
import {HOSTED} from '../hosted-policy.mjs';
export {HOSTED};
export const CANDIDATE='dbfb19909d3fe0bb91d81a478210373340f86e86';
export const RELEASE_RUN=35556635812;
export const CONFIRMATION='deploy-preview-and-qualify-synthetic-tenants-only';
export const IGNORE=`if [ "$VERCEL_ENV" = preview ] && [ "$VERCEL_GIT_COMMIT_SHA" = ${CANDIDATE} ]; then exit 1; else exit 0; fi`;
export function invocation(e){
 assert.equal(e.GITHUB_REPOSITORY,'heliosremedia/heliosremedia');assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(e.GITHUB_REF,'refs/heads/'+HOSTED.branch);assert.equal(e.STAGING_CANDIDATE_SHA,CANDIDATE);
 assert.equal(e.STAGING_EXECUTOR_SHA,e.GITHUB_SHA);assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/);
 assert.equal(e.STAGING_HOSTED_CONFIRMATION,CONFIRMATION);assert.equal(e.STAGING_TRACK,'current-baseline');
 assert.equal(e.STAGING_CONFIRMATION,'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging');
}
export function project(p,domains){
 assert.equal(p.id,HOSTED.project);assert.equal(p.accountId,HOSTED.team);assert.equal(p.name,'helios-v2-staging');
 assert.equal(p.link?.type,'github');assert.equal(String(p.link?.repoId),String(HOSTED.repository));
 assert.notEqual(p.link?.productionBranch,HOSTED.branch);assert.equal(p.commandForIgnoringBuildStep,'exit 0');
 assert.ok(p.autoExposeSystemEnvs);assert.ok(!p.rootDirectory);assert.ok(!p.outputDirectory);
 assert.ok([null,undefined,'npm run build'].includes(p.buildCommand));
 assert.ok([null,undefined,'npm ci --ignore-scripts'].includes(p.installCommand));
 assert.ok(!p.previewDeploymentSuffix&&!p.customEnvironments?.length);
 assert.deepEqual(domains.domains.map(d=>d.name),['helios-v2-staging.vercel.app']);assert.ok(!domains.pagination?.next);
}
export function deployment(d,expectedId){
 assert.equal(d.projectId,HOSTED.project);assert.equal(d.ownerId,HOSTED.team);assert.equal(d.target,null);assert.ok(!d.customEnvironment);
 assert.equal(d.gitSource?.type,'github');assert.equal(String(d.gitSource.repoId),String(HOSTED.repository));
 assert.equal(d.gitSource.sha,CANDIDATE);assert.equal(d.gitSource.ref,HOSTED.branch);
 assert.match(d.id,/^dpl_[A-Za-z0-9]+$/);if(expectedId)assert.equal(d.id,expectedId);
 for(const host of [d.url,...(d.alias||[])])assert.match(host,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/);
 assert.ok(['QUEUED','INITIALIZING','BUILDING','READY','ERROR','CANCELED'].includes(d.readyState));
 return {id:d.id,url:d.url,source:CANDIDATE,state:d.readyState,target:'preview',project:HOSTED.project,team:HOSTED.team};
}
export function createRequest(){return {name:'helios-v2-staging',project:HOSTED.project,gitSource:{type:'github',repoId:HOSTED.repository,ref:HOSTED.branch,sha:CANDIDATE},withLatestCommit:false};}
export function environmentInventory(rows){
 assert.ok(Array.isArray(rows));for(const r of rows){assert.ok(['DATABASE_URL','DIRECT_URL'].includes(r.key),'Unknown staging configuration');assert.ok(!r.gitBranch,'Existing branch overrides require review');}
}
