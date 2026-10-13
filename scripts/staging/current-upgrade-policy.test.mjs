import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UPGRADE_SCHEMA, verifyUpgradeSnapshot, verifyUpgradeTransition } from './current-upgrade-policy.mjs';
const history = JSON.parse(readFileSync(new URL('../migrations/bootstrap/history-sha256.json', import.meta.url)));
const extensions = JSON.parse(readFileSync(new URL('../rehearsal/staging-upgrade/migrations.json', import.meta.url)));
const baseline = { '20260909000000_verified_pre_v2_baseline': '6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb', ...Object.fromEntries(Object.entries(history).filter(([name]) => name.startsWith('2026091'))) };
function snapshot(phase) {
  return { schemaHash: UPGRADE_SCHEMA[phase], ledger: Object.entries(phase === 'baseline' ? baseline : {...baseline,...extensions}).map(([migration_name,checksum],i)=>({id:'migration-'+i,migration_name,checksum,started_at:'2026-10-10T10:00:00Z',finished_at:'2026-10-10T10:01:00Z',rolled_back_at:null,applied_steps_count:1})) };
}
test('accepts only the exact independently pinned baseline/current snapshots',()=>{
  assert.equal(verifyUpgradeSnapshot(snapshot('baseline'),'baseline').entries,19);
  assert.equal(verifyUpgradeSnapshot(snapshot('current'),'current').entries,25);
  assert.equal(verifyUpgradeTransition(snapshot('baseline'),snapshot('current')).addedMigrations,6);
});
for(const phase of ['baseline','current']) {
  for(const [name,change] of [
    ['schema drift',s=>s.schemaHash='0'.repeat(64)],
    ['missing migration',s=>s.ledger.pop()],
    ['unknown migration',s=>s.ledger[0].migration_name='unknown'],
    ['duplicate migration',s=>s.ledger[1].migration_name=s.ledger[0].migration_name],
    ['changed checksum',s=>s.ledger[0].checksum='0'.repeat(64)],
    ['unfinished migration',s=>s.ledger[0].finished_at=null],
    ['rolled-back migration',s=>s.ledger[0].rolled_back_at='2026-10-10T10:02:00Z'],
    ['invalid start',s=>s.ledger[0].started_at='invalid'],
    ['reversed timestamps',s=>s.ledger[0].finished_at='2026-10-09T10:00:00Z'],
    ['invalid steps',s=>s.ledger[0].applied_steps_count=-1],
    ['duplicate row id',s=>s.ledger[1].id=s.ledger[0].id],
    ['empty row id',s=>s.ledger[0].id=''],
  ]) test(phase+' rejects '+name,()=>{const s=snapshot(phase);change(s);assert.throws(()=>verifyUpgradeSnapshot(s,phase));});
}
test('does not infer or silently change the requested phase',()=>{
  assert.throws(()=>verifyUpgradeSnapshot(snapshot('baseline'),'current'));
  assert.throws(()=>verifyUpgradeSnapshot(snapshot('current'),'baseline'));
  assert.throws(()=>verifyUpgradeSnapshot(snapshot('current'),'anything'));
});
test('rejects a valid-looking replacement of existing migration bookkeeping',()=>{
  const before=snapshot('baseline'),after=snapshot('current');
  after.ledger[0].id='replacement-id';
  assert.equal(verifyUpgradeSnapshot(after,'current').entries,25);
  assert.throws(()=>verifyUpgradeTransition(before,after),/Existing ledger rows changed/);
});
test('rejects altered original completion time after migration',()=>{
  const before=snapshot('baseline'),after=snapshot('current');
  after.ledger[0].finished_at='2026-10-10T10:02:00Z';
  assert.throws(()=>verifyUpgradeTransition(before,after),/Existing ledger rows changed/);
});

test('rejects a new migration marked resolved without execution',()=>{
  const after=snapshot('current');
  after.ledger.find(row=>Object.hasOwn(extensions,row.migration_name)).applied_steps_count=0;
  assert.throws(()=>verifyUpgradeTransition(snapshot('baseline'),after),/must have executed steps/);
});
test('preserves historical resolved baseline rows without weakening new migration execution',()=>{
  const before=snapshot('baseline'),after=snapshot('current');
  before.ledger[0].applied_steps_count=0;after.ledger[0].applied_steps_count=0;
  assert.equal(verifyUpgradeTransition(before,after).addedMigrations,6);
});
