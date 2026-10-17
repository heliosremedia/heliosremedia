import assert from 'node:assert/strict';
const repo='heliosremedia/heliosremedia',ref='refs/heads/codex/v2-neon-staging-bootstrap';
export function upgradeInvocation(e,checkout){
 assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);
 assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(e.GITHUB_REF,ref);
 assert.equal(e.GITHUB_WORKFLOW_REF,repo+'/.github/workflows/v2-neon-staging-bootstrap.yml@'+ref);
 assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(e.STAGING_EXECUTOR_SHA,e.GITHUB_SHA);
 assert.match(e.STAGING_CANDIDATE_SHA||'',/^[a-f0-9]{40}$/);assert.equal(checkout,e.STAGING_CANDIDATE_SHA);
 assert.equal(e.STAGING_CONFIRMATION,'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging');
 assert.equal(e.STAGING_UPGRADE_CONFIRMATION,'upgrade-six-reviewed-migrations-only');
 assert.ok(!e.VERCEL&&!e.VERCEL_ENV&&!e.HELIOS_RELEASE_TARGET);
 for(const id of [e.STAGING_REGRESSION_RUN,e.STAGING_UPGRADE_RUN])assert.match(id||'',/^[1-9][0-9]+$/);
 return checkout;
}
export function qualifiedUpgradeRun(run,candidate,path){
 assert.equal(run.head_sha,candidate);assert.equal(run.event,'push');assert.equal(run.path,path);
 assert.equal(run.repository?.full_name,repo);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
}
