import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { TARGET, REF } from '../scripts/staging/policy.mjs';
const base = { PATH: process.env.PATH, GITHUB_REPOSITORY: 'heliosremedia/heliosremedia', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: REF, GITHUB_SHA: 'a'.repeat(40), STAGING_CANDIDATE_SHA: 'a'.repeat(40), STAGING_TRACK: 'current-baseline', STAGING_CONFIRMATION: Object.values(TARGET).slice(0,3).join('/'), STAGING_TENANT_CONFIRMATION: 'seed-synthetic-tenants-only' };
for (const [name, override] of Object.entries({ noAuthority: { GITHUB_EVENT_NAME: '' }, wrongRef: { GITHUB_REF: 'refs/heads/main' }, bootstrapTrack: { STAGING_TRACK: 'clean-bootstrap' }, absentSeedConsent: { STAGING_TENANT_CONFIRMATION: '' }, wrongTarget: { STAGING_CONFIRMATION: 'production' }, hostedBuild: { VERCEL: '1' } })) {
  test('actual tenant executor rejects ' + name + ' before metadata/database access', () => {
    const result = spawnSync(process.execPath, ['scripts/staging/qualify-tenants.mjs'], { env: { ...base, ...override }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1); assert.equal(result.stdout, '');
    assert.match(result.stderr, /^STAGING_TENANT_QUALIFICATION_BLOCKED:/);
  });
}
test('isolated tenant mode cannot be selected without explicit isolated rehearsal context', () => {
  const result = spawnSync(process.execPath, ['scripts/staging/qualify-tenants.mjs', '--isolated'], { env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /^STAGING_TENANT_QUALIFICATION_BLOCKED:/);
});
