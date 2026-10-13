import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function qualifyConsentTokens(driver) {
  const db=driver.prisma, cases=[], rollbacks=[];
  const email='token-shared@example.test', clientId='token-shared';
  await db.communicationClient.create({data:{id:clientId,hdPhotoHubUserId:41001,firstName:'Synthetic',lastName:'Token',displayName:'Token',email,normalizedEmail:email,lastSyncedAt:new Date(),workspaceMemberships:{create:[{workspaceId:'a'},{workspaceId:'b'}]}}});
  const input=id=>({workspaceId:id,campaignId:`token-campaign-${id}`,recipientId:`token-recipient-${id}`,expectedCampaignVersion:1,expectedEmail:email,signingSecret:'packet41-synthetic-signing-secret-not-a-live-secret'});
  const mint=(id,extra={})=>driver.createWorkspaceCampaignPreferenceToken(db,{...input(id),...extra});
  const consume=token=>driver.consumeWorkspacePreferenceToken(db,token);
  const hash=token=>createHash('sha256').update(token).digest('hex');
  const set=id=>driver.setWorkspaceMarketingPreference(db,{userId:`u${id}`,workspaceId:id,sessionVersion:1,email:`${id}@example.test`},{clientId,status:'SUBSCRIBED',confirmation:true,consentSource:'Synthetic consent'});
  const snapshot=async workspaceId=>({preferences:await db.workspaceMarketingPreference.findMany({where:{workspaceId},orderBy:{id:'asc'}}),events:await db.workspaceMarketingPreferenceEvent.findMany({where:{workspaceId},orderBy:{id:'asc'}}),tokens:await db.workspaceMarketingPreferenceToken.findMany({where:{workspaceId},orderBy:{id:'asc'}}),audit:await db.auditEvent.findMany({where:{workspaceId},orderBy:{id:'asc'}})});
  const legacy=async()=>{const r={};for(const model of ['marketingEmailPreference','marketingEmailPreferenceEvent','marketingEmailPreferenceToken','communicationSuppression','communicationClient','communicationGroupMembership'])r[model]=await db[model].findMany({orderBy:{id:'asc'}});return r;};
  for(const id of ['a','b']){
    await set(id);
    await db.emailCampaign.create({data:{id:`token-campaign-${id}`,workspaceId:id,createdById:`u${id}`,subject:'Synthetic',body:'Synthetic',recipientMode:'SELECTED',selection:{},status:'PROCESSING',recipients:{create:{id:`token-recipient-${id}`,clientId,email,displayName:'Synthetic'}}}});
  }
  const old=await legacy(), tokens={};
  for(const id of ['a','b']){
    const other=id==='a'?'b':'a', before=await snapshot(id);
    for(const extra of [{campaignId:`token-campaign-${other}`},{recipientId:`token-recipient-${other}`},{expectedCampaignVersion:2},{expectedEmail:'wrong@example.test'}])await assert.rejects(mint(id,extra),/CONSENT_TOKEN_SOURCE_INVALID/);
    await db.emailCampaign.update({where:{id:`token-campaign-${id}`},data:{status:'CANCELLED'}});
    await assert.rejects(mint(id),/CONSENT_TOKEN_SOURCE_INVALID/);
    await db.emailCampaign.update({where:{id:`token-campaign-${id}`},data:{status:'PROCESSING'}});
    await db.communicationClientWorkspace.delete({where:{workspaceId_clientId:{workspaceId:id,clientId}}});
    try {await assert.rejects(mint(id),/CONSENT_TOKEN_SOURCE_INVALID/);}finally{await db.communicationClientWorkspace.create({data:{workspaceId:id,clientId}});}
    assert.deepEqual(await snapshot(id),before);
    tokens[id]=await mint(id); assert.equal(await mint(id),tokens[id]);
    const rows=await db.workspaceMarketingPreferenceToken.findMany({where:{tokenHash:hash(tokens[id])}});assert.equal(rows.length,1);assert.equal(rows[0].workspaceId,id);assert.equal(rows[0].campaignId,input(id).campaignId);assert.equal(rows[0].messageId,input(id).recipientId);assert.equal(JSON.stringify(rows).includes(tokens[id]),false);
  }
  assert.notEqual(tokens.a,tokens.b);
  // Unknown/versioned and legacy-shaped tokens do not enter the other namespace.
  for(const token of ['v2.'+'z'.repeat(43),'x'.repeat(43),'invalid'])assert.equal(await consume(token),null);
  for(const id of ['a','b']){
    const other=id==='a'?'b':'a', foreign=await snapshot(other), before=await snapshot(id);
    const results=await Promise.all([consume(tokens[id]),consume(tokens[id])]);assert.equal(results.filter(r=>r.changed).length,1);
    const after=await snapshot(id);assert.equal(after.events.length,before.events.length+1);assert.equal(after.audit.length,before.audit.length+1);
    assert.equal((await driver.readWorkspaceMarketingEligibility(db,id,email)).eligible,false);assert.equal((await driver.readWorkspaceMarketingEligibility(db,other,email)).eligible,true);assert.deepEqual(await snapshot(other),foreign);
    await assert.rejects(mint(id),/CONSENT_TOKEN_SOURCE_INVALID/);await set(id);
    cases.push({tenant:id,foreignSourceRejected:true,staleOrCancelledSourceRejected:true,membershipRequired:true,stableRetryHashOnly:true,concurrentReplayOneEvent:true,otherCompanyUnchanged:true});
  }
  // Protected legacy state is a minting block, never a company-resubscribe override.
  await db.marketingEmailPreference.create({data:{normalizedEmail:email,status:'UNSUBSCRIBED',source:'SYNTHETIC_TOKEN_BLOCK'}});
  for(const id of ['a','b'])await assert.rejects(mint(id),/CONSENT_TOKEN_SOURCE_INVALID/);
  await db.marketingEmailPreference.delete({where:{normalizedEmail:email}});
  const waitFor=async(pid,table)=>{const until=Date.now()+4000;while(Date.now()<until){const rows=await db.$queryRaw`SELECT pid,query FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;const matches=rows.filter(r=>r.query.includes(table));if(matches.length){assert.equal(matches.length,1);return matches[0].pid;}await delay(25);}assert.fail(`Expected blocked ${table} query`);};
  for(const id of ['a','b']){
    const before=await snapshot(id);let pending;
    await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;
      const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
      pending=consume(tokens[id]);await waitFor(pid,'Workspace');
      await tx.workspaceMarketingPreferenceToken.update({where:{tokenHash:hash(tokens[id])},data:{expiresAt:new Date(0)}});
    },{timeout:15000});
    assert.equal(await pending,null);const after=await snapshot(id);assert.deepEqual(after.preferences,before.preferences);assert.deepEqual(after.events,before.events);assert.deepEqual(after.audit,before.audit);
    assert.equal(after.tokens.find(t=>t.tokenHash===hash(tokens[id])).lastUsedAt.getTime(),before.tokens.find(t=>t.tokenHash===hash(tokens[id])).lastUsedAt.getTime());
    assert.equal(await mint(id),tokens[id]);
  }
  const absent=async()=>{const [r]=await db.$queryRaw`SELECT to_regprocedure('packet41_token_audit()')::text AS fn,(SELECT count(*)::integer FROM pg_trigger WHERE tgname='packet41_token_audit') AS triggers`;assert.equal(r.fn,null);assert.equal(r.triggers,0);};
  await absent();
  for(const id of ['a','b']){
    const before=await snapshot(id),other=id==='a'?'b':'a',foreign=await snapshot(other);let pending;
    try{
      await db.$executeRawUnsafe(`CREATE FUNCTION packet41_token_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKSPACE_MARKETING_TOKEN_UNSUBSCRIBED' THEN PERFORM pg_advisory_xact_lock(4100,CASE WHEN NEW."workspaceId"='a' THEN 1 ELSE 2 END); END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER packet41_token_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION packet41_token_audit()');
      await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(4100,${id==='a'?1:2}::integer)`;
        const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending=consume(tokens[id]).then(result=>({result}),error=>({error}));const blocked=await waitFor(pid,'AuditEvent');
        assert.deepEqual(await snapshot(id),before);
        const [{cancelled}]=await db.$queryRaw`SELECT pg_cancel_backend(${blocked}::integer) AS cancelled`;assert.equal(cancelled,true);assert.ok((await pending).error);
      },{timeout:15000});
    }finally{await pending;await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet41_token_audit ON "AuditEvent"');await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS packet41_token_audit()');}
    await absent();assert.deepEqual(await snapshot(id),before);assert.deepEqual(await snapshot(other),foreign);
    assert.equal((await consume(tokens[id])).changed,true);const after=await snapshot(id);assert.equal(after.events.length,before.events.length+1);assert.equal(after.audit.length,before.audit.length+1);
    assert.equal((await consume(tokens[id])).changed,false);const replay=await snapshot(id);assert.deepEqual(replay.events,after.events);assert.deepEqual(replay.audit,after.audit);assert.deepEqual(replay.preferences,after.preferences);
    rollbacks.push({tenant:id,auditWaitObserved:true,onlyObservedQueryCancelled:true,preferenceHistoryTokenAndAuditRolledBack:true,retrySucceeded:true,replayInert:true,foreignUnchanged:true});
  }
  await absent();assert.deepEqual(await legacy(),old);
  return {cases,rollbacks,expiryRecheckedAfterObservedWaitBothDirections:true,legacyNamespaceAndSafetyUnchanged:true,protectedOptOutBlocksMinting:true,injectionRemoved:true,applicationRoutesActivated:false,providersCalled:false};
}
