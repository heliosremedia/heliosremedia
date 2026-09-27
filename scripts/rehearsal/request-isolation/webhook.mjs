import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { http } from './http.mjs';

export const WEBHOOK_KEY = Buffer.from('packet22-synthetic-webhook-signing-only').toString('base64');

export async function qualifyWebhook(origin, driver) {
  const db = driver.prisma;
  for (const [index, id] of ['a', 'b'].entries()) {
    await db.communicationClient.create({ data: { id: `webhook-client-${id}`, hdPhotoHubUserId: index + 1,
      firstName: 'Synthetic', lastName: id, displayName: `Synthetic ${id}`, email: `${id}@example.test`, normalizedEmail: `${id}@example.test`, lastSyncedAt: new Date() } });
    await db.emailCampaign.create({ data: { id: `webhook-email-${id}`, workspaceId: id, createdById: `u${id}`,
      subject: 'Synthetic', body: 'Synthetic', recipientMode: 'INDIVIDUALS', selection: {} } });
    await db.campaignRecipient.create({ data: { id: `webhook-recipient-${id}`, campaignId: `webhook-email-${id}`,
      clientId: `webhook-client-${id}`, email: `${id}@example.test`, displayName: 'Synthetic' } });
    await db.referralCampaign.create({ data: { id: `webhook-referral-${id}`, workspaceId: id, createdById: `u${id}`,
      internalName: 'Synthetic', publicTitle: 'Synthetic', purpose: 'Synthetic', audienceMode: 'INDIVIDUALS', audienceRules: {},
      terms: 'Synthetic', landingHeadline: 'Synthetic', landingBody: 'Synthetic', landingThankYou: 'Synthetic', privacyNotice: 'Synthetic',
      invitationSubject: 'Synthetic', invitationBody: 'Synthetic', followUpConfiguration: {}, communicationTemplates: {} } });
    await db.referralCommunication.create({ data: { id: `webhook-communication-${id}`, campaignId: `webhook-referral-${id}`,
      kind: 'INVITATION', recipientEmail: `${id}@example.test`, subject: 'Synthetic' } });
  }
  const snapshot = async () => {
    const tables = ['campaignRecipient', 'campaignDeliveryEvent', 'referralCommunication', 'referralInvitation', 'referralAuditEvent',
      'communicationClient', 'communicationSuppression', 'marketingEmailPreference', 'marketingEmailPreferenceEvent'];
    return Promise.all(tables.map(table => db[table].findMany({ orderBy: { id: 'asc' } })));
  };
  const signedPayload = async (host, body, eventId = randomUUID(), valid = true) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', Buffer.from(WEBHOOK_KEY, 'base64')).update(`${eventId}.${timestamp}.${JSON.stringify(body)}`).digest('base64');
    const response = await http(origin, `${host}.example.test`, '/api/webhooks/resend', { method: 'POST', body,
      headers: { 'svix-id': eventId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${valid ? signature : 'invalid'}` } });
    return { ...response, eventId };
  };
  const signed = (host, message, type = 'email.delivered', eventId = randomUUID(), valid = true, recipient = 'foreign@example.test') =>
    signedPayload(host, { type, data: { email_id: message, to: [recipient], tags: { campaign_id: 'webhook-email-b' },
      ...(type === 'email.bounced' ? { bounce: { type: 'Permanent' } } : {}) } }, eventId, valid);
  const initial = await snapshot(); const count = await db.resendWebhookEvent.count();
  assert.equal((await signed('a', 'unknown', 'email.delivered', randomUUID(), false)).status, 401);
  assert.equal(await db.resendWebhookEvent.count(), count); assert.deepEqual(await snapshot(), initial);
  const malformed = [null, [], true, 7, 'text', {}, { type: [] },
    ...[true, 42, 'text', []].map(data => ({ type: 'email.delivered', data })),
    ...[42, {}, []].map(email_id => ({ type: 'email.delivered', data: { email_id } })),
    ...[true, 42, 'text', []].map(click => ({ type: 'email.clicked', data: { click } })),
    { type: 'email.clicked', data: { click: { link: {} } } },
    ...[true, 42, 'text', []].map(bounce => ({ type: 'email.bounced', data: { bounce } })),
    ...[{ type: 42 }, { subtype: [] }, { message: {} }].map(bounce => ({ type: 'email.bounced', data: { bounce } })),
    { type: 'email.delivered', created_at: {} }];
  const unknownTypes = ['email.future_event', '__proto__', 'constructor', 'toString', 'hasOwnProperty'];
  for (const host of ['a', 'b']) {
    assert.equal((await signedPayload(host, null, randomUUID(), false)).status, 401);
    for (const body of malformed) assert.equal((await signedPayload(host, body)).status, 400);
    for (const type of unknownTypes) {
      const response = await signedPayload(host, { type, data: { email_id: {} } });
      assert.equal(response.status, 200); assert.equal(JSON.parse(response.text).ignored, true);
    }
    assert.equal(await db.resendWebhookEvent.count(), count); assert.deepEqual(await snapshot(), initial);
  }
  const payloadBoundary = { tenants: ['a', 'b'], malformedPerTenant: malformed.length, malformedStatus: 400,
    ignoredPerTenant: unknownTypes.length, signatureBeforeParsing: true, databaseRowsUnchanged: true };
  const results = [];
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a';
    for (const scenario of ['cross-family', 'multiple-referrals', 'multiple-email']) {
      await db.campaignRecipient.updateMany({ data: { providerMessageId: null } });
      await db.referralCommunication.updateMany({ data: { providerMessageId: null } });
      const message = `synthetic-${id}-${scenario}`;
      if (scenario !== 'multiple-referrals') await db.campaignRecipient.update({ where: { id: `webhook-recipient-${id}` }, data: { providerMessageId: message } });
      if (scenario === 'multiple-email') await db.campaignRecipient.update({ where: { id: `webhook-recipient-${other}` }, data: { providerMessageId: message } });
      else await db.referralCommunication.update({ where: { id: `webhook-communication-${other}` }, data: { providerMessageId: message } });
      if (scenario === 'multiple-referrals') await db.referralCommunication.update({ where: { id: `webhook-communication-${id}` }, data: { providerMessageId: message } });
      const before = await snapshot();
      for (const type of ['email.delivered', 'email.bounced', 'email.complained']) {
        const response = await signed(id, message, type); assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.text).matched, false);
        const event = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: response.eventId } });
        assert.equal(event.processingStatus, 'UNMATCHED_AMBIGUOUS_MESSAGE_ID'); assert.equal(event.workspaceId, null);
        assert.deepEqual(await snapshot(), before);
      }
      results.push({ tenant: id, scenario, signedHttp: true, ambiguous: true, domainAndConsentRowsUnchanged: true });
    }
  }
  await db.campaignRecipient.updateMany({ data: { providerMessageId: null } });
  await db.referralCommunication.updateMany({ data: { providerMessageId: null } });
  for (const id of ['a', 'b']) for (const family of ['email', 'referral']) {
    const message = `unique-${id}-${family}`;
    if (family === 'email') await db.campaignRecipient.update({ where: { id: `webhook-recipient-${id}` }, data: { providerMessageId: message } });
    else await db.referralCommunication.update({ where: { id: `webhook-communication-${id}` }, data: { providerMessageId: message } });
    const other = id === 'a' ? 'b' : 'a';
    await db.adminUser.update({ where: { id: `u${id}` }, data: { workspaceId: other } });
    try {
    const response = await signed(other, message);
    assert.equal(response.status, 200); assert.equal(JSON.parse(response.text).matched, true);
    assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: response.eventId } })).workspaceId, id);
    const beforeReplay = await snapshot();
    const storedBeforeReplay = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: response.eventId } });
    for (const [replayedMessage, replayedType] of [[`unique-${other}-${family}`, 'email.delivered'], [message, 'email.opened']]) {
      assert.equal((await signed(other, replayedMessage, replayedType, response.eventId)).status, 409);
      assert.deepEqual(await snapshot(), beforeReplay);
      assert.deepEqual(await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: response.eventId } }), storedBeforeReplay);
    }
    const replay = await signed(id, message, 'email.delivered', response.eventId);
    assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true); assert.deepEqual(await snapshot(), beforeReplay);
    if (family === 'email') {
      const bounced = await signed(other, message, 'email.bounced', randomUUID(), true, `${id}@example.test`);
      assert.equal(bounced.status, 200);
      assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: bounced.eventId } })).workspaceId, id);
      const group = await db.communicationGroup.findUniqueOrThrow({ where: { systemKey: `BOUNCED_BACK:${id}` } });
      assert.equal(await db.communicationGroupMembership.count({ where: { groupId: group.id, clientId: `webhook-client-${id}` } }), 1);
      assert.equal(await db.auditEvent.count({ where: { workspaceId: id, action: 'CLIENT_PERMANENT_BOUNCE_RECORDED', entityId: `webhook-client-${id}` } }), 1);
    }
    results.push({ tenant: id, family, uniqueProcessed: true, duplicateNoEffect: true, changedReplayIdentity: 409, creatorTransferIgnored: true,
      ...(family === 'email' ? { bounceGroupAndAuditOwned: true } : {}) });
    } finally { await db.adminUser.update({ where: { id: `u${id}` }, data: { workspaceId: id } }); }
    const campaign = family === 'email' ? db.emailCampaign : db.referralCampaign;
    const campaignId = family === 'email' ? `webhook-email-${id}` : `webhook-referral-${id}`;
    await campaign.update({ where: { id: campaignId }, data: { workspaceId: null } });
    let rejected;
    try {
      const before = await snapshot();
      rejected = await signed(id, message);
      assert.equal(rejected.status, 503); assert.deepEqual(await snapshot(), before);
      const event = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: rejected.eventId } });
      assert.equal(event.processingStatus, 'FAILED_RETRYABLE'); assert.equal(event.workspaceId, null);
      for (const [replayedMessage, replayedType] of [[`unique-${other}-${family}`, 'email.delivered'], [message, 'email.opened']]) {
        assert.equal((await signed(other, replayedMessage, replayedType, rejected.eventId)).status, 409);
        assert.deepEqual(await snapshot(), before);
        assert.deepEqual(await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: rejected.eventId } }), event);
      }
    } finally { await campaign.update({ where: { id: campaignId }, data: { workspaceId: id } }); }
    assert.equal((await signed(id, message, 'email.delivered', rejected.eventId)).status, 200);
    assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: rejected.eventId } })).workspaceId, id);
    results.push({ tenant: id, family, unownedRejected: 503, changedRetryIdentity: 409, resolvedOwnerRetry: 200 });
  }
  const concurrentAdmission = [];
  const concurrentRetry = [];
  const waitForBlocked = async (pid, count) => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const rows = await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND ${pid} = ANY(pg_blocking_pids(pid))`;
      if (rows.length >= count) return rows;
      await delay(25);
    }
    assert.fail(`Expected ${count} actual HTTP queries blocked by the held PostgreSQL lock`);
  };
  for (const id of ['a', 'b']) for (const admission of ['first', 'retry']) {
    const eventId = randomUUID(); const message = `unique-${id}-referral`;
    if (admission === 'retry') await db.resendWebhookEvent.create({ data: {
      providerEventId: eventId, providerMessageId: message, eventType: 'email.delivered',
      normalizedStatus: 'DELIVERED', processingStatus: 'FAILED_RETRYABLE', occurredAt: new Date(), reason: 'Synthetic retry fixture',
    } });
    const before = await snapshot(); const auditCount = await db.referralAuditEvent.count();
    let pending = [];
    try {
      await db.$transaction(async processingLock => {
        await processingLock.$queryRaw`SELECT id FROM "ReferralCommunication" WHERE id=${`webhook-communication-${id}`} FOR UPDATE`;
        const [{ pid: processingPid }] = await processingLock.$queryRaw`SELECT pg_backend_pid() AS pid`;
        await db.$transaction(async admissionLock => {
          // Both handlers must read the same absent/failed event before admission writes proceed.
          await admissionLock.$executeRaw`LOCK TABLE "ResendWebhookEvent" IN SHARE MODE`;
          const [{ pid }] = await admissionLock.$queryRaw`SELECT pg_backend_pid() AS pid`;
          pending = [signed(id, message, 'email.delivered', eventId), signed(id, message, 'email.delivered', eventId)]
            .map(request => request.then(response => ({ response }), error => ({ error })));
          await waitForBlocked(pid, 2);
        }, { timeout: 15000 });
        // Hold the winner's domain write so losing admission cannot be hidden by
        // a later successful settlement overwriting its erroneous failure state.
        await waitForBlocked(processingPid, 1);
        const loser = await Promise.race(pending);
        if (loser.error) throw loser.error;
        assert.equal(loser.response.status, 503);
        const active = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: eventId } });
        assert.equal(active.processingStatus, 'PROCESSING');
        assert.deepEqual(await snapshot(), before);
      }, { timeout: 30000 });
      const outcomes = await Promise.all(pending);
      for (const outcome of outcomes) if (outcome.error) throw outcome.error;
      assert.deepEqual(outcomes.map(outcome => outcome.response.status).sort(), [200, 503]);
      assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: eventId } })).processingStatus, 'PROCESSED');
      assert.equal(await db.referralAuditEvent.count(), auditCount + 1);
      const settled = await snapshot();
      const replay = await signed(id, message, 'email.delivered', eventId);
      assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true);
      assert.deepEqual(await snapshot(), settled);
      const proof = { tenant: id, winnerProcessingBlocked: true,
        loserStatus: 503, activeEventPreserved: true, winnerStatus: 200, oneDomainAudit: true, replayNoEffect: true };
      if (admission === 'first') concurrentAdmission.push({ ...proof, twoInsertsBlocked: true });
      else concurrentRetry.push({ ...proof, twoRetryUpdatesBlocked: true });
    } finally { await Promise.all(pending); }
  }
  const partialRecovery = [];
  for (const id of ['a', 'b']) for (const type of ['email.complained', 'email.bounced']) {
    const eventId = randomUUID(); const message = `unique-${id}-email`; const email = `${id}@example.test`;
    if (type === 'email.complained') await db.marketingEmailPreference.upsert({
      where: { normalizedEmail: email }, create: { normalizedEmail: email, status: 'UNKNOWN', source: 'SYNTHETIC' },
      update: { status: 'UNKNOWN' },
    });
    const auditBefore = await db.auditEvent.count();
    let pending;
    try {
      await db.$transaction(async held => {
        if (type === 'email.complained') {
          await held.$queryRaw`SELECT id FROM "MarketingEmailPreference" WHERE "normalizedEmail"=${email} FOR UPDATE`;
        } else {
          await held.$queryRaw`SELECT id FROM "CommunicationGroup" WHERE "systemKey"=${`BOUNCED_BACK:${id}`} FOR UPDATE`;
        }
        const [{ pid }] = await held.$queryRaw`SELECT pg_backend_pid() AS pid`;
        pending = signed(id, message, type, eventId, true, email)
          .then(response => ({ response }), error => ({ error }));
        await waitForBlocked(pid, 1);
        const active = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: eventId } });
        assert.equal(active.processingStatus, 'PROCESSING'); assert.equal(active.processedAt, null);
        assert.equal(await db.campaignDeliveryEvent.count({ where: { providerEventId: eventId } }), 1);
        const beforeDuplicate = await snapshot();
        assert.equal((await signed(id, message, type, eventId, true, email)).status, 503);
        assert.deepEqual(await snapshot(), beforeDuplicate);
        // Cancel only the actual request observed blocked by this synthetic lock.
        // The runner's fixed disposable-local-database gate applies before any SQL.
        const canceled = await db.$queryRaw`SELECT pg_cancel_backend(pid) AS canceled FROM pg_stat_activity
          WHERE datname=current_database() AND ${pid} = ANY(pg_blocking_pids(pid))`;
        assert.equal(canceled.length, 1); assert.equal(canceled[0].canceled, true);
        const failure = await pending; if (failure.error) throw failure.error;
        assert.equal(failure.response.status, 503);
        assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: eventId } })).processingStatus, 'FAILED_RETRYABLE');
        assert.equal(await db.auditEvent.count(), auditBefore);
        if (type === 'email.complained') {
          assert.equal((await db.marketingEmailPreference.findUniqueOrThrow({ where: { normalizedEmail: email } })).status, 'UNKNOWN');
          assert.equal(await db.communicationSuppression.count({ where: { providerEventId: `${message}:${email}:COMPLAINT` } }), 1);
        }
      }, { timeout: 30000 });
      assert.equal((await signed(id, message, type, eventId, true, email)).status, 200);
      const complete = await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: eventId } });
      assert.equal(complete.processingStatus, 'PROCESSED'); assert.equal(complete.workspaceId, id); assert.ok(complete.processedAt);
      assert.equal(await db.campaignDeliveryEvent.count({ where: { providerEventId: eventId } }), 1);
      if (type === 'email.complained') {
        assert.equal((await db.marketingEmailPreference.findUniqueOrThrow({ where: { normalizedEmail: email } })).status, 'UNSUBSCRIBED');
        const group = await db.communicationGroup.findUniqueOrThrow({ where: { systemKey: 'MARKETING_UNSUBSCRIBED' } });
        assert.equal(await db.communicationGroupMembership.count({ where: { groupId: group.id, clientId: `webhook-client-${id}` } }), 1);
        assert.equal(await db.marketingEmailPreferenceEvent.count({ where: { messageId: message, reason: 'COMPLAINT' } }), 1);
        assert.equal(await db.communicationSuppression.count({ where: { providerEventId: `${message}:${email}:COMPLAINT` } }), 1);
      } else {
        assert.equal(await db.auditEvent.count(), auditBefore + 1);
        const group = await db.communicationGroup.findUniqueOrThrow({ where: { systemKey: `BOUNCED_BACK:${id}` } });
        assert.equal(await db.communicationGroupMembership.count({ where: { groupId: group.id, clientId: `webhook-client-${id}` } }), 1);
      }
      const settled = await snapshot(); const auditSettled = await db.auditEvent.count();
      const replay = await signed(id, message, type, eventId, true, email);
      assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true);
      assert.deepEqual(await snapshot(), settled); assert.equal(await db.auditEvent.count(), auditSettled);
      partialRecovery.push({ tenant: id, type, databaseWaitObserved: true, pendingNotTerminal: true, inFlightDuplicate: 503,
        canceledQuery: true, failureRetryable: true, retry: 200, oneDeliveryEvent: true, requiredFollowUpComplete: true, replayNoEffect: true });
    } finally { await pending; }
  }
  const unknown = await signed('a', 'no-local-message'); assert.equal(unknown.status, 200);
  assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: unknown.eventId } })).workspaceId, null);
  return { invalidSignature: 401, payloadBoundary, concurrentAdmission, concurrentRetry, partialRecovery, cases: results, providerCalls: false };
}
