import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { http } from './http.mjs';

export async function qualifyReferralConsent(origin, driver) {
  const db = driver.prisma, cases = [], email = 'referral-consent-shared@example.test', clientId = 'referral-consent-shared', claims = {};
  await db.communicationClient.create({ data: { id: clientId, hdPhotoHubUserId: 51001, firstName: 'Synthetic', lastName: 'Referral', displayName: 'Synthetic', email, normalizedEmail: email, lastSyncedAt: new Date(), workspaceMemberships: { create: [{ workspaceId: 'a' }, { workspaceId: 'b' }] } } });
  for (const id of ['a', 'b']) {
    await driver.setWorkspaceMarketingPreference(db, { workspaceId: id, userId: `u${id}`, sessionVersion: 1, email: `${id}@example.test` }, { clientId, status: 'SUBSCRIBED', confirmation: true, consentSource: 'Synthetic referral' });
    const campaignId = `referral-consent-${id}`, revisionId = `referral-consent-revision-${id}`, attemptId = `referral-consent-attempt-${id}`, leaseExpiresAt = new Date(Date.now() + 120000);
    await db.referralCampaign.create({ data: { id: campaignId, workspaceId: id, createdById: `u${id}`, internalName: 'Synthetic', publicTitle: 'Synthetic', purpose: 'Synthetic', audienceMode: 'INDIVIDUALS', audienceRules: {}, terms: 'Synthetic', landingHeadline: 'Synthetic', landingBody: 'Synthetic', landingThankYou: 'Synthetic', privacyNotice: 'Synthetic', invitationSubject: 'Synthetic', invitationBody: 'Synthetic', followUpConfiguration: {}, communicationTemplates: {} } });
    await db.referralCampaignRevision.create({ data: { id: revisionId, campaignId, revisionNumber: 1, snapshot: { workspaceId: id }, contentHash: 'synthetic' } });
    await db.referralCampaign.update({ where: { id: campaignId }, data: { status: 'LAUNCHING', approvedRevisionId: revisionId, launchRevisionId: revisionId, launchAttemptId: attemptId, launchLeaseExpiresAt: leaseExpiresAt } });
    await db.referralAdvocate.create({ data: { id: `referral-consent-advocate-${id}`, campaignId, clientId } });
    claims[id] = { workspaceId: id, storedWorkspaceId: id, campaignId, revisionId, campaignVersion: 0, attemptId, leaseExpiresAt };
  }
  const all = async () => { const rows = {}; for (const model of ['referralInvitation', 'referralLink', 'referralCommunication', 'workspaceMarketingPreferenceToken', 'marketingEmailPreferenceToken', 'marketingEmailPreference']) rows[model] = await db[model].findMany({ orderBy: { id: 'asc' } }); return rows; };
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', claim = claims[id], invitationId = `referral-consent-invitation-${id}`, seed = (id === 'a' ? 'A' : 'B').repeat(43);
    const input = { clientId, invitationId, email, tokenSeed: seed };
    const createInvitation = async tx => {
      await tx.referralInvitation.create({ data: { id: invitationId, campaignId: claim.campaignId, advocateId: `referral-consent-advocate-${id}`, approvedRevisionId: claim.revisionId, status: 'APPROVED', subject: 'Synthetic', body: 'Synthetic' } });
      await tx.referralLink.create({ data: { invitationId, campaignId: claim.campaignId, advocateId: `referral-consent-advocate-${id}`, tokenHash: `synthetic-referral-link-${id}`, code: `synthetic51-${id}`, expiresAt: new Date('2099-01-01') } });
    };
    const before = await all();
    await assert.rejects(db.$transaction(async tx => { await createInvitation(tx); await driver.createReferralPreparationPreferenceToken(tx, claim, { ...input, email: 'changed@example.test' }); }), /SOURCE_INVALID/);
    assert.deepEqual(await all(), before);
    const token = await db.$transaction(async tx => { await createInvitation(tx); return driver.createReferralPreparationPreferenceToken(tx, claim, input); });
    assert.equal(token, `v2.${seed}`);
    const minted = await all(); assert.deepEqual(minted.marketingEmailPreferenceToken, before.marketingEmailPreferenceToken); assert.deepEqual(minted.marketingEmailPreference, before.marketingEmailPreference);
    assert.equal(await db.$transaction(tx => driver.createReferralPreparationPreferenceToken(tx, claim, input)), token); assert.deepEqual(await all(), minted);
    for (const [source, fields] of [[claims[other], input], [claim, { ...input, tokenSeed: 'C'.repeat(43) }], [{ ...claim, campaignVersion: 99 }, input]]) {
      await assert.rejects(db.$transaction(tx => driver.createReferralPreparationPreferenceToken(tx, source, fields)), /SOURCE_INVALID|CLAIM_EXPIRED|RETRY_REVIEW_REQUIRED/); assert.deepEqual(await all(), minted);
    }
    const memberships = await db.communicationClientWorkspace.findMany({ where: { clientId }, orderBy: { id: 'asc' } });
    await assert.rejects(db.$transaction(async tx => { await tx.communicationClientWorkspace.deleteMany({ where: { clientId, workspaceId: id } }); await driver.createReferralPreparationPreferenceToken(tx, claim, input); }), /SOURCE_INVALID/);
    assert.deepEqual(await db.communicationClientWorkspace.findMany({ where: { clientId }, orderBy: { id: 'asc' } }), memberships); assert.deepEqual(await all(), minted);
    await assert.rejects(db.$transaction(async tx => { await tx.marketingEmailPreference.create({ data: { normalizedEmail: email, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_PROTECTED_BLOCK' } }); await driver.createReferralPreparationPreferenceToken(tx, claim, input); }), /SOURCE_INVALID/);
    assert.deepEqual(await all(), minted);
    const saved = await db.workspaceMarketingPreferenceToken.findUniqueOrThrow({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    assert.equal(saved.workspaceId, id); assert.equal(saved.campaignId, claim.campaignId); assert.equal(saved.messageId, invitationId); assert.equal(saved.source, `REFERRAL_INVITATION_REVISION_${claim.revisionId}`);
    const foreign = await db.workspaceMarketingPreference.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } });
    const reply = await http(origin, `${other}.example.test`, '/api/unsubscribe', { method: 'POST', body: { token, workspaceId: other, campaignId: 'forged' } }); assert.equal(reply.status, 200);
    const event = await db.workspaceMarketingPreferenceEvent.findFirstOrThrow({ where: { workspaceId: id, campaignId: claim.campaignId, messageId: invitationId, status: 'UNSUBSCRIBED' } }); assert.equal(event.source, 'PUBLIC_WORKSPACE_TOKEN');
    assert.deepEqual(await db.workspaceMarketingPreference.findMany({ where: { workspaceId: other }, orderBy: { id: 'asc' } }), foreign);
    // Restore only this synthetic company's consent to test protocol conflict admission.
    await driver.setWorkspaceMarketingPreference(db, { workspaceId: id, userId: `u${id}`, sessionVersion: 1, email: `${id}@example.test` }, { clientId, status: 'SUBSCRIBED', confirmation: true, consentSource: 'Synthetic protocol check' });
    const legacy = await db.marketingEmailPreference.create({ data: { normalizedEmail: `referral-marker-${id}@example.test`, source: 'SYNTHETIC_MARKER' } });
    await db.marketingEmailPreferenceToken.create({ data: { preferenceId: legacy.id, campaignId: claim.campaignId, tokenHash: `synthetic-referral-marker-${id}`, expiresAt: new Date('2099-01-01') } });
    const marked = await all(); await assert.rejects(db.$transaction(tx => driver.createReferralPreparationPreferenceToken(tx, claim, input)), /LEGACY_RETRY_REVIEW_REQUIRED/); assert.deepEqual(await all(), marked);
    cases.push({ tenant: id, rejectedInvitationAndLinkRolledBack: true, storedOwnerAndRevisionRequired: true, stableReplayHashOnly: true, changedTokenIdentityRejected: true, companyMintLeavesLegacyUntouched: true, currentMembershipAndProtectedOptOutEnforced: true, publicUnsubscribeUsesStoredInvitation: true, foreignCompanyUnchanged: true, legacyMarkerPreserved: true });
  }
  return { cases, providerCalls: false, qualification: 'actual token service in invitation/link transaction plus public HTTP consumption; full legacy processor and provider runtime not activated' };
}
