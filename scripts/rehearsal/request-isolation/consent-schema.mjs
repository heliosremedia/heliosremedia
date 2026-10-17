import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { requireDatabase } from './safety.mjs';

export async function qualifyConsentSchema(driver) {
  const db = driver.prisma;
  const client = new pg.Client({ connectionString: requireDatabase(process.env.PACKET19_DATABASE_URL) });
  const models = ['workspaceMarketingPreference', 'workspaceMarketingPreferenceEvent', 'workspaceMarketingPreferenceToken'];
  for (const model of models) assert.equal(await db[model].count(), 0, 'Only empty newly added tables may be reconstructed');
  const legacy = await db.marketingEmailPreference.create({ data: { normalizedEmail: 'legacy-consent@example.test', status: 'UNSUBSCRIBED', source: 'SYNTHETIC_LEGACY' } });
  await db.marketingEmailPreferenceEvent.create({ data: { preferenceId: legacy.id, previousStatus: 'SUBSCRIBED', status: 'UNSUBSCRIBED', source: 'SYNTHETIC_LEGACY' } });
  await db.marketingEmailPreferenceToken.create({ data: { preferenceId: legacy.id, tokenHash: createHash('sha256').update('synthetic-legacy-token').digest('hex'), expiresAt: new Date('2099-01-01') } });
  const legacySnapshot = async () => {
    const rows = {};
    for (const model of ['marketingEmailPreference', 'marketingEmailPreferenceEvent', 'marketingEmailPreferenceToken', 'communicationSuppression', 'communicationClient', 'communicationGroupMembership']) rows[model] = await db[model].findMany({ orderBy: { id: 'asc' } });
    return rows;
  };
  const before = await legacySnapshot();
  const schemaBefore = await driver.schemaFingerprint(), indexesBefore = await driver.schemaIndexFingerprint();
  await client.connect();
  try {
    const constraints = async () => (await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('"WorkspaceMarketingPreference"'::regclass,'"WorkspaceMarketingPreferenceEvent"'::regclass,'"WorkspaceMarketingPreferenceToken"'::regclass) ORDER BY conname`)).rows;
    const constraintsBefore = await constraints();
    await client.query('BEGIN; DROP TABLE "WorkspaceMarketingPreferenceToken"; DROP TABLE "WorkspaceMarketingPreferenceEvent"; DROP TABLE "WorkspaceMarketingPreference"; DROP TYPE "WorkspaceMarketingPreferenceStatus"; COMMIT;');
    const migration = await readFile(new URL('../../../prisma/migrations/20261004180000_workspace_marketing_consent_expand/migration.sql', import.meta.url), 'utf8');
    await client.query(migration);
    await client.query(`INSERT INTO "WorkspaceMarketingPreference" (id,"workspaceId","normalizedEmail",source,"updatedAt") VALUES ('attribution-pref','a','old-attribution@example.test','SYNTHETIC',NOW())`);
    await client.query(`INSERT INTO "WorkspaceMarketingPreferenceEvent" (id,"workspaceId","preferenceId",status,source) VALUES ('attribution-event','a','attribution-pref','UNSUBSCRIBED','SYNTHETIC')`);
    const historical = (await client.query(`SELECT * FROM "WorkspaceMarketingPreferenceEvent" WHERE id='attribution-event'`)).rows[0];
    await client.query(await readFile(new URL('../../../prisma/migrations/20261006040000_workspace_consent_event_attribution/migration.sql', import.meta.url), 'utf8'));
    const expanded = (await client.query(`SELECT * FROM "WorkspaceMarketingPreferenceEvent" WHERE id='attribution-event'`)).rows[0];
    assert.deepEqual(expanded, { ...historical, campaignId: null, messageId: null });
    await client.query(`DELETE FROM "WorkspaceMarketingPreferenceEvent" WHERE id='attribution-event'; DELETE FROM "WorkspaceMarketingPreference" WHERE id='attribution-pref'`);
    assert.deepEqual(await constraints(), constraintsBefore);
    assert.equal(await driver.schemaFingerprint(), schemaBefore); assert.equal(await driver.schemaIndexFingerprint(), indexesBefore);
    assert.deepEqual(await legacySnapshot(), before);
    for (const id of ['a', 'b']) await db.workspaceMarketingPreference.create({ data: { id: `consent-pref-${id}`, workspaceId: id, normalizedEmail: 'same-address@example.test', status: id === 'a' ? 'UNSUBSCRIBED' : 'SUBSCRIBED', source: 'SYNTHETIC' } });
    const cases = [];
    for (const id of ['a', 'b']) {
      const other = id === 'a' ? 'b' : 'a'; const preferenceId = `consent-pref-${id}`;
      const foreignBefore = await db.workspaceMarketingPreference.findUniqueOrThrow({ where: { id: `consent-pref-${other}` } });
      await assert.rejects(client.query('INSERT INTO "WorkspaceMarketingPreferenceEvent" ("id","workspaceId","preferenceId","status","source") VALUES ($1,$2,$3,$4,$5)', [`bad-event-${id}`,id,`consent-pref-${other}`,'UNSUBSCRIBED','SYNTHETIC']), { code: '23503' });
      await assert.rejects(client.query('INSERT INTO "WorkspaceMarketingPreferenceToken" ("id","workspaceId","preferenceId","tokenHash","source","expiresAt") VALUES ($1,$2,$3,$4,$5,$6)', [`bad-token-${id}`,id,`consent-pref-${other}`,`bad-hash-${id}`,'SYNTHETIC',new Date('2099-01-01')]), { code: '23503' });
      await assert.rejects(client.query('INSERT INTO "WorkspaceMarketingPreference" ("id","workspaceId","normalizedEmail","source","updatedAt") VALUES ($1,$2,$3,$4,NOW())', [`duplicate-${id}`,id,'same-address@example.test','SYNTHETIC']), { code: '23505' });
      await db.workspaceMarketingPreferenceEvent.create({ data: { workspaceId: id, preferenceId, status: 'UNSUBSCRIBED', source: 'SYNTHETIC' } });
      await db.workspaceMarketingPreferenceToken.create({ data: { workspaceId: id, preferenceId, tokenHash: createHash('sha256').update(`synthetic-token-${id}`).digest('hex'), source: 'SYNTHETIC', expiresAt: new Date('2099-01-01') } });
      await assert.rejects(client.query('UPDATE "WorkspaceMarketingPreference" SET "workspaceId"=$1,"normalizedEmail"=$2 WHERE "id"=$3', [other,`moved-${id}@example.test`,preferenceId]), { code: '23503' });
      await assert.rejects(client.query('DELETE FROM "WorkspaceMarketingPreference" WHERE "id"=$1', [preferenceId]), { code: '23503' });
      await db.workspaceMarketingPreference.update({ where: { workspaceId_id: { workspaceId: id, id: preferenceId } }, data: { reason: `ONLY_${id}` } });
      assert.deepEqual(await db.workspaceMarketingPreference.findUniqueOrThrow({ where: { id: `consent-pref-${other}` } }), foreignBefore);
      assert.equal(await db.workspaceMarketingPreferenceEvent.count({ where: { workspaceId: id } }), 1);
      assert.equal(await db.workspaceMarketingPreferenceToken.count({ where: { workspaceId: id } }), 1);
      cases.push({ tenant: id, foreignHistoryRejected: true, foreignTokenRejected: true, sameCompanyDuplicateRejected: true, ownedHistoryAndTokenCreated: true, ownershipTransferAndParentDeletionRejected: true, foreignPreferenceUnchanged: true });
    }
    assert.deepEqual(await legacySnapshot(), before);
    return { cases, sameAddressSeparateCompanyPreferences: true, checkedInMigrationApplied: true, historicalAttributionRemainsNull: true, declaredColumnsIndexesAndConstraintsMatched: true,
      legacyPreferencesHistoryTokensAndSafetyUnchanged: true, applicationReadersActivated: false, syntheticDatabaseOnly: true };
  } finally { await client.end(); }
}
