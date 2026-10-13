// Explicit initialization of the two existing synthetic owners. No enrollment,
// rotation, session minting, migration, provider configuration or retry.
import assert from 'node:assert/strict';
import {schemaSnapshot,readLedger,hash} from '../migrations/bootstrap/inspect.mjs';
import {snapshot} from '../rehearsal/restoration/core.mjs';
import {verifyUpgradeSnapshot} from './current-upgrade-policy.mjs';
export const OWNER_WORKSPACES=Object.freeze(['packet16-a','packet16-b']);
const fixtureTables=new Set(['Workspace','AdminUser','WorkspaceMembership','SiteSettings','Project','HomepageProject','WorkspaceDomain']);
export function ownerPasswords(values){
 assert.ok(Array.isArray(values)&&values.length===2,'Two dedicated staging passwords required');
 for(const value of values)assert.ok(typeof value==='string'&&value.length>=24&&value.length<=256&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value),'Use a dedicated 24–256 character staging password');
 assert.notEqual(values[0],values[1],'Synthetic owners need distinct passwords');
 return values;
}
export async function observeOwnerState(db){
 const schema=await schemaSnapshot(db),ledger=await readLedger(db),data=await snapshot(db);
 return {schemaHash:hash(schema),ledger,data};
}
export function ownerAdmission(state){
 verifyUpgradeSnapshot(state,'current');
 for(const [table,rows] of Object.entries(state.data))if(table!=='_prisma_migrations')assert.equal(rows.length,fixtureTables.has(table)?2:0,'Unexpected staging footprint');
 for(const table of fixtureTables)assert.equal(state.data[table]?.length,2,'Missing synthetic fixture table');
 for(const id of OWNER_WORKSPACES){
  const find=(table,predicate)=>{const rows=state.data[table].filter(predicate);assert.equal(rows.length,1,'Synthetic ownership mismatch');return rows[0];};
  const w=find('Workspace',r=>r.id===id);assert.equal(w.slug,id);assert.equal(w.lifecycleState,'ACTIVE');assert.equal(w.lifecycleRevision,0);
  const u=find('AdminUser',r=>r.id===id+'-owner');
  assert.equal(u.workspaceId,id);assert.equal(u.email,id+'@example.test');assert.equal(u.role,'OWNER');assert.equal(u.active,true);
  assert.equal(u.passwordHash,null,'Existing credentials require deliberate review; never rotate or replay');
  assert.equal(u.sessionVersion,1);assert.equal(u.failedLoginCount,0);assert.equal(u.lockedUntil,null);assert.equal(u.lastLoginAt,null);
  find('WorkspaceMembership',r=>r.workspaceId===id&&r.userId===u.id&&r.role==='OWNER'&&r.status==='ACTIVE');
  find('SiteSettings',r=>r.id===id+'-settings'&&r.workspaceId===id);
  find('Project',r=>r.id===id+'-project'&&r.workspaceId===id);
  find('HomepageProject',r=>r.id===id+'-placement'&&r.projectId===id+'-project');
  find('WorkspaceDomain',r=>r.workspaceId===id&&r.hostname===id+'.example.test'&&r.purpose==='PUBLIC_SITE'&&r.status==='ACTIVE');
 }
}
export function ownerTransition(before,after,hashes){
 verifyUpgradeSnapshot(after,'current');assert.equal(after.schemaHash,before.schemaHash);assert.deepEqual(after.ledger,before.ledger);
 const expected=structuredClone(before.data);
 for(let i=0;i<OWNER_WORKSPACES.length;i++){
  const row=expected.AdminUser.find(r=>r.id===OWNER_WORKSPACES[i]+'-owner');
  row.passwordHash=hashes[i];row.sessionVersion=2;
 }
 // Exact full-row preservation outside the two fields explicitly initialized.
 assert.deepEqual(after.data,expected,'Unrelated stored data changed during owner initialization');
}
export async function initializeOwners(db,passwords,auth,{observe=observeOwnerState}={}){
 ownerPasswords(passwords);
 assert.equal((await db.query('SELECT pg_try_advisory_lock(1200318) locked')).rows[0].locked,true,'Another staging operation owns the target');
 let transaction=false;
 try{
  // Lock existing tables before the consistent snapshot. No schema or row repair.
  await db.query('BEGIN');transaction=true;
  await db.query("SET LOCAL lock_timeout = '5s'");
  const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  assert.ok(tables.length>0);
  const quoted=tables.map(({tablename})=>'"'+tablename.replaceAll('"','""')+'"');
  await db.query('LOCK TABLE '+quoted.join(',')+' IN SHARE ROW EXCLUSIVE MODE');
  const before=await observe(db);ownerAdmission(before);
  const hashes=[];
  for(const password of passwords){const encoded=await auth.hashPassword(password);assert.match(encoded,/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);assert.equal(await auth.verifyPassword(password,encoded),true);hashes.push(encoded);}
  for(let i=0;i<OWNER_WORKSPACES.length;i++){
   const id=OWNER_WORKSPACES[i];
   const changed=await db.query('UPDATE "AdminUser" SET "passwordHash"=$1,"sessionVersion"=2 WHERE id=$2 AND "workspaceId"=$3 AND "passwordHash" IS NULL AND "sessionVersion"=1 RETURNING id',[hashes[i],id+'-owner',id]);
   assert.equal(changed.rowCount,1,'Credential state changed; stop without retry');
  }
  const after=await observe(db);ownerTransition(before,after,hashes);
  for(let i=0;i<OWNER_WORKSPACES.length;i++){
   const row=after.data.AdminUser.find(r=>r.id===OWNER_WORKSPACES[i]+'-owner');
   assert.equal(await auth.verifyPassword(passwords[i],row.passwordHash),true);
   assert.equal(await auth.verifyPassword(passwords[1-i],row.passwordHash),false);
  }
  await db.query('COMMIT');transaction=false;
  return {version:1,mode:'initialize-existing-synthetic-owner-credentials',owners:OWNER_WORKSPACES.map(id=>({workspace:id,user:id+'-owner',email:id+'@example.test',sessionVersion:2})),schemaHash:after.schemaHash,ledgerHash:hash(after.ledger),ledgerEntries:after.ledger.length,schemaLedgerUnchanged:true,unrelatedRowsUnchanged:true,noEnrollment:true,previousSessionsInvalidated:true,persistentCredentials:true,hosted:false,ownerAccessQualified:false};
 }catch(error){if(transaction)await db.query('ROLLBACK');throw error;}
 finally{await db.query('SELECT pg_advisory_unlock(1200318)');}
}
