import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inspectionInvocation, inspectVercelScopes, inspectDatabase } from '../scripts/staging/readonly-inspection.mjs';
import { HOSTED } from '../scripts/staging/hosted-policy.mjs';

const env = { GITHUB_REPOSITORY: 'heliosremedia/heliosremedia', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/codex/v2-neon-staging-bootstrap', GITHUB_SHA: 'a'.repeat(40), STAGING_EXECUTOR_SHA: 'a'.repeat(40), STAGING_INSPECT_ONLY: 'true', STAGING_CONFIRMATION: 'calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging' };
test('read-only inspection requires exact protected executor and explicit inspection intent', () => {
  assert.equal(inspectionInvocation(env), env.GITHUB_SHA);
  for (const patch of [{ STAGING_INSPECT_ONLY: 'false' }, { GITHUB_REF: 'refs/heads/main' }, { GITHUB_EVENT_NAME: 'push' }, { STAGING_EXECUTOR_SHA: 'b'.repeat(40) }, { STAGING_CONFIRMATION: 'other' }, { VERCEL_ENV: 'production' }]) assert.throws(() => inspectionInvocation({ ...env, ...patch }));
});
test('scope inspection uses only fixed GET requests and emits no provider configuration values', async () => {
  const calls: string[] = [];
  const rows = await inspectVercelScopes('synthetic-secret', async (url: string | URL | Request, options?: RequestInit) => {
    assert.ok(options); const address = String(url); calls.push(address); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.body, undefined);
    assert.ok(address === `https://api.vercel.com/v9/projects/${HOSTED.project}` || address === `https://api.vercel.com/v9/projects/${HOSTED.project}?teamId=${HOSTED.team}`);
    return new Response(JSON.stringify({ id: HOSTED.project, accountId: HOSTED.team, commandForIgnoringBuildStep: 'exit 0', secret: 'never-export', link: { type: 'github', org: 'heliosremedia', repo: 'heliosremedia' } }), { status: calls.length === 1 ? 200 : 404 });
  });
  assert.equal(calls.length, 2); assert.deepEqual(rows, [{ scope: 'default', httpStatus: 200, expectedProject: true, expectedTeam: true, gitConnected: true, automaticBuildsSuppressed: true }, { scope: 'expected-team', httpStatus: 404 }]);
  assert.ok(!JSON.stringify(rows).includes('never-export'));
});
test('foreign Vercel identity is never accepted as the staging project', async () => {
  const rows = await inspectVercelScopes('synthetic', async () => new Response(JSON.stringify({ id: HOSTED.project, accountId: 'foreign', link: { secret: 'private' } })));
  assert.deepEqual(rows, ['default', 'expected-team'].map(scope => ({ scope, httpStatus: 200, expectedProject: true, expectedTeam: false })));
});
function database(name = 'helios_v2_staging', readOnly = 'on') {
  const sql: string[] = [];
  return { sql, query: async (query: string) => {
    sql.push(query); assert.match(query, /^(BEGIN|SHOW|SELECT|ROLLBACK)\b/); assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|COMMIT)\b/i);
    if (query === 'SHOW transaction_read_only') return { rows: [{ transaction_read_only: readOnly }] };
    if (query === 'SELECT current_database() name') return { rows: [{ name }] };
    if (query === 'SHOW server_version_num') return { rows: [{ server_version_num: '160000' }] };
    if (query.includes('to_regclass')) return { rows: [{ present: null }] };
    return { rows: [] };
  } };
}
test('database snapshot is repeatable, read-only and rolled back, with only hashes/counts exported', async () => {
  const db = database(); const result = await inspectDatabase(db);
  assert.equal(db.sql[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); assert.equal(db.sql.at(-1), 'ROLLBACK');
  assert.match(result.schemaHash, /^[a-f0-9]{64}$/); assert.equal(result.ledgerEntries, 0); assert.equal(result.readOnlyTransaction, true); assert.equal('schema' in result, false); assert.equal('ledger' in result, false);
});
test('wrong database or writable transaction stops before schema inspection and rolls back', async () => {
  for (const db of [database('production'), database('helios_v2_staging', 'off')]) {
    await assert.rejects(() => inspectDatabase(db)); assert.equal(db.sql.at(-1), 'ROLLBACK'); assert.ok(!db.sql.some(sql => sql.includes('pg_class')));
  }
});
test('inspection mode retains the existing owner environment gate and cannot enter deployment job', () => {
  const workflow = readFileSync('.github/workflows/v2-vercel-staging-qualification.yml', 'utf8');
  assert.match(workflow, /!inputs\.inspect_only &&/); assert.match(workflow, /default: false/);
  const inspection = workflow.slice(workflow.indexOf('\n  inspect:'));
  assert.match(inspection, /if: inputs\.inspect_only &&/); assert.match(inspection, /environment: helios-v2-staging-bootstrap/); assert.match(inspection, /github\.sha == inputs\.executor_sha/);
  assert.doesNotMatch(inspection, /actions\/live\.mjs|migrate|db push|--prod|BYPASS_SECRET|STAGING_HOSTED_CONFIRMATION/);
  const script = readFileSync('scripts/staging/readonly-inspection.mjs', 'utf8');
  assert.match(script, /protection\(await jsonGet/); assert.doesNotMatch(script, /method: '(POST|PATCH|DELETE)'/);
});
