import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { summarizeNewsletterCampaign } from "./analytics-core.ts";

function load<T>(path: string, modules: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return exports as T;
}

test("newsletter analytics excludes foreign editions and inconsistent campaign ownership, including previous editions", async () => {
  let allowed = true, reads = 0;
  const row = (editionId: string, owner: string, campaignOwner: string, date: string) => ({
    editionId, campaignId: `campaign-${editionId}`, eligibleCount: 1,
    edition: { seriesId: `series-${owner}`, workspaceId: owner, intendedSendAt: new Date(date) },
    campaign: { workspaceId: campaignOwner, recipients: [{ id: `recipient-${editionId}`, status: 'SENT', events: [{ eventType: 'DELIVERED' }, { eventType: 'CLICKED', linkUrl: `https://${owner}.invalid` }] }] },
  });
  const rows = [row('current-a', 'a', 'a', '2026-09-12'), row('foreign-b', 'b', 'b', '2026-09-12'), row('corrupt', 'a', 'b', '2026-09-11'), row('previous-a', 'a', 'a', '2026-09-10')];
  const preferenceQueries: string[][] = [];
  const api = load<{ getNewsletterAnalytics: (id: string, actor: unknown) => Promise<ReturnType<typeof summarizeNewsletterCampaign> & { previous: unknown } | null> }>('./analytics.ts', {
    'server-only': {}, './analytics-core': { summarizeNewsletterCampaign },
    '@/lib/blog-ownership': { getContentOwnershipScope: async (workspaceId: string) => ({ workspaceId }) },
    '@/lib/workspace-write-access': { requireLockedWorkspaceAdministrator: async (_tx: unknown, actor: { workspaceId: string }) => { assert.equal(actor.workspaceId, 'a'); if (!allowed) throw new Error('WORKSPACE_WRITE_FORBIDDEN'); } },
    '@/lib/prisma': { prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return fn({
        newsletterDelivery: { findFirst: async ({ where, select }: { where: { editionId?: string; edition: { series: { workspaceId: string }; seriesId?: string; intendedSendAt?: { lt: Date } }; campaign: { workspaceId: string } }; select: { campaign: { select: { recipients: { select: Record<string, unknown> } } } } }) => {
          assert.equal(allowed, true); reads++;
          assert.equal(where.edition.series.workspaceId, 'a'); assert.equal(where.campaign.workspaceId, 'a');
          assert.equal(select.campaign.select.recipients.select.email, undefined);
          return rows.find(item => item.edition.workspaceId === where.edition.series.workspaceId && item.campaign.workspaceId === where.campaign.workspaceId
            && (where.editionId ? item.editionId === where.editionId : item.edition.seriesId === where.edition.seriesId && item.edition.intendedSendAt < where.edition.intendedSendAt!.lt)) ?? null;
        } },
        marketingEmailPreferenceEvent: { findMany: async ({ where }: { where: { campaignId: { in: string[] }; status: string } }) => {
          assert.equal(where.status, 'UNSUBSCRIBED'); preferenceQueries.push(Array.from(where.campaignId.in));
          return where.campaignId.in.flatMap(campaignId => [{ campaignId, preferenceId: 'preference' }, { campaignId, preferenceId: 'preference' }]);
        } },
      });
    } } },
  });
  const actor = { workspaceId: 'a', userId: 'admin', sessionVersion: 1 };
  assert.equal(await api.getNewsletterAnalytics('foreign-b', actor), null);
  assert.equal(await api.getNewsletterAnalytics('corrupt', actor), null);
  assert.equal(preferenceQueries.length, 0);
  const result = await api.getNewsletterAnalytics('current-a', actor);
  assert.equal(result?.delivered, 1); assert.equal(result?.unsubscribes, 1); assert.ok(result?.previous);
  assert.deepEqual(preferenceQueries, [['campaign-current-a', 'campaign-previous-a']]);
  assert.equal(JSON.stringify(result).includes('b.invalid'), false);
  allowed = false; const before = reads;
  await assert.rejects(api.getNewsletterAnalytics('current-a', actor), /FORBIDDEN/); assert.equal(reads, before);
});

test("edition server page enforces module containment and passes only trusted actor fields to analytics", async () => {
  let allowed = true;
  const session = { userId: 'admin', workspaceId: 'a', sessionVersion: 7, email: 'private@example.invalid' };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const page = load<{ default: (input: { params: Promise<{ editionId: string }> }) => Promise<{ props: { children: Array<{ type: string; props: { actor?: unknown } }> } }> }>('../../app/admin/newsletter-studio/editions/[editionId]/page.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/lib/newsletters/api': { requireNewsletterAdministrator: async () => allowed ? session : null },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '../../components/EditionEditor': { default: 'Editor' }, '../../components/NewsletterAnalytics': { default: 'Analytics' },
    '../../components/DeliveryReviewPanel': { default: 'Delivery' }, '../../components/GenerationRecoveryPanel': { default: 'Generation' },
  });
  const result = await page.default({ params: Promise.resolve({ editionId: 'edition' }) });
  const actor = result.props.children.find(child => child.type === 'Analytics')?.props.actor;
  assert.equal(JSON.stringify(actor), JSON.stringify({ userId: 'admin', workspaceId: 'a', sessionVersion: 7 }));
  allowed = false; await assert.rejects(page.default({ params: Promise.resolve({ editionId: 'foreign' }) }), /redirect/);
});
