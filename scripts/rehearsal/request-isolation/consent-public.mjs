import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';
import { requireOrigin } from './safety.mjs';

export async function qualifyPublicConsent(origin, driver) {
  requireOrigin(origin);
  const db = driver.prisma, cases = [], email = 'public-shared@example.test', clientId = 'public-shared', tokens = {};
  const hash = token => createHash('sha256').update(token).digest('hex');
  await db.communicationClient.create({ data: { id: clientId, hdPhotoHubUserId: 43001, firstName: 'Synthetic', lastName: 'Public', displayName: 'Public', email, normalizedEmail: email, lastSyncedAt: new Date(), workspaceMemberships: { create: [{ workspaceId: 'a' }, { workspaceId: 'b' }] } } });
  const subscribe = id => driver.setWorkspaceMarketingPreference(db, { workspaceId: id, userId: `u${id}`, sessionVersion: 1, email: `${id}@example.test` }, { clientId, status: 'SUBSCRIBED', confirmation: true, consentSource: 'Synthetic' });
  for (const id of ['a','b']) {
    await subscribe(id);
    await db.emailCampaign.create({ data: { id: `public-campaign-${id}`, workspaceId: id, createdById: `u${id}`, subject: 'Synthetic', body: 'Synthetic', recipientMode: 'SELECTED', selection: {}, status: 'PROCESSING', recipients: { create: { id: `public-recipient-${id}`, clientId, email, displayName: 'Synthetic' } } } });
    tokens[id] = await driver.createWorkspaceCampaignPreferenceToken(db, { workspaceId: id, campaignId: `public-campaign-${id}`, recipientId: `public-recipient-${id}`, expectedCampaignVersion: 1, expectedEmail: email, signingSecret: 'packet43-synthetic-not-a-real-signing-secret' });
  }
  const scoped = async workspaceId => ({ preferences: await db.workspaceMarketingPreference.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }), events: await db.workspaceMarketingPreferenceEvent.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }), tokens: await db.workspaceMarketingPreferenceToken.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }), audit: await db.auditEvent.findMany({ where: { workspaceId }, orderBy: { id: 'asc' } }) });
  const legacy = async () => { const rows = {}; for (const model of ['marketingEmailPreference','marketingEmailPreferenceEvent','marketingEmailPreferenceToken','communicationSuppression','communicationClient','communicationGroupMembership']) rows[model] = await db[model].findMany({ orderBy: { id: 'asc' } }); return rows; };
  const send = (id, token = tokens[id]) => http(origin, `${id === 'a' ? 'b' : 'a'}.example.test`, '/api/unsubscribe', { method: 'POST', body: { token, reason: '  Synthetic reason  ', workspaceId: id === 'a' ? 'b' : 'a', email: 'foreign@example.test', clientId: 'foreign' } });
  const old = await legacy();
  const absent = async () => { const [row] = await db.$queryRaw`SELECT to_regprocedure('packet43_public_audit()')::text AS fn,(SELECT count(*)::integer FROM pg_trigger WHERE tgname='packet43_public_audit') AS triggers`; assert.equal(row.fn, null); assert.equal(row.triggers, 0); };
  await absent();
  for (const id of ['a','b']) {
    const other = id === 'a' ? 'b' : 'a', foreign = await scoped(other), before = await scoped(id);
    for (const reply of await Promise.all([send(id), send(id)])) { assert.equal(reply.status, 200, reply.text); assert.deepEqual(JSON.parse(reply.text), { success: true }); }
    const after = await scoped(id); assert.equal(after.events.length, before.events.length + 1); assert.equal(after.audit.length, before.audit.length + 1);
    assert.equal(after.preferences.find(p => p.normalizedEmail === email).reason, 'Synthetic reason');
    assert.equal(await driver.workspaceAddressIsMarketingEligible(db, id, email), false); assert.equal(await driver.workspaceAddressIsMarketingEligible(db, other, email), true);
    assert.deepEqual(await scoped(other), foreign); assert.deepEqual(await legacy(), old);
    for (const token of ['v2.invalid','v2.'+'z'.repeat(43)]) assert.equal((await send(id, token)).status, 400);
    await db.workspaceMarketingPreferenceToken.update({ where: { tokenHash: hash(tokens[id]) }, data: { expiresAt: new Date(0) } });
    const expired = await scoped(id); assert.equal((await send(id)).status, 400); assert.deepEqual(await scoped(id), expired);
    await db.workspaceMarketingPreferenceToken.update({ where: { tokenHash: hash(tokens[id]) }, data: { expiresAt: new Date(Date.now() + 86400000) } }); await subscribe(id);
    const rollbackBefore = await scoped(id); let pending;
    try {
      await db.$executeRawUnsafe(`CREATE FUNCTION packet43_public_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WORKSPACE_MARKETING_TOKEN_UNSUBSCRIBED' THEN PERFORM pg_advisory_xact_lock(4300,CASE WHEN NEW."workspaceId"='a' THEN 1 ELSE 2 END); END IF; RETURN NEW; END $$`);
      await db.$executeRawUnsafe('CREATE TRIGGER packet43_public_audit BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION packet43_public_audit()');
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(4300,${id === 'a' ? 1 : 2}::integer)`; const [{pid}] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = send(id); const until = Date.now() + 4000; let blocked;
        while (Date.now() < until) { const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid)) AND query LIKE '%AuditEvent%'`; if (rows.length) { assert.equal(rows.length,1); blocked = rows[0].pid; break; } await delay(25); }
        assert.ok(blocked, 'Observe public request waiting at required audit'); const [{cancelled}] = await db.$queryRaw`SELECT pg_cancel_backend(${blocked}::integer) AS cancelled`; assert.equal(cancelled,true);
        const reply = await pending; assert.equal(reply.status,400); assert.doesNotMatch(reply.text,/Prisma|AuditEvent|@|SELECT/);
      }, { timeout: 15000 });
    } finally { await pending; await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS packet43_public_audit ON "AuditEvent"'); await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS packet43_public_audit()'); }
    await absent(); assert.deepEqual(await scoped(id), rollbackBefore); assert.deepEqual(await scoped(other), foreign); assert.deepEqual(await legacy(),old);
    assert.equal((await send(id)).status,200); const retry = await scoped(id); assert.equal(retry.events.length,rollbackBefore.events.length+1); assert.equal(retry.audit.length,rollbackBefore.audit.length+1); await subscribe(id);
    cases.push({tenant:id,forgedHostAndSelectorsIgnored:true,concurrentReplayOneEvent:true,reasonRecorded:true,deliveryReaderHonorsOptOut:true,invalidUnknownExpired400:true,auditWaitObserved:true,onlyObservedQueryCancelled:true,safeFailure400:true,preferenceHistoryLastUseAuditRolledBack:true,retry200:true,foreignAndLegacyUnchanged:true});
  }
  const form = 'List-Unsubscribe=One-Click';
  const status = await new Promise((resolve,reject) => { const req = request(`${origin}/api/unsubscribe?token=${encodeURIComponent(tokens.a)}`, { method:'POST', headers:{host:'a.example.test','content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(form)}, timeout:60000 }, res => {res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Synthetic one-click timeout')));req.end(form); });
  assert.equal(status,200); assert.equal(await driver.workspaceAddressIsMarketingEligible(db,'a',email),false); assert.equal(await driver.workspaceAddressIsMarketingEligible(db,'b',email),true);
  const address = 'public-legacy@example.test';
  for (const [index,id] of ['a','b'].entries()) await db.communicationClient.create({data:{id:`public-legacy-${id}`,hdPhotoHubUserId:43002+index,firstName:'Synthetic',lastName:id,displayName:id,email:address,normalizedEmail:address,lastSyncedAt:new Date(),workspaceMemberships:{create:{workspaceId:id}}}});
  const preference = await db.marketingEmailPreference.create({data:{normalizedEmail:address,status:'SUBSCRIBED',source:'SYNTHETIC_LEGACY'}}), token = 'L'.repeat(43);
  await db.marketingEmailPreferenceToken.create({data:{preferenceId:preference.id,tokenHash:hash(token),expiresAt:new Date(Date.now()+86400000)}});
  const companies = [await scoped('a'),await scoped('b')]; assert.equal((await send('a',token)).status,200);
  assert.equal((await db.marketingEmailPreference.findUniqueOrThrow({where:{id:preference.id}})).status,'UNSUBSCRIBED'); assert.equal(await db.communicationClient.count({where:{normalizedEmail:address,emailSubscribed:false}}),2); assert.deepEqual([await scoped('a'),await scoped('b')],companies);
  await absent(); return {cases,oneClickForm200:true,legacyGlobalScopePreserved:true,injectionRemoved:true,providersCalled:false};
}
