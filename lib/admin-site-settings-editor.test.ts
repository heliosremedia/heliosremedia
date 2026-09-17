import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('admin settings editor values and revision use one scoped authoritative read, without public fallback', async () => {
  const defaults = { id: 'default', businessName: 'Default', googleReviewDisplayMode: 'MANUAL_ONLY',
    standardPrinciples: [], approachCards: [], headerNavigation: [], footerNavigation: [] };
  let row: Record<string, unknown> | null = { ...defaults, id: 'workspace:b', workspaceId: 'b',
    businessName: 'Company B', updatedAt: new Date('2026-09-17T00:00:00.000Z'), privateExtra: 'must-not-cross-boundary' };
  let reads = 0; let fail = false;
  const modules: Record<string, unknown> = {
    'server-only': {}, '@/lib/site-settings': { defaultSiteSettings: defaults },
    '@/lib/site-settings-ownership': { getSiteSettingsWriteTarget: async (workspaceId: string) => {
      assert.equal(workspaceId, 'b'); return { where: { workspaceId }, createIdentity: { id: 'workspace:b', workspaceId } };
    } },
    '@/lib/google-business-public': { normalizeGoogleReviewDisplayMode: (value: unknown) => value },
    '@/lib/prisma': { prisma: { siteSettings: { findUnique: async ({ where }: { where: { workspaceId: string } }) => {
      reads++; assert.equal(where.workspaceId, 'b'); if (fail) throw new Error('unavailable'); return row;
    } } } },
  };
  const exports = {} as { getAdminSiteSettings(workspaceId: string): Promise<{ settings: Record<string, unknown>; revision: Record<string, unknown> }> };
  runInNewContext(ts.transpileModule(readFileSync('lib/admin-site-settings.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const result = await exports.getAdminSiteSettings('b');
  assert.equal(reads, 1); assert.equal(result.settings.businessName, 'Company B');
  assert.equal(result.revision.updatedAt, row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null);
  assert.equal(result.revision.workspaceId, 'b'); assert.equal(result.settings.privateExtra, undefined);
  row = null;
  const creation = await exports.getAdminSiteSettings('b'); assert.equal(creation.settings.id, 'workspace:b'); assert.equal(creation.revision.updatedAt, null);
  fail = true; await assert.rejects(exports.getAdminSiteSettings('b'), /unavailable/);
});
