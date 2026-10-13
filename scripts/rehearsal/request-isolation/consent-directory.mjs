import assert from 'node:assert/strict';
import { http } from './http.mjs';
export async function qualifyConsentDirectory(origin, driver) {
  const db = driver.prisma, cases = [], shared = await db.communicationClient.findUniqueOrThrow({where:{id:'public-shared'}});
  for (const [index,id] of ['a','b'].entries()) {
    const email=`directory-${id}@example.test`;
    await db.communicationClient.create({data:{id:`directory-${id}`,hdPhotoHubUserId:44001+index,firstName:'Synthetic',lastName:id,displayName:`DIRECTORY44_PRIVATE_${id}`,email,normalizedEmail:email,lastSyncedAt:new Date(),workspaceMemberships:{create:{workspaceId:id}}}});
    await db.workspaceMarketingPreference.create({data:{workspaceId:id,normalizedEmail:email,status:'SUBSCRIBED',source:`DIRECTORY44_SOURCE_${id}`}});
    await db.workspaceMarketingPreference.update({where:{workspaceId_normalizedEmail:{workspaceId:id,normalizedEmail:shared.normalizedEmail}},data:{source:`DIRECTORY44_SHARED_SOURCE_${id}`}});
  }
  const state=async()=>({company:await db.workspaceMarketingPreference.findMany({orderBy:{id:'asc'}}),legacy:await db.marketingEmailPreference.findMany({orderBy:{id:'asc'}}),safety:await db.communicationSuppression.findMany({orderBy:{id:'asc'}}),clients:await db.communicationClient.findMany({orderBy:{id:'asc'}})});
  const before=await state();
  for (const id of ['a','b']) {
    const [row]=await driver.readClientConsentProjection(db,id,[shared]); assert.equal(row.emailStatus,id==='a'?'UNSUBSCRIBED':'SUBSCRIBED'); assert.equal(row.marketingEligible,id==='b');
    const other=id==='a'?'b':'a';
    const reply=await http(origin,`${other}.example.test`,'/admin/clients',{headers:{cookie:driver.cookie(id)}});
    assert.equal(reply.status,200);assert.ok(reply.text.includes(`DIRECTORY44_PRIVATE_${id}`));assert.ok(reply.text.includes(`DIRECTORY44_SOURCE_${id}`));assert.ok(!reply.text.includes(`DIRECTORY44_PRIVATE_${other}`));assert.ok(!reply.text.includes(`DIRECTORY44_SOURCE_${other}`));assert.ok(reply.text.includes(`DIRECTORY44_SHARED_SOURCE_${id}`));assert.ok(!reply.text.includes(`DIRECTORY44_SHARED_SOURCE_${other}`));
    cases.push({tenant:id,companyStatusMatchesPublicUnsubscribe:true,eligibilityMatchesDelivery:true,ownedDirectoryRendered:true,foreignClientAndSourceAbsent:true});
  }
  assert.deepEqual(await state(),before);
  await db.marketingEmailPreference.create({data:{normalizedEmail:shared.normalizedEmail,status:'UNSUBSCRIBED',source:'DIRECTORY44_PRIVATE_LEGACY_SOURCE',effectiveAt:new Date('2020-01-02T03:04:05Z')}});
  const protectedBefore=await state();
  for (const id of ['a','b']) {
    const [row]=await driver.readClientConsentProjection(db,id,[shared]);assert.equal(row.emailStatus,'SUPPRESSED');assert.equal(row.emailStatusSource,null);assert.equal(row.emailStatusEffectiveAt,null);assert.equal(row.marketingEligible,false);
    const reply=await http(origin,`${id}.example.test`,'/admin/clients',{headers:{cookie:driver.cookie(id)}});assert.equal(reply.status,200);assert.ok(reply.text.includes(`DIRECTORY44_PRIVATE_${id}`));assert.ok(!reply.text.includes('DIRECTORY44_PRIVATE_LEGACY_SOURCE'));assert.ok(!reply.text.includes('2020-01-02T03:04:05'));
  }
  assert.deepEqual(await state(),protectedBefore);
  return {cases,protectedMetadataRedactedBothDirections:true,readOnlySnapshotsUnchanged:true,providersCalled:false};
}
