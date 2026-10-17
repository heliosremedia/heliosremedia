import {check} from './actions/diagnostics.mjs';
import assert from 'node:assert/strict';
export const TARGET=Object.freeze({project:'calm-shape-83359560',branch:'br-young-math-arj7l4r3',database:'helios_v2_staging',organization:'org-nameless-shape-94202911',region:'aws-us-west-2'});
export const REF='refs/heads/codex/v2-neon-staging-bootstrap';
export const ENVIRONMENT='helios-v2-staging-bootstrap';
export function invocation(env){
 assert.equal(env.GITHUB_REPOSITORY,'heliosremedia/heliosremedia');
 assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(env.GITHUB_REF,REF);
 assert.match(env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(env.STAGING_CANDIDATE_SHA,env.GITHUB_SHA);
 assert.ok(['clean-bootstrap','current-baseline'].includes(env.STAGING_TRACK));
 assert.equal(env.STAGING_CONFIRMATION,TARGET.project+'/'+TARGET.branch+'/'+TARGET.database);
 assert.ok(!env.VERCEL&&!env.VERCEL_ENV&&!env.HELIOS_RELEASE_TARGET);
 return env.GITHUB_SHA;
}
export function protection(environment,branches){
 check('ENVIRONMENT_NAME', ()=>assert.equal(environment.name,ENVIRONMENT));check('ENVIRONMENT_ADMIN_BYPASS', ()=>assert.equal(environment.can_admins_bypass,false));
 const rule=environment.protection_rules?.find(r=>r.type==='required_reviewers');
 check('ENVIRONMENT_OWNER_REVIEWER', ()=>assert.ok(rule?.reviewers?.some(r=>r.type==='User'&&r.reviewer?.login==='heliosremedia'),'Owner reviewer required'));
 check('ENVIRONMENT_BRANCH_POLICY', ()=>assert.equal(environment.deployment_branch_policy?.custom_branch_policies,true));
 check('ENVIRONMENT_BRANCH_COUNT', ()=>assert.equal(branches.total_count,1));check('ENVIRONMENT_BRANCH_LENGTH', ()=>assert.equal(branches.branch_policies?.length,1));
 check('ENVIRONMENT_BRANCH_NAME', ()=>assert.equal(branches.branch_policies[0].name,REF.slice(11)));check('ENVIRONMENT_BRANCH_TYPE', ()=>assert.equal(branches.branch_policies[0].type,'branch'));
}
export function targetConnection({project,branch,endpoints,databases},value){
 check('NEON_PROJECT_ID', ()=>assert.equal(project.id,TARGET.project));check('NEON_PROJECT_NAME', ()=>assert.equal(project.name,'helios-v2-staging'));
 check('NEON_ORGANIZATION', ()=>assert.equal(project.org_id,TARGET.organization));check('NEON_REGION', ()=>assert.equal(project.region_id,TARGET.region));check('NEON_POSTGRES_VERSION', ()=>assert.equal(project.pg_version,16));
 check('NEON_BRANCH_ID', ()=>assert.equal(branch.id,TARGET.branch));check('NEON_BRANCH_PROJECT', ()=>assert.equal(branch.project_id,TARGET.project));check('NEON_BRANCH_NAME', ()=>assert.equal(branch.name,'main'));check('NEON_BRANCH_STATE', ()=>assert.equal(branch.current_state,'ready'));
 check('NEON_DATABASE_IDENTITY', ()=>assert.ok(databases.some(d=>d.name===TARGET.database&&d.branch_id===TARGET.branch)));
 const url=check('DATABASE_URL_PARSE', ()=>new URL(value));check('DATABASE_PROTOCOL', ()=>assert.ok(['postgresql:','postgres:'].includes(url.protocol)));
 check('DATABASE_NAME', ()=>assert.equal(url.pathname,'/'+TARGET.database));check('DATABASE_CREDENTIAL_PRESENCE', ()=>assert.ok(url.username&&url.password));check('DATABASE_FRAGMENT', ()=>assert.ok(!url.hash));
 check('DATABASE_PORT', ()=>assert.ok(!url.port||url.port==='5432'));check('DATABASE_TLS', ()=>assert.equal(url.searchParams.get('sslmode'),'require'));
 check('DATABASE_QUERY_KEYS', ()=>assert.ok([...url.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k))));
 check('DATABASE_DIRECT_ENDPOINT', ()=>assert.ok(!url.hostname.includes('-pooler.')));
 check('DATABASE_ENDPOINT_OWNERSHIP', ()=>assert.ok(endpoints.some(e=>e.project_id===TARGET.project&&e.branch_id===TARGET.branch&&e.type==='read_write'&&e.host===url.hostname)));
 // pg's URL sslmode parser must not replace certificate verification settings.
 url.search='';return {connectionString:url.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:30000};
}
export async function jsonGet(url,token){
 check('SCOPED_CREDENTIAL_PRESENCE', ()=>assert.ok(token,'Missing scoped credential'));
 const signal=AbortSignal.timeout(15000);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal});
 check('AUTHENTICATED_METADATA_STATUS', ()=>assert.equal(response.status,200,'Authenticated metadata unavailable'));return response.json();
}
