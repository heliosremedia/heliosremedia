import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fixture} from '../scripts/rehearsal/homepage-database-fixture.ts';
import {checkHomepageRollback} from '../scripts/rehearsal/check-homepage-rollback.mjs';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual historical/current routes over isolated SQL adapter. */
const history='scripts/rehearsal/homepage-history/';
test('mixed-version historical source fixtures match recorded immutable checksums',()=>{
 for(const entry of JSON.parse(readFileSync(history+'manifest.json','utf8')))assert.equal(createHash('sha256').update(readFileSync(history+entry.file)).digest('hex'),entry.sha256);
});
test('mixed-version negative control: raw #314 writer overwrites new state; new revision subsequently detects it',async()=>{
 const f=await fixture();try{
  const old=f.version({'lib/homepage-curation-write.ts':history+'curation-write-314.txt'})('app/api/admin/homepage-projects/route.ts');
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Confirmed new'},await f.revision())).status,200);
  const confirmed=await f.revision();assert.equal((await f.call(old,'PATCH',{placementId:'p1',titleOverride:'Unsafe historical tab'})).status,200);
  assert.notEqual(await f.revision(),confirmed);
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Stale new tab'},confirmed)).status,409);
 }finally{await f.db.close();}
});
test('mixed-version headerless project/card create, edit, reorder and remove all require reload without writes',async()=>{
 const f=await fixture();try{
  for(const [route,scope,id,key,parent] of [[f.projects,'projects','p1','placementId',{projectId:'pa2'}],[f.cards,'work-cards','c1','cardId',{serviceId:'sa'}]] as const){
   const before=await f.revision(scope);
   for(const [method,body] of [['POST',parent],['PATCH',{[key]:id,active:false}],['PATCH',{action:'reorder',placementIds:['p1'],cardIds:['c2','c1']}]] as const){
    const response=await f.call(route,method,body);assert.equal(response.status,409);assert.equal((await response.json()).code,'HOMEPAGE_RELOAD_REQUIRED');
   }
   assert.equal((await route.DELETE(new Request('http://localhost/api?'+key+'='+id,{method:'DELETE'}))).status,409);
   assert.equal(await f.revision(scope),before);
  }
 }finally{await f.db.close();}
});
test('rollback rehearsal preserves order, canonical attachments and private additive layout with retained mutation bundle',async()=>{
 const f=await fixture();try{
  // A: historical readable rows. B/C: current writes and preparation.
  const before=await f.revision('work-cards');
  assert.equal((await f.call(f.cards,'PATCH',{action:'reorder',cardIds:['c2','c1']},before)).status,200);
  const presign=f.load('app/api/admin/homepage-work-cards/presign/route.ts');
  const prep=await f.call(presign,'POST',{cardId:'c1',kind:'image',fileType:'image/webp',fileSize:10},await f.revision('work-cards'));assert.equal(prep.status,200);
  const prepared=await prep.json();assert.equal(prepared.media.workspaceId,'a');
  const body={cardId:'c1',serviceId:'sa',active:true,mediaMode:'IMAGE',imageStorageKey:prepared.media.key,imageUrl:prepared.media.url};
  const attached=await f.call(f.cards,'PATCH',body,await f.revision('work-cards'));assert.equal(attached.status,200);const attachment=await attached.json();assert.equal(attachment.media.image.assetId,prepared.media.assetId);
  const layout=f.load('app/api/admin/homepage-layout/route.ts');
  const reader=f.load('lib/homepage-curation-layout.ts');const hash=f.load('lib/homepage-layout-revision.ts').homepageLayoutRevision;
  const preference={order:[...reader.HOMEPAGE_CURATION_SECTION_IDS].reverse(),collapsed:[]};
  const layoutRequest=(revision:string)=>new Request('http://localhost/api',{method:'PATCH',headers:{'x-layout-revision':revision,'x-layout-request':'rehearsal','x-layout-workspace':'a'},body:JSON.stringify(preference)});
  const saved=await layout.PATCH(layoutRequest(hash('u','a',null)));assert.equal(saved.status,200);const savedLayout=await saved.json();
  const stored=(await f.db.query<any>('SELECT "homepageCurationPreferences" FROM "AdminUser"')).rows[0].homepageCurationPreferences;
  assert.ok(stored.layoutGeneration);
  // D/E: historical reader plus reviewed mutation bundle, no downgrade or data restoration.
  const oldReader=f.version({'lib/homepage-curation-layout.ts':history+'layout-reader-313.txt'})('lib/homepage-curation-layout.ts');
  assert.equal(JSON.stringify(oldReader.normalizeHomepageCurationPreferences(stored)),JSON.stringify(preference));
  const rows=(await f.db.query<any>('SELECT id,"imageStorageKey","imageUrl" FROM "HomepageWorkCard" WHERE id IN (\'c1\',\'c2\') ORDER BY "displayOrder"')).rows;
  assert.deepEqual(rows.map(r=>r.id),['c2','c1']);assert.equal(rows[1].imageStorageKey,prepared.media.key);assert.equal(rows[1].imageUrl,prepared.media.url);
  const oldMedia=f.version({'lib/work-card-media-server.ts':history+'media-reader-312.txt'})('lib/work-card-media-server.ts');
  const oldReceipt=await oldMedia.resolveWorkCardMedia(f.prisma,'a','c1','image',{key:prepared.media.key,url:prepared.media.url},{key:prepared.media.key,url:prepared.media.url});assert.equal(oldReceipt.assetId,prepared.media.assetId);
  // F: old writers are rejected on the compatible rollback artifact; stale revision rejected too.
  const rollback=f.version();const rollbackCards=rollback('app/api/admin/homepage-work-cards/route.ts');
  assert.equal((await f.call(rollbackCards,'PATCH',body)).status,409);
  assert.equal((await f.call(rollbackCards,'PATCH',body,before)).status,409);
  assert.equal((await rollback('app/api/admin/homepage-layout/route.ts').PATCH(new Request('http://localhost/api',{method:'PATCH',body:JSON.stringify(preference)}))).status,409);
  assert.equal(JSON.stringify((await f.db.query<any>('SELECT "homepageCurationPreferences" FROM "AdminUser"')).rows[0].homepageCurationPreferences),JSON.stringify(stored));
  // G/H: reapply current writer, verify revision progression and retained object.
  const current=await f.revision('work-cards');assert.equal((await f.call(f.cards,'PATCH',{...body,titleOverride:'Restored'},current)).status,200);assert.notEqual(await f.revision('work-cards'),current);
  assert.equal((await layout.PATCH(layoutRequest(savedLayout.acknowledgement.revision))).status,200);
  assert.equal((await layout.PATCH(layoutRequest(savedLayout.acknowledgement.revision))).status,409);
  assert.equal(f.controls.signed,1);assert.equal(f.controls.deleted,0);
  assert.equal((await f.db.query<any>('SELECT count(*)::int AS count FROM "WorkspaceAsset"')).rows[0].count,1);
 }finally{await f.db.close();}
});
test('rollback negative control: raw #313 layout writer erases additive generation and is not a compatible rollback',async()=>{
 const f=await fixture();try{
  const stored={order:['homepage-navigation','homepage-media','featured-project','our-work','homepage-structure'],collapsed:[],layoutGeneration:'new-generation'};
  await f.db.query('UPDATE "AdminUser" SET "homepageCurationPreferences"=$1::jsonb',[JSON.stringify(stored)]);
  const old=f.version({'app/api/admin/homepage-layout/route.ts':history+'layout-route-313.txt'})('app/api/admin/homepage-layout/route.ts');
  const response=await old.PATCH(new Request('http://localhost/api',{method:'PATCH',body:JSON.stringify(stored)}));assert.equal(response.status,200);
  const after=(await f.db.query<any>('SELECT "homepageCurationPreferences" FROM "AdminUser"')).rows[0].homepageCurationPreferences;assert.equal(after.layoutGeneration,undefined);
 }finally{await f.db.close();}
});
test('rollback candidate preflight accepts retained bundle and rejects historical or missing mutation code',()=>{
 const root=mkdtempSync(join(tmpdir(),'homepage-rollback-'));try{
  const manifest=JSON.parse(readFileSync('scripts/rehearsal/homepage-writer-bundle.json','utf8'));
  for(const file of manifest.files){mkdirSync(dirname(join(root,file.path)),{recursive:true});copyFileSync(file.path,join(root,file.path));}
  assert.equal(checkHomepageRollback(root).safe,true);
  copyFileSync(history+'curation-write-314.txt',join(root,'lib/homepage-curation-write.ts'));assert.equal(checkHomepageRollback(root).safe,false);
  copyFileSync('lib/homepage-curation-write.ts',join(root,'lib/homepage-curation-write.ts'));
  copyFileSync(history+'layout-route-313.txt',join(root,'app/api/admin/homepage-layout/route.ts'));assert.equal(checkHomepageRollback(root).safe,false);
  copyFileSync('app/api/admin/homepage-layout/route.ts',join(root,'app/api/admin/homepage-layout/route.ts'));assert.equal(checkHomepageRollback(root).safe,true);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('mixed-version partial headers cannot downgrade preconditions and current old-format edits still work',async()=>{
 const f=await fixture();try{
  const revision=await f.revision();
  for(const headers of [{'x-curation-revision':revision},{'x-curation-request':'old'}] as Record<string,string>[])assert.equal((await f.projects.PATCH(new Request('http://localhost/api',{method:'PATCH',headers,body:JSON.stringify({placementId:'p1',titleOverride:'Missing field'})}))).status,409);
  const response=await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Compatible #311 DTO'},revision);assert.equal(response.status,200);const data=await response.json();assert.equal(data.placement.titleOverride,'Compatible #311 DTO');assert.equal(data.acknowledgement.previousRevision,revision);
  assert.equal((await f.call(f.projects,'PATCH',{placementId:'p1',titleOverride:'Pre-deploy tab'},revision)).status,409);
 }finally{await f.db.close();}
});
test('mixed-version preparation never grants headerless or foreign attachment capability',async()=>{
 const f=await fixture();try{
  const presign=f.load('app/api/admin/homepage-work-cards/presign/route.ts');const request={cardId:'c1',kind:'image',fileType:'image/webp',fileSize:10};
  assert.equal((await f.call(presign,'POST',request)).status,409);assert.equal(f.controls.signed,0);
  const response=await f.call(presign,'POST',request,await f.revision('work-cards'));assert.equal(response.status,200);const {media}=await response.json();
  const body={cardId:'c1',serviceId:'sa',mediaMode:'IMAGE',imageStorageKey:media.key,imageUrl:media.url};
  assert.equal((await f.call(f.cards,'PATCH',body)).status,409);
  for(const changed of [{imageStorageKey:media.key.replace('/a/','/b/'),imageUrl:media.url.replace('/a/','/b/')},{imageUrl:'https://foreign.test/object'},{imageStorageKey:media.key.replace('image-','image-unregistered-'),imageUrl:media.url.replace('image-','image-unregistered-')}])assert.equal((await f.call(f.cards,'PATCH',{...body,...changed},await f.revision('work-cards'))).status,400);
  assert.equal((await f.db.query<any>('SELECT "imageStorageKey" FROM "HomepageWorkCard" WHERE id=\'c1\'')).rows[0].imageStorageKey,null);assert.equal(f.controls.deleted,0);
 }finally{await f.db.close();}
});
