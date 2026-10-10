// Protected diagnostics only. No deployment, schema, fixture or credential mutation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { TARGET, ENVIRONMENT, REF, protection, targetConnection, jsonGet } from './policy.mjs';
import { HOSTED } from './hosted-policy.mjs';
import { diagnostic } from './actions/diagnostics.mjs';
import { schemaSnapshot, readLedger, hash } from '../migrations/bootstrap/inspect.mjs';

export function inspectionInvocation(env) {
  assert.equal(env.GITHUB_REPOSITORY, 'heliosremedia/heliosremedia');
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(env.GITHUB_REF, REF);
  assert.match(env.GITHUB_SHA || '', /^[a-f0-9]{40}$/);
  assert.equal(env.STAGING_EXECUTOR_SHA, env.GITHUB_SHA);
  assert.equal(env.STAGING_INSPECT_ONLY, 'true');
  assert.equal(env.STAGING_CONFIRMATION, `${TARGET.project}/${TARGET.branch}/${TARGET.database}`);
  assert.ok(!env.VERCEL && !env.VERCEL_ENV && !env.HELIOS_RELEASE_TARGET);
  return env.GITHUB_SHA;
}

export async function inspectVercelScopes(token, transport = fetch) {
  assert.ok(token, 'Missing staging credential');
  const results = [];
  for (const scope of ['default', 'expected-team']) {
    const response = await transport(`https://api.vercel.com/v9/projects/${HOSTED.project}${scope === 'expected-team' ? '?teamId=' + HOSTED.team : ''}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}` },
    });
    const row = { scope, httpStatus: response.status };
    if (response.status === 200) {
      const project = await response.json();
      row.expectedProject = project.id === HOSTED.project;
      row.expectedTeam = project.accountId === HOSTED.team;
      if (row.expectedProject && row.expectedTeam) {
        row.gitConnected = project.link?.type === 'github' && project.link?.org === 'heliosremedia' && project.link?.repo === 'heliosremedia';
        row.automaticBuildsSuppressed = project.commandForIgnoringBuildStep === 'exit 0';
      }
    }
    results.push(row);
  }
  return results;
}

export async function inspectDatabase(db) {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    assert.equal((await db.query('SELECT current_database() name')).rows[0].name, TARGET.database);
    assert.equal(Math.floor(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num) / 10000), 16);
    const schema = await schemaSnapshot(db), ledger = await readLedger(db);
    const has = (table, columns) => columns.every(column => schema.columns.some(row => row.relname === table && row.attname === column));
    const counts = {};
    if (has('Workspace', ['id'])) counts.workspaces = Number((await db.query('SELECT count(*) n FROM "Workspace"')).rows[0].n);
    if (has('Project', ['id'])) counts.projects = Number((await db.query('SELECT count(*) n FROM "Project"')).rows[0].n);
    if (has('AdminUser', ['active', 'role', 'passwordHash'])) counts.activeOwnersWithPasswords = Number((await db.query('SELECT count(*) n FROM "AdminUser" WHERE active=true AND role=\'OWNER\' AND "passwordHash" IS NOT NULL')).rows[0].n);
    const result = { schemaHash: hash(schema), ledgerHash: hash(ledger), ledgerEntries: ledger.length, unfinishedMigrations: ledger.filter(row => !row.finished_at).length, rolledBackMigrations: ledger.filter(row => row.rolled_back_at).length, counts, readOnlyTransaction: true };
    await db.query('ROLLBACK');
    return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

export async function runInspection(env = process.env) {
  const executor = inspectionInvocation(env);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), executor);
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { stdio: 'ignore' });
  const github = env.STAGING_GITHUB_READ_TOKEN || env.GITHUB_TOKEN;
  const base = `https://api.github.com/repos/heliosremedia/heliosremedia/environments/${ENVIRONMENT}`;
  // Do not inspect provider configuration unless the existing owner gate is intact.
  protection(await jsonGet(base, github), await jsonGet(base + '/deployment-branch-policies', github));
  const result = { version: 1, executor, target: TARGET, observedAt: new Date().toISOString(), mode: 'read-only', deployable: false, ownerAccessQualified: false };
  try { result.vercel = await inspectVercelScopes(env.STAGING_VERCEL_TOKEN); }
  catch (error) { result.vercel = { blocked: true, diagnostic: diagnostic('preflight', error) }; }
  let db;
  try {
    const n = `https://console.neon.tech/api/v2/projects/${TARGET.project}`, token = env.STAGING_NEON_API_KEY;
    const [p, b, e, d] = await Promise.all([jsonGet(n, token), jsonGet(n + '/branches/' + TARGET.branch, token), jsonGet(n + '/endpoints', token), jsonGet(n + '/branches/' + TARGET.branch + '/databases', token)]);
    db = new pg.Client(targetConnection({ project: p.project, branch: b.branch, endpoints: e.endpoints, databases: d.databases }, env.STAGING_DIRECT_URL));
    await db.connect(); result.database = await inspectDatabase(db);
  } catch (error) { result.database = { blocked: true, diagnostic: diagnostic('preflight', error) }; }
  finally { if (db) await db.end().catch(() => {}); }
  await mkdir('staging-evidence', { recursive: true });
  await writeFile('staging-evidence/readonly-inspection.json', JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { assert.equal(process.argv.length, 2); await runInspection(); console.log('STAGING_READ_ONLY_INSPECTION_RECORDED'); }
  catch (error) { console.error(JSON.stringify(diagnostic('preflight', error))); process.exitCode = 1; }
}
