import assert from 'node:assert/strict';

export async function qualifyConsentAnalytics(driver) {
  const db = driver.prisma, cases = [];
  for (const id of ['a', 'b']) {
    const other = id === 'a' ? 'b' : 'a', campaignId = `public-campaign-${id}`;
    // Actual public HTTP consumption already created this attributed company history.
    const initial = await db.$transaction(tx => driver.readCampaignUnsubscribeCounts(tx, id, [campaignId]));
    assert.equal(initial.get(campaignId), 1);
    const preference = await db.marketingEmailPreference.upsert({ where: { normalizedEmail: 'public-shared@example.test' }, create: { normalizedEmail: 'public-shared@example.test', status: 'UNSUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' }, update: {} });
    await db.marketingEmailPreferenceEvent.create({ data: { preferenceId: preference.id, campaignId, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' } });
    const own = await db.workspaceMarketingPreference.create({ data: { workspaceId: id, normalizedEmail: `analytics-${id}@example.test`, source: 'SYNTHETIC_ANALYTICS' } });
    const foreign = await db.workspaceMarketingPreference.create({ data: { workspaceId: other, normalizedEmail: `analytics-foreign-${id}@example.test`, source: 'SYNTHETIC_ANALYTICS' } });
    const unattributed = await db.workspaceMarketingPreference.create({ data: { workspaceId: id, normalizedEmail: `analytics-unattributed-${id}@example.test`, source: 'SYNTHETIC_ANALYTICS' } });
    await db.workspaceMarketingPreferenceEvent.createMany({ data: [
      { workspaceId: id, preferenceId: own.id, campaignId, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' },
      { workspaceId: id, preferenceId: own.id, campaignId, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' },
      { workspaceId: other, preferenceId: foreign.id, campaignId, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' },
      { workspaceId: id, preferenceId: unattributed.id, status: 'UNSUBSCRIBED', source: 'SYNTHETIC_UNATTRIBUTED' },
      { workspaceId: id, preferenceId: unattributed.id, campaignId, status: 'SUBSCRIBED', source: 'SYNTHETIC_ANALYTICS' },
    ] });
    const snapshot = async () => ({ company: await db.workspaceMarketingPreferenceEvent.findMany({ orderBy: { id: 'asc' } }), legacy: await db.marketingEmailPreferenceEvent.findMany({ orderBy: { id: 'asc' } }) });
    const before = await snapshot();
    const counts = await db.$transaction(tx => driver.readCampaignUnsubscribeCounts(tx, id, [campaignId, 'missing-campaign']));
    assert.equal(counts.get(campaignId), 2); assert.equal(counts.get('missing-campaign'), 0); assert.equal(counts.size, 2);
    assert.doesNotMatch(JSON.stringify([...counts]), /@/); assert.deepEqual(await snapshot(), before);
    cases.push({ tenant: id, actualPublicTokenEventCounted: true, legacyCompanyAndReplayDeduplicated: true, foreignAndUnattributedExcluded: true, aggregateOnly: true, readOnly: true });
  }
  return { cases, providerCalls: false, qualification: 'actual aggregate reader with disposable PostgreSQL; caller authorization separately module-tested' };
}
