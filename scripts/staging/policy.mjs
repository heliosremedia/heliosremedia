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
 assert.equal(environment.name,ENVIRONMENT);assert.equal(environment.can_admins_bypass,false);
 const rule=environment.protection_rules?.find(r=>r.type==='required_reviewers');
 assert.ok(rule?.reviewers?.some(r=>r.type==='User'&&r.reviewer?.login==='heliosremedia'),'Owner reviewer required');
 assert.equal(environment.deployment_branch_policy?.custom_branch_policies,true);
 assert.equal(branches.total_count,1);assert.equal(branches.branch_policies?.length,1);
 assert.equal(branches.branch_policies[0].name,REF.slice(11));assert.equal(branches.branch_policies[0].type,'branch');
}
export function targetConnection({project,branch,endpoints,databases},value){
 assert.equal(project.id,TARGET.project);assert.equal(project.name,'helios-v2-staging');
 assert.equal(project.org_id,TARGET.organization);assert.equal(project.region_id,TARGET.region);assert.equal(project.pg_version,16);
 assert.equal(branch.id,TARGET.branch);assert.equal(branch.project_id,TARGET.project);assert.equal(branch.name,'main');assert.equal(branch.current_state,'ready');
 assert.ok(databases.some(d=>d.name===TARGET.database&&d.branch_id===TARGET.branch));
 const url=new URL(value);assert.ok(['postgresql:','postgres:'].includes(url.protocol));
 assert.equal(url.pathname,'/'+TARGET.database);assert.ok(url.username&&url.password);assert.ok(!url.hash);
 assert.ok(!url.port||url.port==='5432');assert.equal(url.searchParams.get('sslmode'),'require');
 assert.ok([...url.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k)));
 assert.ok(!url.hostname.includes('-pooler.'));
 assert.ok(endpoints.some(e=>e.project_id===TARGET.project&&e.branch_id===TARGET.branch&&e.type==='read_write'&&e.host===url.hostname));
 // pg's URL sslmode parser must not replace certificate verification settings.
 url.search='';return {connectionString:url.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,query_timeout:30000};
}
export async function jsonGet(url,token){
 assert.ok(token,'Missing scoped credential');
 const signal=AbortSignal.timeout(15000);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal});
 assert.equal(response.status,200,'Authenticated metadata unavailable');return response.json();
}
