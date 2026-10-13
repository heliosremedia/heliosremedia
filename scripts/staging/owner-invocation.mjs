import assert from 'node:assert/strict';
import {REF,TARGET} from './policy.mjs';
export function ownerInvocation(e,checkout){
 assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,'heliosremedia/heliosremedia');
 assert.equal(e.GITHUB_EVENT_NAME,'workflow_dispatch');assert.equal(e.GITHUB_REF,REF);
 assert.equal(e.GITHUB_WORKFLOW_REF,'heliosremedia/heliosremedia/.github/workflows/v2-neon-staging-bootstrap.yml@'+REF);
 assert.match(e.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(e.STAGING_EXECUTOR_SHA,e.GITHUB_SHA);
 assert.match(e.STAGING_CANDIDATE_SHA||'',/^[a-f0-9]{40}$/);assert.equal(checkout,e.STAGING_CANDIDATE_SHA);
 assert.equal(e.STAGING_TRACK,'persistent-owner-credentials');
 assert.equal(e.STAGING_CONFIRMATION,TARGET.project+'/'+TARGET.branch+'/'+TARGET.database);
 assert.equal(e.STAGING_OWNER_CONFIRMATION,'initialize-two-synthetic-owner-passwords-only');
 for(const key of ['VERCEL','VERCEL_ENV','HELIOS_RELEASE_TARGET'])assert.ok(!e[key]);
 for(const id of [e.STAGING_REGRESSION_RUN,e.STAGING_OWNER_REHEARSAL_RUN])assert.match(id||'',/^[1-9][0-9]+$/);
 return checkout;
}
