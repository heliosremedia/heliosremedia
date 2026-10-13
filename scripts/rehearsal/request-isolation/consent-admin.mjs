import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export async function qualifyConsentAdmin(origin, driver) {
  const db=driver.prisma, cases=[], rollbacks=[];
  for(const [index,id] of ['a','b','shared'].entries())await db.communicationClient.create({data:{id:`consent-${id}`,hdPhotoHubUserId:38001+index,firstName:'Synthetic',lastName:id,displayName:`Consent ${id}`,email:'consent-shared@example.test',normalizedEmail:'consent-shared@example.test',lastSyncedAt:new Date(),workspaceMemberships:{create:(id==='shared'?['a','b']:[id]).map(workspaceId=>({workspaceId}))}}});
  await db.marketingEmailPreference.create({data:{normalizedEmail:'consent-shared@example.test',status:'SUPPRESSED',source:'SYNTHETIC_SAFETY'}});
  await db.communicationSuppression.create({data:{normalizedEmail:'consent-shared@example.test',reason:'SYNTHETIC_SAFETY'}});
  await db.communicationClient.create({data:{id:'admin-write-shared',hdPhotoHubUserId:45001,firstName:'Synthetic',lastName:'Admin',displayName:'Admin shared',email:'admin-write@example.test',normalizedEmail:'admin-write@example.test',lastSyncedAt:new Date(),workspaceMemberships:{create:[{workspaceId:'a'},{workspaceId:'b'}]}}});
  const snapshot=async()=>{const rows={};for(const model of ['communicationClient','marketingEmailPreference','marketingEmailPreferenceEvent','marketingEmailPreferenceToken','communicationGroupMembership','communicationSuppression'])rows[model]=await db[model].findMany({orderBy:{id:'asc'}});return rows;};
  const scoped=async workspaceId=>({preferences:await db.workspaceMarketingPreference.findMany({where:{workspaceId},orderBy:{id:'asc'}}),events:await db.workspaceMarketingPreferenceEvent.findMany({where:{workspaceId},orderBy:{id:'asc'}}),audit:await db.auditEvent.findMany({where:{workspaceId},orderBy:{id:'asc'}})});
  const send=(id,clientId='admin-write-shared',action='resubscribe',extra={})=>http(origin,`${id==='a'?'b':'a'}.example.test`,'/api/admin/clients/preferences',{method:'POST',headers:{cookie:driver.cookie(id)},body:{clientId,action,confirmation:true,consentSource:'Synthetic',workspaceId:id==='a'?'b':'a',...extra}});
  const legacyBefore=await snapshot();
  for(const id of ['a','b']) {
    const other=id==='a'?'b':'a';
    for(const action of ['unsubscribe','resubscribe'])assert.equal((await send(id,`consent-${other}`,action)).status,404);
    for(const clientId of [`consent-${id}`,'consent-shared']){
      const foreign=await scoped(other);assert.equal((await send(id,clientId,'unsubscribe')).status,200);assert.equal((await send(id,clientId,'resubscribe')).status,409);assert.deepEqual(await scoped(other),foreign);
    }
    assert.equal((await send(id,'admin-write-shared','resubscribe',{confirmation:false})).status,400);
    assert.equal((await send(id)).status,200);
  }
  assert.deepEqual(await snapshot(),legacyBefore);
  const waitFor=async(pid,table)=>{const until=Date.now()+8000;while(Date.now()<until){const rows=await db.$queryRaw`SELECT pid,query FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))`;const match=rows.filter(r=>r.query.includes(table));if(match.length){assert.equal(match.length,1);return match[0].pid;}await delay(25);}assert.fail(`Missing observed ${table} wait`);};
  for(const id of ['a','b']) {
    const other=id==='a'?'b':'a', foreign=await scoped(other);
    assert.equal((await send(id,'admin-write-shared','unsubscribe')).status,200);
    assert.equal((await driver.readWorkspaceMarketingEligibility(db,id,'admin-write@example.test')).eligible,false);assert.equal((await driver.readWorkspaceMarketingEligibility(db,other,'admin-write@example.test')).eligible,true);assert.deepEqual(await scoped(other),foreign);
    const replay=await scoped(id);assert.equal((await send(id,'admin-write-shared','unsubscribe')).status,200);assert.deepEqual(await scoped(id),replay);
    for(const change of ['revoked','demoted']) {
      const before=await scoped(id);let pending;
      try {
        await db.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${id} FOR UPDATE`;const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;pending=send(id);await waitFor(pid,'Workspace');
          await tx.workspaceMembership.update({where:{workspaceId_userId:{workspaceId:id,userId:`u${id}`}},data:change==='revoked'?{status:'REVOKED'}:{role:'EDITOR'}});
        },{timeout:15000});
        assert.equal((await pending).status,403);assert.deepEqual(await scoped(id),before);assert.deepEqual(await snapshot(),legacyBefore);
        cases.push({tenant:id,change,databaseWaitObserved:true,currentAccessRejected403:true,companyAndLegacyUnchanged:true});
      }finally{await pending;await db.workspaceMembership.update({where:{workspaceId_userId:{workspaceId:id,userId:`u${id}`}},data:{status:'ACTIVE',role:'OWNER'}});}
    }
    const before=await scoped(id);let pending;
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION packet45_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKSPACE_MARKETING_SUBSCRIBED' AND NEW.metadata->>'clientId'='admin-write-shared' THEN PERFORM pg_advisory_xact_lock(4500,CASE WHEN NEW."workspaceId"='a' THEN 1 ELSE 2 END); END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER packet45_admin_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION packet45_admin_audit()');
      await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(4500,${id==='a'?1:2}::integer)`;const [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;pending=send(id);const blocked=await waitFor(pid,'AuditEvent');
        const [{cancelled}]=await db.$queryRaw`SELECT pg_cancel_backend(${blocked}::integer) AS cancelled`;assert.equal(cancelled,true);const reply=await pending;assert.equal(reply.status,500);assert.doesNotMatch(reply.text,/Prisma|AuditEvent|SELECT|@/);
      },{timeout:15000});
    }finally{await pending;await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet45_admin_audit ON "AuditEvent"');await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS packet45_admin_audit()');}
    const [injection]=await db.$queryRaw`SELECT to_regprocedure('packet45_admin_audit()')::text AS fn,(SELECT count(*)::integer FROM pg_trigger WHERE tgname='packet45_admin_audit') AS triggers`;assert.equal(injection.fn,null);assert.equal(injection.triggers,0);
    assert.deepEqual(await scoped(id),before);assert.deepEqual(await scoped(other),foreign);assert.deepEqual(await snapshot(),legacyBefore);
    assert.equal((await send(id)).status,200);const retry=await scoped(id);assert.equal(retry.events.length,before.events.length+1);assert.equal(retry.audit.length,before.audit.length+1);assert.equal((await send(id)).status,200);assert.deepEqual(await scoped(id),retry);
    rollbacks.push({tenant:id,auditWaitObserved:true,onlyObservedQueryCancelled:true,requiredAuditRollback:true,retrySucceeded:true,replayInert:true,otherCompanyAndLegacyUnchanged:true});
  }
  return {cases,rollbacks,foreignClients404BothDirections:true,companyWrites200BothDirections:true,protectedResubscribe409BothDirections:true,sharedClientIndependent:true,globalSafetyAndPreferencesUnchanged:true,membershipRestored:true,injectionRemoved:true,legacyCompatibility:'module-level adapters only',providerCalls:false};
}
