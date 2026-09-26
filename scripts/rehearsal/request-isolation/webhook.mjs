import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
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
  const signed = async (host, message, type = 'email.delivered', eventId = randomUUID(), valid = true) => {
    const body = { type, data: { email_id: message, to: ['foreign@example.test'], tags: { campaign_id: 'webhook-email-b' } } };
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', Buffer.from(WEBHOOK_KEY, 'base64')).update(`${eventId}.${timestamp}.${JSON.stringify(body)}`).digest('base64');
    const response = await http(origin, `${host}.example.test`, '/api/webhooks/resend', { method: 'POST', body,
      headers: { 'svix-id': eventId, 'svix-timestamp': timestamp, 'svix-signature': `v1,${valid ? signature : 'invalid'}` } });
    return { ...response, eventId };
  };
  const initial = await snapshot(); const count = await db.resendWebhookEvent.count();
  assert.equal((await signed('a', 'unknown', 'email.delivered', randomUUID(), false)).status, 401);
  assert.equal(await db.resendWebhookEvent.count(), count); assert.deepEqual(await snapshot(), initial);
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
    const response = await signed(id === 'a' ? 'b' : 'a', message);
    assert.equal(response.status, 200); assert.equal(JSON.parse(response.text).matched, true);
    assert.equal((await db.resendWebhookEvent.findUniqueOrThrow({ where: { providerEventId: response.eventId } })).workspaceId, id);
    const beforeReplay = await snapshot();
    const replay = await signed(id, message, 'email.delivered', response.eventId);
    assert.equal(replay.status, 200); assert.equal(JSON.parse(replay.text).duplicate, true); assert.deepEqual(await snapshot(), beforeReplay);
    results.push({ tenant: id, family, uniqueProcessed: true, duplicateNoEffect: true });
  }
  return { invalidSignature: 401, cases: results, providerCalls: false };
}
