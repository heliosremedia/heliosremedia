import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export async function qualifyConsentAdapters(driver) {
  const db = driver.prisma, cases = [], rollbacks = [];
  let sequence = 40000;
  const actor = id => ({ userId: `u${id}`, workspaceId: id, sessionVersion: 1, email: `${id}@example.test` });
  const createClient = async (id, email, owners) => db.communicationClient.create({ data: {
    id, hdPhotoHubUserId: ++sequence, firstName: 'Synthetic', lastName: id, displayName: id,
    email, normalizedEmail: email, lastSyncedAt: new Date(), workspaceMemberships: { create: owners.map(workspaceId => ({ workspaceId })) },
  } });
  const set = (id, clientId, status) => driver.setWorkspaceMarketingPreference(db, actor(id), { clientId, status, confirmation: true, consentSource: 'Synthetic explicit consent' });
  const eligible = (id, email) => driver.readWorkspaceMarketingEligibility(db, id, email);
  const scoped = async workspaceId => ({
    preferences: await db.workspaceMarketingPreference.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
    events: await db.workspaceMarketingPreferenceEvent.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
    audit: await db.auditEvent.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }),
  });
  const legacy = async () => {
    const rows = {};
    for (const model of ['marketingEmailPreference','marketingEmailPreferenceEvent','marketingEmailPreferenceToken','communicationSuppression','communicationClient','communicationGroupMembership']) rows[model] = await db[model].findMany({ orderBy: { id: 'asc' } });
    return rows;
  };
  const email = 'adapter-shared@example.test';
  await createClient('adapter-shared', email, ['a','b']);
  for (const id of ['a','b']) await createClient(`adapter-private-${id}`, email, [id]);
  const contactBefore = await legacy();
  assert.equal((await eligible('a', email)).eligible, false); assert.equal((await eligible('b', email)).eligible, false);
  const subscribed = await Promise.all([set('a','adapter-shared','SUBSCRIBED'),set('b','adapter-shared','SUBSCRIBED')]);
  assert.ok(subscribed.every(result => result.changed));
  for (const id of ['a','b']) {
    const other = id === 'a' ? 'b' : 'a'; const foreign = await scoped(other);
    assert.equal((await eligible(id, email.toUpperCase())).eligible, true);
    await assert.rejects(set(id,`adapter-private-${other}`,'UNSUBSCRIBED'), /CONSENT_CLIENT_NOT_FOUND/);
    assert.equal((await set(id,'adapter-shared','UNSUBSCRIBED')).changed, true);
    assert.equal((await eligible(id,email)).eligible,false); assert.equal((await eligible(other,email)).eligible,true);
    assert.deepEqual(await scoped(other), foreign);
    const beforeReplay = await scoped(id); assert.equal((await set(id,'adapter-shared','UNSUBSCRIBED')).changed,false); assert.deepEqual(await scoped(id),beforeReplay);
    await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId:id,userId:`u${id}` } }, data: { role:'EDITOR' } });
    try { await assert.rejects(set(id,'adapter-shared','SUBSCRIBED'), /WORKSPACE_WRITE_FORBIDDEN/); assert.deepEqual(await scoped(id),beforeReplay); }
    finally { await db.workspaceMembership.update({ where: { workspaceId_userId: { workspaceId:id,userId:`u${id}` } }, data: { role:'OWNER' } }); }
    await set(id,'adapter-shared','SUBSCRIBED');
    cases.push({ tenant:id, foreignClientRejected:true, independentSharedClientConsent:true, otherCompanyStillEligible:true, replayInert:true, currentRoleEnforced:true });
  }
  assert.deepEqual(await legacy(),contactBefore);
  const blocks = [];
  for (const kind of ['UNSUBSCRIBED','SUPPRESSED','SAFETY']) {
    const address = `adapter-${kind.toLowerCase()}@example.test`, clientId = `adapter-block-${kind}`;
    await createClient(clientId,address,['a','b']);
    for (const id of ['a','b']) await set(id,clientId,'SUBSCRIBED');
    if (kind === 'SAFETY') await db.communicationSuppression.create({ data: { normalizedEmail:address,reason:'SYNTHETIC' } });
    else await db.marketingEmailPreference.create({ data: { normalizedEmail:address,status:kind,source:'SYNTHETIC_LEGACY' } });
    const before = await legacy();
    for (const id of ['a','b']) {
      assert.deepEqual(await eligible(id,address),{eligible:false,reason:'PROTECTED_BLOCK'});
      await assert.rejects(set(id,clientId,'SUBSCRIBED'),/CONSENT_PROTECTED_BLOCK/);
      await set(id,clientId,'UNSUBSCRIBED');
      await assert.rejects(set(id,clientId,'SUBSCRIBED'),/CONSENT_PROTECTED_BLOCK/);
    }
    assert.deepEqual(await legacy(),before); blocks.push({kind,bothCompaniesBlocked:true,unsubscribeCannotBypassBlock:true,legacyAndSafetyUnchanged:true});
  }
  const absent = async () => {
    const [row] = await db.$queryRaw`SELECT to_regprocedure('packet40_consent_audit()')::text AS function_name,(SELECT count(*)::integer FROM pg_trigger WHERE tgname='packet40_consent_audit') AS triggers`;
    assert.equal(row.function_name,null); assert.equal(row.triggers,0);
  };
  await absent();
  for (const id of ['a','b']) {
    const clientId = `adapter-rollback-${id}`; await createClient(clientId,`${clientId}@example.test`,[id]); await set(id,clientId,'UNSUBSCRIBED');
    const before = await scoped(id), other = id === 'a' ? 'b' : 'a', foreign = await scoped(other), old = await legacy();
    let pending;
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION packet40_consent_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action='WORKSPACE_MARKETING_SUBSCRIBED' AND NEW.metadata->>'clientId' IN ('adapter-rollback-a','adapter-rollback-b') THEN
          PERFORM pg_advisory_xact_lock(4000,CASE WHEN NEW."workspaceId"='a' THEN 1 ELSE 2 END);
        END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER packet40_consent_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION packet40_consent_audit()');
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(4000,${id === 'a' ? 1 : 2}::integer)`;
        const [{pid}] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = set(id,clientId,'SUBSCRIBED').then(result=>({result}),error=>({error}));
        const deadline = Date.now()+4000; let blockedPid;
        while(Date.now()<deadline) {
          const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%AuditEvent%'`;
          if(rows.length){assert.equal(rows.length,1);blockedPid=rows[0].pid;break;} await delay(25);
        }
        assert.ok(blockedPid,'Observe required audit after preference/history writes'); assert.deepEqual(await scoped(id),before);
        const [{cancelled}] = await db.$queryRaw`SELECT pg_cancel_backend(${blockedPid}::integer) AS cancelled`; assert.equal(cancelled,true);
        assert.ok((await pending).error,'Cancelled audit must reject the transaction');
      },{timeout:15000});
    } finally {
      await pending;
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet40_consent_audit ON "AuditEvent"');
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS packet40_consent_audit()');
    }
    await absent(); assert.deepEqual(await scoped(id),before); assert.deepEqual(await scoped(other),foreign); assert.deepEqual(await legacy(),old);
    assert.equal((await set(id,clientId,'SUBSCRIBED')).changed,true);
    const after = await scoped(id); assert.equal(after.events.length,before.events.length+1); assert.equal(after.audit.length,before.audit.length+1);
    assert.equal((await set(id,clientId,'SUBSCRIBED')).changed,false); assert.deepEqual(await scoped(id),after);
    rollbacks.push({tenant:id,auditWaitObserved:true,cancelledOnlyObservedQuery:true,preferenceHistoryAndAuditRolledBack:true,retrySucceeded:true,replayInert:true,foreignAndLegacyUnchanged:true});
  }
  await absent();
  return {cases,blocks,rollbacks,concurrentSharedAddressSucceeded:true,injectionRemoved:true,applicationRoutesActivated:false,providersCalled:false};
}
