import {check} from './actions/diagnostics.mjs';
// Diagnostic classification only; the admission predicate below remains authoritative.
const providerFamilies=[
 ['PROVIDER_FAMILY_R2',/^R2_/],
 ['PROVIDER_FAMILY_CLOUDFLARE',/^CLOUDFLARE_/],
 ['PROVIDER_FAMILY_AWS',/^AWS_/],
 ['PROVIDER_FAMILY_RESEND',/^RESEND_/],
 ['PROVIDER_FAMILY_OPENAI',/^OPENAI_/],
 ['PROVIDER_FAMILY_GOOGLE',/^GOOGLE_/],
 ['PROVIDER_FAMILY_SOCIAL',/^SOCIAL_/],
 ['PROVIDER_FAMILY_META',/^META_/],
 ['PROVIDER_FAMILY_LINKEDIN',/^LINKEDIN_/],
 ['PROVIDER_FAMILY_TIKTOK',/^TIKTOK_/],
 ['PROVIDER_FAMILY_UPTIMEROBOT',/^UPTIMEROBOT_/],
 ['PROVIDER_FAMILY_NEWSLETTER',/^NEWSLETTER_/],
 ['PROVIDER_FAMILY_INQUIRY',/^INQUIRY_/],
 ['PROVIDER_FAMILY_HDPH',/^HDPH_/],
 ['PROVIDER_FAMILY_CRON',/^CRON_SECRET$/],
 ['PROVIDER_FAMILY_HELIOS_ADMIN',/^HELIOS_ADMIN_/],
 ['PROVIDER_FAMILY_ANALYTICS',/^NEXT_PUBLIC_GA_/],
 ['PROVIDER_FAMILY_PRODUCTION_SITE',/^NEXT_PUBLIC_SITE_URL$/],
 ['PROVIDER_FAMILY_CAMPAIGN',/^CAMPAIGN_/],
 ['PROVIDER_FAMILY_PORTAL',/^PORTAL_/],
];
// Exact-key lookup with literal outputs only. Never derive a code from an environment key.
const awsKeyCodes=new Map([
 ['AWS_ACCESS_KEY_ID','PROVIDER_AWS_ACCESS_KEY_ID'],
 ['AWS_SECRET_ACCESS_KEY','PROVIDER_AWS_SECRET_ACCESS_KEY'],
 ['AWS_SESSION_TOKEN','PROVIDER_AWS_SESSION_TOKEN'],
 ['AWS_SECURITY_TOKEN','PROVIDER_AWS_SECURITY_TOKEN'],
 ['AWS_REGION','PROVIDER_AWS_REGION'],
 ['AWS_DEFAULT_REGION','PROVIDER_AWS_DEFAULT_REGION'],
 ['AWS_PROFILE','PROVIDER_AWS_PROFILE'],
 ['AWS_DEFAULT_PROFILE','PROVIDER_AWS_DEFAULT_PROFILE'],
 ['AWS_ROLE_ARN','PROVIDER_AWS_ROLE_ARN'],
 ['AWS_WEB_IDENTITY_TOKEN_FILE','PROVIDER_AWS_WEB_IDENTITY_TOKEN_FILE'],
 ['AWS_SHARED_CREDENTIALS_FILE','PROVIDER_AWS_SHARED_CREDENTIALS_FILE'],
 ['AWS_CONFIG_FILE','PROVIDER_AWS_CONFIG_FILE'],
 ['AWS_SDK_LOAD_CONFIG','PROVIDER_AWS_SDK_LOAD_CONFIG'],
 ['AWS_CONTAINER_CREDENTIALS_RELATIVE_URI','PROVIDER_AWS_CONTAINER_CREDENTIALS_RELATIVE_URI'],
 ['AWS_CONTAINER_CREDENTIALS_FULL_URI','PROVIDER_AWS_CONTAINER_CREDENTIALS_FULL_URI'],
 ['AWS_CONTAINER_AUTHORIZATION_TOKEN','PROVIDER_AWS_CONTAINER_AUTHORIZATION_TOKEN'],
 ['AWS_EXECUTION_ENV','PROVIDER_AWS_EXECUTION_ENV'],
 ['AWS_LAMBDA_FUNCTION_NAME','PROVIDER_AWS_LAMBDA_FUNCTION_NAME'],
 ['AWS_LAMBDA_FUNCTION_VERSION','PROVIDER_AWS_LAMBDA_FUNCTION_VERSION'],
 ['AWS_LAMBDA_LOG_GROUP_NAME','PROVIDER_AWS_LAMBDA_LOG_GROUP_NAME'],
 ['AWS_LAMBDA_LOG_STREAM_NAME','PROVIDER_AWS_LAMBDA_LOG_STREAM_NAME'],
]);
function providerFamily(key){
 if(key.startsWith('AWS_'))return awsKeyCodes.get(key)||'PROVIDER_AWS_UNKNOWN';
 return providerFamilies.find(([,pattern])=>pattern.test(key))?.[0]||'PROVIDER_FAMILY_UNKNOWN';
}
import assert from 'node:assert/strict';
import {TARGET,REF} from './policy.mjs';
import {digest,requireCandidate} from '../release/policy.mjs';
export const HOSTED={project:'prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg',team:'team_H79eaUfq9xMqcbf34ZCtwwn9',repository:1301054677,branch:REF.slice(11)};
export function runtime(env){
 assert.equal(env.STAGING_HOSTED_ADMISSION,'preview-only');
 assert.equal(env.VERCEL,'1');assert.equal(env.VERCEL_ENV,'preview');
 assert.equal(env.VERCEL_PROJECT_ID,HOSTED.project);assert.equal(env.VERCEL_ORG_ID,HOSTED.team);
 assert.equal(env.VERCEL_GIT_COMMIT_REF,HOSTED.branch);
 const sha=requireCandidate(env.STAGING_CANDIDATE_SHA||'');assert.equal(env.VERCEL_GIT_COMMIT_SHA,sha);
 assert.equal(env.STUDIO_V2_TENANT_CONTEXT_ENABLED,'true');
 assert.match(env.AUTH_SECRET||'',/^[a-f0-9]{96}$/,'Use a dedicated random 48-byte staging secret');
 assert.match(env.STAGING_RELEASE_RUN_ID||'',/^[1-9][0-9]*$/);
 assert.ok(!env.HELIOS_RELEASE_TARGET&&!env.STUDIO_V2_LOCAL_WORKSPACE_SLUG);
 // Deny all configured application provider families, not just their API keys.
 // Platform runtime metadata is exempt by exact name; never read its value.
 for(const key of Object.keys(env))if(key!=='AWS_EXECUTION_ENV'&&env[key])check(providerFamily(key),()=>assert.ok(!/^(R2_|CLOUDFLARE_|AWS_|RESEND_|OPENAI_|GOOGLE_|SOCIAL_|META_|LINKEDIN_|TIKTOK_|UPTIMEROBOT_|NEWSLETTER_|INQUIRY_|HDPH_|CRON_SECRET$|HELIOS_ADMIN_|INQUIRY_NOTIFICATION_|NEXT_PUBLIC_GA_|NEXT_PUBLIC_SITE_URL$|CAMPAIGN_|PORTAL_)/.test(key),'External provider configuration forbidden'));
 for(const key of ['DATABASE_URL','DIRECT_URL']){
  const u=new URL(env[key]);assert.ok(['postgres:','postgresql:'].includes(u.protocol));
  assert.equal(u.hostname,'ep-crimson-snow-araflu1k.c-4.us-west-2.aws.neon.tech');
  assert.equal(u.pathname,'/'+TARGET.database);assert.equal(u.searchParams.get('sslmode'),'require');
  assert.ok(u.username&&u.password&&!u.hash);assert.ok(!u.port||u.port==='5432');
  assert.ok([...u.searchParams.keys()].every(k=>['sslmode','channel_binding'].includes(k)));
 }
 assert.equal(env.DATABASE_URL,env.DIRECT_URL,'Use the verified direct staging connection for initial qualification');
 return sha;
}
export function provenance({project,deployment,domains,run,jobs},env){
 const candidate=runtime(env);
 assert.equal(project.id,HOSTED.project);assert.equal(project.name,'helios-v2-staging');assert.equal(project.accountId,HOSTED.team);
 assert.equal(project.link?.repoId,HOSTED.repository);assert.equal(project.link?.type,'github');
 assert.equal(deployment.projectId,HOSTED.project);assert.equal(deployment.ownerId,HOSTED.team);
 assert.equal(deployment.target,null,'Only Vercel Preview target null is supported');
 assert.ok(!deployment.customEnvironment);
 for(const alias of deployment.alias||[])assert.match(alias,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/,'Non-preview alias forbidden');assert.ok(['INITIALIZING','BUILDING'].includes(deployment.readyState));
 assert.equal(deployment.gitSource?.type,'github');assert.equal(String(deployment.gitSource.repoId),String(HOSTED.repository));
 assert.equal(deployment.gitSource.sha,candidate);assert.equal(deployment.gitSource.ref,HOSTED.branch);
 assert.equal(deployment.id,env.VERCEL_DEPLOYMENT_ID);assert.equal(deployment.url,env.VERCEL_URL);
 assert.ok(/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/.test(deployment.url));
 assert.ok(Array.isArray(domains.domains)&&domains.domains.length===1);
 assert.equal(domains.domains[0].name,'helios-v2-staging.vercel.app');assert.ok(!domains.pagination?.next);
 assert.equal(run.id.toString(),env.STAGING_RELEASE_RUN_ID);assert.equal(run.repository?.full_name,'heliosremedia/heliosremedia');
 assert.equal(run.head_sha,candidate);assert.equal(run.head_branch,HOSTED.branch);
 assert.equal(run.path,'.github/workflows/v2-regression.yml');assert.equal(run.event,'push');
 assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
 assert.equal(jobs.total_count,1);assert.equal(jobs.jobs?.length,1);
 assert.equal(jobs.jobs[0].conclusion,'success');assert.equal(jobs.jobs[0].name,'Tests and TypeScript');
 assert.ok(jobs.jobs[0].steps?.some(s=>s.name==='Run isolated regression tests'&&s.conclusion==='success'));
 return {candidate,project:project.id,team:project.accountId,deployment:deployment.id,url:deployment.url,environment:'preview',tests:{run:run.id,attempt:run.run_attempt,status:'passed'}};
}
export function receipt(proof,before,after,identity,buildDigest){
 assert.equal(before.state,'current-compatible-ledger');assert.equal(before.track,'baseline');
 assert.equal(after.state,before.state);assert.equal(after.track,before.track);
 assert.equal(after.schemaHash,before.schemaHash);assert.equal(after.ledgerHash,before.ledgerHash);
 assert.match(buildDigest,/^[a-f0-9]{64}$/);
 const body={version:1,kind:'staging-preview-build',...proof,database:TARGET,identity,schemaHash:after.schemaHash,ledgerHash:after.ledgerHash,buildDigest,hostedQualification:false,promotable:false};
 return {...body,checksum:digest(body)};
}
export function hostnameBindings(deployment,bindings){
 assert.equal(deployment.projectId,HOSTED.project);assert.equal(deployment.ownerId,HOSTED.team);assert.equal(deployment.target,null);assert.equal(deployment.readyState,'READY');
 const allowed=new Set([deployment.url,...(deployment.alias||[])]);
 assert.deepEqual(bindings.map(b=>b.workspaceId).sort(),['packet16-a','packet16-b']);
 assert.equal(new Set(bindings.map(b=>b.hostname)).size,2);
 for(const b of bindings){assert.match(b.hostname,/^helios-v2-staging-[a-z0-9-]+\.vercel\.app$/);assert.ok(allowed.has(b.hostname),'Hostname must belong to authenticated deployment');}
 return bindings.map(b=>({...b,purpose:'PUBLIC_SITE',status:'ACTIVE'}));
}
