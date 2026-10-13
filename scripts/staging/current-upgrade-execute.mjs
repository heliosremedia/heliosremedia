// Shared by isolated qualification and the protected exact-target upgrade.
// No provider discovery, credential access, migration repair or retry lives here.
import assert from 'node:assert/strict';
import {schemaSnapshot,readLedger,hash} from '../migrations/bootstrap/inspect.mjs';
import {snapshot} from '../rehearsal/restoration/core.mjs';
import {verifyUpgradeSnapshot,verifyUpgradeTransition} from './current-upgrade-policy.mjs';

async function observe(db){
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try {
  const schema=await schemaSnapshot(db),ledger=await readLedger(db),data=await snapshot(db);
  await db.query('COMMIT');return {schema,ledger,data,schemaHash:hash(schema)};
 } catch(error){await db.query('ROLLBACK');throw error;}
}
function retained(before,after){
 for(const [table,rows] of Object.entries(before)){
  if(table==='_prisma_migrations')continue;
  const normalized=structuredClone(after[table]);
  if(table==='Workspace')for(const row of normalized){
   assert.equal(row.lifecycleState,'ACTIVE');assert.equal(row.lifecycleRevision,0);assert.equal(row.lastReactivatedAt,null);
   delete row.lifecycleState;delete row.lifecycleRevision;delete row.lastReactivatedAt;
  }
  assert.deepEqual(normalized,rows,'Stored rows changed during staging upgrade');
 }
 for(const table of Object.keys(after).filter(t=>!Object.hasOwn(before,t)))
  assert.deepEqual(after[table],[],'Unexpected implicit enrollment');
}
export async function executeCurrentUpgrade(db,deploy){
 assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true,'Another release owns this target');
 try{
  const before=await observe(db);
  verifyUpgradeSnapshot(before,'baseline');
  await deploy(); // A failure exits immediately. Never repair or retry an uncertain migration.
  const after=await observe(db);
  const admission=verifyUpgradeTransition(before,after);
  retained(before.data,after.data);
  await deploy(); // Only after a fully verified first result: prove Prisma reports a no-op.
  const repeated=await observe(db);
  assert.deepEqual(repeated,after,'Repeated deployment changed catalog, ledger or stored records');
  return {
   before:{schemaHash:before.schemaHash,ledgerHash:hash(before.ledger),entries:before.ledger.length},
   after:{schemaHash:after.schemaHash,ledgerHash:hash(after.ledger),entries:after.ledger.length},
   admission,existingDataPreserved:true,noImplicitEnrollment:true,repeatedDeployNoOp:true,
   hosted:false,deployable:false,ownerAccessQualified:false
  };
 }finally{await db.query('SELECT pg_advisory_unlock(1200318)');}
}
