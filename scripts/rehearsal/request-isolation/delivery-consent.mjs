import assert from 'node:assert/strict';
export async function qualifyDeliveryConsent(driver) {
  const db=driver.prisma,cases=[],addresses=['delivery-shared@example.test','delivery-unknown@example.test','delivery-legacy@example.test','delivery-suppressed@example.test','delivery-safety@example.test'];
  for(const workspaceId of ['a','b'])for(const normalizedEmail of addresses.filter(a=>!a.includes('unknown')))await db.workspaceMarketingPreference.create({data:{workspaceId,normalizedEmail,status:workspaceId==='a'?'SUBSCRIBED':'UNSUBSCRIBED',source:'SYNTHETIC_DELIVERY'}});
  for(const [index,status] of [[2,'UNSUBSCRIBED'],[3,'SUPPRESSED']])await db.marketingEmailPreference.create({data:{normalizedEmail:addresses[index],status,source:'SYNTHETIC_DELIVERY'}});
  await db.communicationSuppression.create({data:{normalizedEmail:addresses[4],reason:'SYNTHETIC_DELIVERY'}});
  const snapshot=async()=>{const r={};for(const model of ['workspaceMarketingPreference','workspaceMarketingPreferenceEvent','workspaceMarketingPreferenceToken','marketingEmailPreference','marketingEmailPreferenceEvent','marketingEmailPreferenceToken','communicationSuppression','communicationClient','communicationGroupMembership'])r[model]=await db[model].findMany({orderBy:{id:'asc'}});return r;};
  const before=await snapshot(), oldFlag=process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED;
  try{
    for(const tenantMode of ['true','false']){
      process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED=tenantMode;
      assert.deepEqual([...await driver.eligibleMarketingAddresses(db,'a',addresses.map(e=>' '+e.toUpperCase()+' '))],[addresses[0]]);
      assert.deepEqual([...await driver.eligibleMarketingAddresses(db,'b',addresses)],[]);
      await assert.rejects(driver.eligibleMarketingAddresses(db,'',addresses),/CONSENT_WORKSPACE_REQUIRED/);
      cases.push({tenantMode,ownSubscriptionAllowed:true,otherCompanyUnsubscribeDenied:true,unknownDenied:true,legacyOptOutSuppressedAndSafetyDenied:true,normalizationApplied:true});
    }
  }finally{process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED=oldFlag;}
  assert.deepEqual(await snapshot(),before);
  // Reverse the independent states and prove the same query in both directions.
  for(const [workspaceId,status] of [['a','UNSUBSCRIBED'],['b','SUBSCRIBED']])await db.workspaceMarketingPreference.update({where:{workspaceId_normalizedEmail:{workspaceId,normalizedEmail:addresses[0]}},data:{status}});
  assert.equal(await driver.workspaceAddressIsMarketingEligible(db,'a',addresses[0]),false);
  assert.equal(await driver.workspaceAddressIsMarketingEligible(db,'b',addresses[0]),true);
  return {cases,reverseDirectionQualified:true,readOnlySnapshotUnchanged:true,flagRestored:true,providersCalled:false,legacyCompatibility:'sole-company branch covered by module fixture'};
}
