import {check} from './diagnostics.mjs';
import assert from 'node:assert/strict';
import {HOSTED} from '../hosted-policy.mjs';
export {HOSTED};
export const CANDIDATE='dbfb19909d3fe0bb91d81a478210373340f86e86';
export const RELEASE_RUN=35556635812;
export const CONFIRMATION='deploy-preview-and-qualify-synthetic-tenants-only';
export const IGNORE=`if [ "$VERCEL_ENV" = preview ] && [ "$VERCEL_GIT_COMMIT_SHA" = ${CANDIDATE} ]; then exit 1; else exit 0; fi`;
export function invocation(e){
 check('GITHUB_REPOSITORY', ()=>assert.equal(e.GITHUB_REPOSITORY,'heliosremedia/heliosremedia'));check('GITHUB_EVENT', ()=>assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch'));
 check('GITHUB_BRANCH', ()=>assert.equal(e.GITHUB_REF,'refs/heads/'+HOSTED.branch));check('CANDIDATE_SHA', ()=>assert.equal(e.STAGING_CANDIDATE_SHA,CANDIDATE));
 check('EXECUTOR_SHA', ()=>assert.equal(e.STAGING_EXECUTOR_SHA,e.GITHUB_SHA));check('EXECUTOR_SHA_FORMAT', ()=>assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/));
 check('HOSTED_CONFIRMATION', ()=>assert.equal(e.STAGING_HOSTED_CONFIRMATION,CONFIRMATION));check('MIGRATION_TRACK', ()=>assert.equal(e.STAGING_TRACK,'current-baseline'));
 check('DATABASE_CONFIRMATION', ()=>assert.equal(e.STAGING_CONFIRMATION,'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging'));
}
export function project(p,domains){
 check('VERCEL_PROJECT_ID', ()=>assert.equal(p.id,HOSTED.project));check('VERCEL_TEAM_ID', ()=>assert.equal(p.accountId,HOSTED.team));check('VERCEL_PROJECT_NAME', ()=>assert.equal(p.name,'helios-v2-staging'));
 check('VERCEL_GIT_PROVIDER', ()=>assert.equal(p.link?.type,'github'));check('VERCEL_REPOSITORY_ID', ()=>assert.equal(String(p.link?.repoId),String(HOSTED.repository)));
 check('VERCEL_PRODUCTION_BRANCH', ()=>assert.notEqual(p.link?.productionBranch,HOSTED.branch));check('STAGING_SUPPRESSION', ()=>assert.equal(p.commandForIgnoringBuildStep,'exit 0'));
 check('VERCEL_SYSTEM_ENV', ()=>assert.ok(p.autoExposeSystemEnvs));check('VERCEL_ROOT_DIRECTORY', ()=>assert.ok(!p.rootDirectory));check('VERCEL_OUTPUT_DIRECTORY', ()=>assert.ok(!p.outputDirectory));
 check('VERCEL_BUILD_COMMAND', ()=>assert.ok([null,undefined,'npm run build'].includes(p.buildCommand)));
 check('VERCEL_INSTALL_COMMAND', ()=>assert.ok([null,undefined,'npm ci --ignore-scripts'].includes(p.installCommand)));
 check('VERCEL_CUSTOM_ENVIRONMENT', ()=>assert.ok(!p.previewDeploymentSuffix&&!p.customEnvironments?.length));
 check('VERCEL_DOMAIN_SET', ()=>assert.deepEqual(domains.domains.map(d=>d.name),['helios-v2-staging.vercel.app']));check('VERCEL_DOMAIN_PAGINATION', ()=>assert.ok(!domains.pagination?.next));
}
export function deployment(d,expectedId){
 check('DEPLOYMENT_PROJECT_ID', ()=>assert.equal(d.projectId,HOSTED.project));check('DEPLOYMENT_TEAM_ID', ()=>assert.equal(d.ownerId,HOSTED.team));check('DEPLOYMENT_TARGET', ()=>assert.equal(d.target,null));check('DEPLOYMENT_CUSTOM_ENVIRONMENT', ()=>assert.ok(!d.customEnvironment));
 check('DEPLOYMENT_GIT_PROVIDER', ()=>assert.equal(d.gitSource?.type,'github'));check('DEPLOYMENT_REPOSITORY_ID', ()=>assert.equal(String(d.gitSource.repoId),String(HOSTED.repository)));
 check('DEPLOYMENT_SOURCE_SHA', ()=>assert.equal(d.gitSource.sha,CANDIDATE));check('DEPLOYMENT_SOURCE_REF', ()=>assert.equal(d.gitSource.ref,HOSTED.branch));
 check('DEPLOYMENT_ID_FORMAT', ()=>assert.match(d.id,/^dpl_[A-Za-z0-9]+$/));if(expectedId)check('DEPLOYMENT_ID', ()=>assert.equal(d.id,expectedId));
 for(const host of [d.url,...(d.alias||[])])check('DEPLOYMENT_HOSTNAME', ()=>assert.match(host,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/));
 check('DEPLOYMENT_STATE', ()=>assert.ok(['QUEUED','INITIALIZING','BUILDING','READY','ERROR','CANCELED'].includes(d.readyState)));
 return {id:d.id,url:d.url,source:CANDIDATE,state:d.readyState,target:'preview',project:HOSTED.project,team:HOSTED.team};
}
export function createRequest(){return {name:'helios-v2-staging',project:HOSTED.project,gitSource:{type:'github',repoId:HOSTED.repository,ref:HOSTED.branch,sha:CANDIDATE},withLatestCommit:false};}
export function environmentInventory(rows){
 check('VERCEL_ENV_INVENTORY', ()=>assert.ok(Array.isArray(rows)));for(const r of rows){check('VERCEL_ENV_KEY', ()=>assert.ok(['DATABASE_URL','DIRECT_URL'].includes(r.key),'Unknown staging configuration'));check('VERCEL_ENV_BRANCH_OVERRIDE', ()=>assert.ok(!r.gitBranch,'Existing branch overrides require review'));}
}
