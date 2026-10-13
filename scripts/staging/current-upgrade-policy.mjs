// Read-only admission contract for the six already-rehearsed Studio migrations.
// This module never connects to a provider or executes a migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const historyBytes = readFileSync(new URL('../migrations/bootstrap/history-sha256.json', import.meta.url));
assert.equal(hash(historyBytes), '8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a');
const history = JSON.parse(historyBytes);
const extensions = JSON.parse(readFileSync(new URL('../rehearsal/staging-upgrade/migrations.json', import.meta.url)));
const reviewedExtensions = {
  '20261004173000_social_generation_workspace_request': '55b4943f8f3ecdef77e9478b0738773f0205f546cacdf98295ef562aac18a6a4',
  '20261004180000_workspace_marketing_consent_expand': '6c0839d09b092d32007bcce8e47ec8927a2797056d755f27e0c09d4c127d7958',
  '20261006040000_workspace_consent_event_attribution': '167debcceaafab2641d35cb1dae2e0eb5c3c3e3b17d4ed119299ca2677c40313',
  '20261007140000_support_access_foundation': 'c42d62011174e46f1191d7dbac4451cba9e8e8cacd654c0fb0f39e77461df985',
  '20261008123000_workspace_lifecycle_foundation': 'c5b1c9ddd060c29d08f2f18ea542eba2059b64171ab6d8841c87ea015a04fab7',
  '20261008211000_workspace_reactivation_cutoff': 'd35e7672d40bd3c8c64e5898614e659368c20ebe11232f937e1179af01a6b25a',
};
assert.deepEqual(extensions, reviewedExtensions, 'Only the six reviewed migrations are admitted');
const baseline = {
  '20260909000000_verified_pre_v2_baseline': '6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb',
  ...Object.fromEntries(Object.entries(history).filter(([name]) => name.startsWith('2026091'))),
};
assert.equal(Object.keys(baseline).length, 19);
export const REVIEWED_CURRENT_MIGRATIONS = Object.freeze({...reviewedExtensions});
const current = { ...baseline, ...reviewedExtensions };
export const UPGRADE_SCHEMA = Object.freeze({
  baseline: '500be0f2b2b62093876525ee61994200aa822fefd7f47e41dfffdba6ec0f7dad',
  current: '9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f',
});

export function verifyUpgradeSnapshot(snapshot, phase) {
  assert.ok(phase === 'baseline' || phase === 'current', 'Explicit upgrade phase required');
  assert.equal(snapshot.schemaHash, UPGRADE_SCHEMA[phase], 'Catalog differs from independently rehearsed schema');
  const expected = phase === 'baseline' ? baseline : current;
  const rows = snapshot.ledger;
  assert.ok(Array.isArray(rows));
  assert.deepEqual(rows.map(row => row.migration_name).sort(), Object.keys(expected).sort(), 'Exact complete migration set required');
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Duplicate ledger identity');
  for (const row of rows) {
    assert.ok(typeof row.id === 'string' && row.id.length > 0, 'Ledger identity missing');
    assert.equal(row.checksum, expected[row.migration_name], 'Migration checksum mismatch');
    assert.ok(row.started_at && row.finished_at && !row.rolled_back_at, 'Incomplete or rolled-back migration');
    const started = new Date(row.started_at).getTime(), finished = new Date(row.finished_at).getTime();
    assert.ok(Number.isFinite(started) && Number.isFinite(finished) && finished >= started, 'Invalid migration timestamps');
    assert.ok(Number.isInteger(row.applied_steps_count) && row.applied_steps_count >= 0, 'Invalid migration steps');
  }
  return { phase, entries: rows.length, schemaHash: snapshot.schemaHash, automaticRepair: false };
}

export function verifyUpgradeTransition(before, after) {
  verifyUpgradeSnapshot(before, 'baseline');
  verifyUpgradeSnapshot(after, 'current');
  assert.deepEqual(after.ledger.filter(row => Object.hasOwn(baseline, row.migration_name)), before.ledger, 'Existing ledger rows changed');
  for (const row of after.ledger.filter(row => !Object.hasOwn(baseline, row.migration_name)))
    assert.ok(row.applied_steps_count > 0, 'New migrations must have executed steps, not resolved bookkeeping');
  return { existingLedgerRowsPreserved: true, addedMigrations: 6, automaticRepair: false };
}
