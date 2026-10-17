import assert from 'node:assert/strict';

export async function qualifyNewsletterConsent(driver) {
  const db=driver.prisma,cases=[];
  const ids=id=>({workspaceId:id,campaignWorkspaceId:id,campaignId:`newsletter48-campaign-${id}`,campaignVersion:1,editionId:`newsletter48-edition-${id}`,revisionId:`newsletter48-revision-${id}`});
  for(const [index,id] of ['a','b'].entries()){
    const p=ids(id),clientId=`newsletter48-client-${id}`,email=`newsletter48-${id}@example.test`;
    await db.communicationClient.create({data:{id:clientId,hdPhotoHubUserId:48001+index,firstName:'Synthetic',lastName:'Newsletter',displayName:'Newsletter',email,normalizedEmail:email,lastSyncedAt:new Date(),workspaceMemberships:{create:{workspaceId:id}}}});
    await driver.setWorkspaceMarketingPreference(db,{workspaceId:id,userId:`u${id}`,sessionVersion:1,email:`${id}@example.test`},{clientId,status:'SUBSCRIBED',confirmation:true,consentSource:'Synthetic'});
    await db.newsletterSeries.create({data:{id:`newsletter48-series-${id}`,workspaceId:id,name:'Synthetic',sendRecurrenceKind:'DAY_OF_MONTH',sendLocalTime:'09:00',generationMode:'MANUAL',createdById:`u${id}`}});
    await db.newsletterEdition.create({data:{id:p.editionId,seriesId:`newsletter48-series-${id}`,cycleKey:'synthetic48',intendedSendAt:new Date('2027-01-01'),status:'SEND_FAILED',createdById:`u${id}`}});
    await db.emailCampaign.create({data:{id:p.campaignId,workspaceId:id,createdById:`u${id}`,subject:'Synthetic',body:'Synthetic',status:'FAILED',recipientMode:'SELECTED',selection:{},recipients:{create:{id:`newsletter48-recipient-${id}`,clientId,email,displayName:'Synthetic',status:'FAILED'}}}});
    await db.newsletterDelivery.create({data:{editionId:p.editionId,campaignId:p.campaignId,revisionId:p.revisionId,recipientSnapshot:[],eligibleCount:1,excludedCount:0,contentHash:'synthetic'}});
  }
  const snapshot=async id=>({edition:await db.newsletterEdition.findUnique({where:{id:ids(id).editionId}}),campaign:await db.emailCampaign.findUnique({where:{id:ids(id).campaignId}}),attempts:await db.newsletterDeliveryAttempt.findMany({where:{editionId:ids(id).editionId},orderBy:{id:'asc'}}),tokens:await db.workspaceMarketingPreferenceToken.findMany({where:{workspaceId:id},orderBy:{id:'asc'}})});
  const claim=(id,extra={})=>db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
    await tx.newsletterEdition.update({where:{id:ids(id).editionId},data:{status:'SENDING',rowVersion:{increment:1}}});
    await driver.prepareNewsletterCampaignRetry(tx,{...ids(id),...extra});
  });
  for(const id of ['a','b']){
    const p=ids(id),other=id==='a'?'b':'a',foreign=await snapshot(other);
    const attempt=await db.newsletterDeliveryAttempt.create({data:{workspaceId:id,editionId:p.editionId,revisionId:p.revisionId,executionVersion:1,batchNumber:0,providerOperationId:'synthetic',providerIdempotencyKey:'synthetic',recipientIds:[`newsletter48-recipient-${id}`],payloadHash:'synthetic'}});
    for(const status of ['PREPARED','UNCERTAIN','ACCEPTED']){
      await db.newsletterDeliveryAttempt.update({where:{id:attempt.id},data:{status,providerReceiptIds:['synthetic-receipt']}});
      const before=await snapshot(id);await assert.rejects(claim(id),/RECONCILIATION_REQUIRED/);assert.deepEqual(await snapshot(id),before);assert.deepEqual(await snapshot(other),foreign);
    }
    await db.newsletterDeliveryAttempt.update({where:{id:attempt.id},data:{status:'REJECTED',providerReceiptIds:[]}});
    const before=await snapshot(id);
    for(const extra of [{campaignId:ids(other).campaignId},{campaignVersion:9},{revisionId:'foreign-revision'}]){await assert.rejects(claim(id,extra),/CLAIM_EXPIRED|RECONCILIATION_REQUIRED/);assert.deepEqual(await snapshot(id),before);assert.deepEqual(await snapshot(other),foreign);}
    await claim(id);let state=await snapshot(id);assert.equal(state.campaign.status,'SENDING');assert.equal(state.campaign.rowVersion,1);
    const tokenInput={workspaceId:id,campaignId:p.campaignId,recipientId:`newsletter48-recipient-${id}`,expectedCampaignVersion:1,expectedEmail:`newsletter48-${id}@example.test`,signingSecret:'packet48-synthetic-signing-secret-not-live'};
    const first=await driver.createCampaignDeliveryPreferenceToken(db,tokenInput);assert.match(first,/^v2\./);
    await db.newsletterEdition.update({where:{id:p.editionId},data:{status:'SEND_FAILED'}});await db.emailCampaign.update({where:{id:p.campaignId},data:{status:'FAILED'}});
    await claim(id);assert.equal(await driver.createCampaignDeliveryPreferenceToken(db,tokenInput),first);
    // A fully recorded accepted batch is preserved and does not prohibit retrying other recipients.
    await db.campaignRecipient.update({where:{id:`newsletter48-recipient-${id}`},data:{status:'SENT',providerMessageId:'synthetic-receipt'}});
    await db.newsletterDeliveryAttempt.update({where:{id:attempt.id},data:{status:'ACCEPTED',providerReceiptIds:['synthetic-receipt']}});
    await db.newsletterEdition.update({where:{id:p.editionId},data:{status:'PARTIALLY_SENT'}});await db.emailCampaign.update({where:{id:p.campaignId},data:{status:'PARTIAL'}});
    await claim(id);state=await snapshot(id);assert.equal(state.campaign.rowVersion,1);assert.equal(state.attempts[0].status,'ACCEPTED');assert.deepEqual(await snapshot(other),foreign);
    cases.push({tenant:id,uncertainAndUnrecordedAcceptanceHeld:true,editionClaimRolledBackOnRejection:true,foreignCampaignRejected:true,staleRevisionRejected:true,campaignVersionPreserved:true,rejectedAttemptRetryStableToken:true,recordedAcceptedBatchPreserved:true,otherCompanyUnchanged:true});
  }
  return {cases,providerCalls:false,qualification:'actual retry transaction and token services; no full delivery/provider substitution',schemaChanged:false};
}
