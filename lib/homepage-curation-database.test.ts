import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture} from '../scripts/rehearsal/homepage-database-fixture.ts';
/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated SQL rows. */
test('curation actual route/database serializes stale writers and returns the committed revision', async () => {
 const f = await fixture(); try {
  const before = await f.revision(); const responses = await Promise.all(['First','Second'].map(titleOverride => f.call(f.projects,'PATCH',{ placementId:'p1',titleOverride }, before)));
  assert.deepEqual(responses.map(r => r.status), [200,409]); const data = await responses[0].json(); assert.equal(data.acknowledgement.revision,await f.revision()); assert.notEqual(data.acknowledgement.revision,before); assert.deepEqual(data.acknowledgement.ids,['p1']);
  const foreign = await f.call(f.projects,'PATCH',{ placementId:'foreign',titleOverride:'Leak' },await f.revision()); assert.equal(foreign.status,404); assert.equal((await f.db.query<any>('SELECT "titleOverride" FROM "HomepageProject" WHERE id=$1',['foreign'])).rows[0].titleOverride,'Private');
  await f.db.exec('UPDATE "AdminUser" SET active=false'); assert.equal((await f.call(f.projects,'PATCH',{ placementId:'p1',active:false },await f.revision())).status,403);
 } finally { await f.db.close(); }
});
test('curation actual route/database rejects stale reorder and rolls back partial positional writes', async () => {
 const f = await fixture(); try {
  const before = await f.revision('work-cards'); const response = await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c2','c1'] },before); assert.equal(response.status,200); assert.deepEqual((await response.json()).acknowledgement.ids,['c2','c1']);
  assert.equal((await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c1','c2'] },before)).status,409);
  const current = await f.revision('work-cards'); f.controls.failId='c2'; assert.equal((await f.call(f.cards,'PATCH',{ action:'reorder',cardIds:['c1','c2'] },current)).status,500); assert.equal(await f.revision('work-cards'),current);
 } finally { await f.db.close(); }
});
test('curation actual route/database serializes revision-aware count admission and exposes postcommit uncertainty', async () => {
 const f = await fixture(); try {
  await f.db.exec('DELETE FROM "HomepageProject" WHERE id=\'p1\'');
  const responses = await Promise.all(['pa','pa2'].map(async projectId => f.call(f.projects,'POST',{projectId},await f.revision()))); assert.deepEqual(responses.map(r => r.status),[201,409]);
  const id = (await responses[0].json()).placement.id; const before=await f.revision(); f.controls.cacheFailure=true;
  assert.equal((await f.call(f.projects,'PATCH',{placementId:id,titleOverride:'Committed'},before)).status,500); assert.notEqual(await f.revision(),before);
 } finally { await f.db.close(); }
});

test('homepage ownership transfer before admission rejects stale update, reorder and delete, including legacy requests',async()=>{
 const f=await fixture();try{
  const projectRevision=await f.revision(),cardRevision=await f.revision('work-cards');
  await f.db.exec(`UPDATE "Project" SET "workspaceId"='b' WHERE id='pa'; UPDATE "Service" SET "workspaceId"='b' WHERE id='sa';`);
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Stale'},projectRevision)).status,409);
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Legacy'},await f.revision())).status,404);
  assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c2','c1']},cardRevision)).status,409);
  assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c2','c1']})).status,409);
  const removed=await f.projects.DELETE(new Request('http://localhost/api?placementId=p1',{method:'DELETE',headers:{'x-curation-revision':projectRevision,'x-curation-request':'old'}}));assert.equal(removed.status,409);
  assert.equal((await f.db.query<any>('SELECT "titleOverride" FROM "HomepageProject" WHERE id=\'p1\'')).rows[0].titleOverride,'Keep');
 }finally{await f.db.close();}
});
test('parent transfer at admission is re-read before mutation; parent and child lock SQL executes on unchanged writes',async()=>{
 const f=await fixture();try{
  const before=await f.revision();f.controls.transferAtAdmission=true;
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Unsafe'},before)).status,409);
  // The injected change is inside this isolated transaction and rolls back with its rejection.
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Safe'},before)).status,200);
  assert.ok(f.controls.locks.some(query=>query.includes('FOR UPDATE OF p')));
  assert.ok(f.controls.locks.some(query=>query.includes('FOR UPDATE OF h, p')));
  assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c2','c1']},await f.revision('work-cards'))).status,200);
  assert.ok(f.controls.locks.some(query=>query.includes('FOR UPDATE OF h, s')));
 }finally{await f.db.close();}
});
test('synthetic null parent workspace cannot bypass legacy homepage predicates',async()=>{
 const f=await fixture();try{await f.db.exec('UPDATE "Project" SET "workspaceId"=NULL WHERE id=\'pa\'');assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',active:false},await f.revision())).status,404);}finally{await f.db.close();}
});

test('mixed-version old project writer cannot overwrite a confirmed new writer',async()=>{
 const f=await fixture();try{const before=await f.revision();assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'New confirmed'},before)).status,200);assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Old tab'})).status,409);assert.equal((await f.db.query<any>('SELECT "titleOverride" FROM "HomepageProject" WHERE id=\'p1\'')).rows[0].titleOverride,'New confirmed');}finally{await f.db.close();}
});
test('mixed-version old ordering writer cannot overwrite a confirmed new order',async()=>{
 const f=await fixture();try{assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c2','c1']},await f.revision('work-cards'))).status,200);assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c1','c2']})).status,409);}finally{await f.db.close();}
});
