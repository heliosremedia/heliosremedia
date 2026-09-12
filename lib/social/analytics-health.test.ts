import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

test('analytics health SQL preserves observation order, successful history, company scope and transactional rollback', async () => {
  const db = new PGlite();
  type Observation = { connectionId: string; workspaceId: string; attemptedAt: Date; succeeded: boolean; category?: string; message?: string };
  const exports: { recordAnalyticsHealth?: (tx: unknown, observation: Observation) => Promise<void> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./analytics-health.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (id: string) => { assert.equal(id, 'server-only'); return {}; } });
  try {
    await db.exec(`
      SET TIME ZONE 'UTC';
      CREATE TYPE "SocialMetricAvailability" AS ENUM ('AVAILABLE','PERMISSION_REQUIRED','CONNECTION_REQUIRED','REFRESH_FAILED');
      CREATE TABLE "SocialConnection" (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL,
        "analyticsPermissionState" "SocialMetricAvailability" NOT NULL DEFAULT 'CONNECTION_REQUIRED',
        "analyticsLastAttemptAt" TIMESTAMP(3), "analyticsLastSuccessfulAt" TIMESTAMP(3),
        "analyticsFailureCount" INT NOT NULL DEFAULT 0, "analyticsError" TEXT, "updatedAt" TIMESTAMP(3));
      INSERT INTO "SocialConnection" (id,"workspaceId") VALUES ('connection-a','a'), ('connection-b','b');
    `);
    // Compare stored UTC wall-clock values without PGlite's timestamp-without-
    // timezone decoder interpreting them in the Node runner's local timezone.
    const row = async (id = 'connection-a') => (await db.query(`SELECT *,
      "analyticsLastAttemptAt"::text AS "analyticsLastAttemptAt",
      "analyticsLastSuccessfulAt"::text AS "analyticsLastSuccessfulAt"
      FROM "SocialConnection" WHERE id=$1`, [id])).rows[0] as Record<string, unknown>;
    const foreignBefore = await row('connection-b');
    const at = (day: number) => new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`);
    const record = async (day: number, succeeded: boolean, options: { category?: string; connectionId?: string; workspaceId?: string; failAfterWrite?: boolean } = {}) => db.transaction(async sql => {
      await exports.recordAnalyticsHealth!({ $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
        const query = parts.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
        // Use an explicit UTC database session and ISO Date parameters rather
        // than inheriting this isolated runner's local timezone configuration.
        return (await sql.query(query, values.map(value => value instanceof Date ? value.toISOString() : value))).affectedRows;
      } }, { connectionId: options.connectionId ?? 'connection-a', workspaceId: options.workspaceId ?? 'a',
        attemptedAt: at(day), succeeded, category: options.category ?? 'TRANSIENT', message: `Failure ${day}` });
      if (options.failAfterWrite) throw new Error('Synthetic rollback');
    });
    const date = (value: unknown) => new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();

    await record(4, false, { category: 'PERMISSION' });
    let state = await row();
    assert.equal(state.analyticsPermissionState, 'PERMISSION_REQUIRED');
    assert.equal(state.analyticsFailureCount, 1);
    assert.equal(date(state.analyticsLastAttemptAt), at(4).toISOString());

    // Older success records success evidence without concealing newer failure.
    await record(2, true);
    state = await row();
    assert.equal(state.analyticsPermissionState, 'PERMISSION_REQUIRED');
    assert.equal(state.analyticsError, 'Failure 4'); assert.equal(state.analyticsFailureCount, 1);
    assert.equal(date(state.analyticsLastSuccessfulAt), at(2).toISOString());
    const beforeOlder = state;
    await record(1, true); await record(3, false); await record(4, false);
    assert.deepEqual(await row(), beforeOlder);

    await record(5, true);
    state = await row();
    assert.equal(state.analyticsPermissionState, 'AVAILABLE');
    assert.equal(state.analyticsFailureCount, 0); assert.equal(state.analyticsError, null);
    assert.equal(date(state.analyticsLastSuccessfulAt), at(5).toISOString());
    await record(4, false); await record(5, false);
    assert.deepEqual(await row(), state);

    await record(6, false, { category: 'AUTHENTICATION' });
    assert.equal((await row()).analyticsPermissionState, 'CONNECTION_REQUIRED');
    await record(7, false);
    state = await row();
    assert.equal(state.analyticsPermissionState, 'REFRESH_FAILED');
    assert.equal(state.analyticsFailureCount, 2);
    assert.equal(date(state.analyticsLastSuccessfulAt), at(5).toISOString());
    await assert.rejects(record(8, true, { failAfterWrite: true }), /Synthetic rollback/);
    assert.deepEqual(await row(), state);

    await record(9, true, { workspaceId: 'b' });
    await record(9, false, { connectionId: 'connection-b' });
    await record(9, true, { connectionId: 'missing' });
    assert.deepEqual(await row(), state);
    assert.deepEqual(await row('connection-b'), foreignBefore);
  } finally { await db.close(); }
});
