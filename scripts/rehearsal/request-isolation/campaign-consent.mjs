import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function qualifyCampaignConsent(driver) {
  const db=driver.prisma, cases=[], email='campaign47@example.test', clientId='campaign47-shared';
  await db.communicationClient.create({data:{id:clientId,hdPhotoHubUserId:47001,firstName:'Synthetic',lastName:'Campaign',displayName:'Campaign token',email,normalizedEmail:email,lastSyncedAt:new Date(),workspaceMemberships:{create:[{workspaceId:'a'},{workspaceId:'b'}]}}});
  const input=id=>({workspaceId:id,campaignId:`campaign47-${id}`,recipientId:`campaign47-recipient-${id}`,expectedCampaignVersion:1,expectedEmail:email,signingSecret:'packet47-synthetic-signing-secret-not-live'});
  const mint=(id,extra={})=>driver.createCampaignDeliveryPreferenceToken(db,{...input(id),...extra});
  const snapshot=async()=>({legacy:await db.marketingEmailPreferenceToken.findMany({orderBy:{id:'asc'}}),company:await db.workspaceMarketingPreferenceToken.findMany({orderBy:{id:'asc'}}),preferences:await db.marketingEmailPreference.findMany({orderBy:{id:'asc'}})});
  for(const id of ['a','b']) {
    await driver.setWorkspaceMarketingPreference(db,{workspaceId:id,userId:`u${id}`,sessionVersion:1,email:`${id}@example.test`},{clientId,status:'SUBSCRIBED',confirmation:true,consentSource:'Synthetic'});
    await db.emailCampaign.create({data:{id:input(id).campaignId,workspaceId:id,createdById:`u${id}`,subject:'Synthetic',body:'Synthetic',recipientMode:'SELECTED',selection:{},status:'PROCESSING',recipients:{create:{id:input(id).recipientId,clientId,email,displayName:'Synthetic'}}}});
  }
  for(const id of ['a','b']) {
    const other=id==='a'?'b':'a';
    const initial=await snapshot();
    for(const extra of [{campaignId:input(other).campaignId},{recipientId:input(other).recipientId},{expectedEmail:'foreign@example.test'},{expectedCampaignVersion:9}]) await assert.rejects(mint(id,extra),/SOURCE_INVALID/);
    await db.communicationClient.update({where:{id:clientId},data:{emailSubscribed:false}});
    try {await assert.rejects(mint(id),/SOURCE_INVALID/);}finally{await db.communicationClient.update({where:{id:clientId},data:{emailSubscribed:true}});}
    assert.deepEqual(await snapshot(),initial);
    const [token,replay]=await Promise.all([mint(id),mint(id)]);assert.equal(token,replay);assert.match(token,/^v2\./);
    const hash=createHash('sha256').update(token).digest('hex');const rows=await db.workspaceMarketingPreferenceToken.findMany({where:{tokenHash:hash}});assert.equal(rows.length,1);assert.equal(rows[0].source,'CAMPAIGN_RECIPIENT_REVISION_1');assert.equal(rows[0].workspaceId,id);assert.equal(rows[0].messageId,input(id).recipientId);assert.equal(JSON.stringify(rows).includes(token),false);
    const before=await snapshot();
    await assert.rejects(mint(id,{signingSecret:'changed-packet47-synthetic-secret-value'}),/RETRY_REVIEW_REQUIRED/);
    await db.emailCampaign.update({where:{id:input(id).campaignId},data:{rowVersion:2}});
    await assert.rejects(mint(id,{expectedCampaignVersion:2}),/RETRY_REVIEW_REQUIRED/);
    await db.emailCampaign.update({where:{id:input(id).campaignId},data:{rowVersion:1}});
    assert.deepEqual(await snapshot(),before);
    // A legacy link is immutable evidence of the older protocol, including an expired link.
    const legacy=await db.marketingEmailPreference.upsert({where:{normalizedEmail:email},create:{normalizedEmail:email,status:'UNKNOWN',source:'SYNTHETIC'},update:{}});
    const marker=await db.marketingEmailPreferenceToken.create({data:{preferenceId:legacy.id,campaignId:input(id).campaignId,tokenHash:`packet47-legacy-${id}`,expiresAt:new Date(0)}});
    const blocked=await snapshot();await assert.rejects(mint(id),/LEGACY_RETRY_REVIEW_REQUIRED/);assert.deepEqual(await snapshot(),blocked);
    await db.marketingEmailPreferenceToken.delete({where:{id:marker.id}});
    // Observe helper admission waiting, then change source revision before it can mint.
    const raceBefore=await snapshot();let pending;
    await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
      pending=mint(id).then(()=>({ok:true}),error=>({error}));const until=Date.now()+8000;let observed=false;
      while(Date.now()<until){const waits=await db.$queryRaw`SELECT query FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;if(waits.some(r=>r.query.includes('Workspace'))){observed=true;break;}await delay(25);}assert.equal(observed,true);
      await tx.emailCampaign.update({where:{id:input(id).campaignId},data:{rowVersion:2}});
    },{timeout:15000});
    try {const result=await pending;assert.match(result.error?.message||'',/SOURCE_INVALID/);assert.deepEqual(await snapshot(),raceBefore);}finally{await db.emailCampaign.update({where:{id:input(id).campaignId},data:{rowVersion:1}});}
    cases.push({tenant:id,ownedSourceRequired:true,concurrentRetryOneHash:true,revisionPinned:true,signingIdentityChangeRejected:true,legacyProtocolPreserved:true,observedSourceRaceRejected:true,rejectedSnapshotsUnchanged:true});
  }
  return {cases,providerCalls:false,hosted:false,legacyCompatibility:'module adapters only',noNewSchema:true};
}
