import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as core from './resend-webhook-core.ts';

function fixture(emailOwners: string[], referralOwners: string[]) {
  const key = Buffer.from('synthetic-webhook-signing-key-only');
  const events = new Map<string, Record<string, unknown>>();
  const effects: string[] = []; const lookups: string[] = [];
  const emails = emailOwners.map((workspaceId, n) => ({ id: `recipient-${n}`, clientId: `client-${n}`, email: `${workspaceId}@example.test`, campaign: { createdBy: { workspaceId } } }));
  const referrals = referralOwners.map((workspaceId, n) => ({ id: `referral-${n}`, invitationId: `invitation-${n}`, campaignId: `campaign-${n}`, submissionId: null, campaign: { createdBy: { workspaceId } } }));
  const matching = <T>(family: string, rows: T[], where: { providerMessageId: string }, take = 2) => {
    lookups.push(family); return where.providerMessageId === 'known-message' ? rows.slice(0, take) : [];
  };
  const effect = (name: string) => async () => { effects.push(name); return {}; };
  const prisma = {
    resendWebhookEvent: {
      findUnique: async ({ where }: { where: { providerEventId: string } }) => events.get(where.providerEventId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> & { providerEventId: string } }) => { events.set(data.providerEventId, { ...data }); return data; },
      update: async ({ where, data }: { where: { providerEventId: string }; data: Record<string, unknown> }) => { Object.assign(events.get(where.providerEventId)!, data); return {}; },
      updateMany: async () => { throw new Error('Unexpected retryable failure'); },
    },
    campaignRecipient: { findMany: async ({ where, take }: { where: { providerMessageId: string }; take: number }) => matching('email', emails, where, take) },
    referralCommunication: {
      findFirst: async ({ where }: { where: { providerMessageId: string } }) => matching('referral', referrals, where, 1)[0] ?? null,
      findMany: async ({ where, take }: { where: { providerMessageId: string }; take: number }) => matching('referral', referrals, where, take),
      update: effect('referral'),
    },
    referralInvitation: { update: effect('invitation') }, referralAuditEvent: { create: effect('referral-audit') },
    campaignDeliveryEvent: { upsert: effect('delivery') },
    communicationClient: { updateMany: effect('client-suppression') }, communicationSuppression: { upsert: effect('suppression') },
    emailCampaign: { findUnique: async () => { lookups.push('diagnostic-tag'); return { createdBy: { workspaceId: 'tagged-foreign-workspace' } }; } },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    'node:crypto': crypto, 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
    '@/lib/client-communications/preferences': { setMarketingPreference: effect('preference') },
    '@/lib/client-communications/bounces': { processPermanentBounce: effect('bounce') },
    '@/lib/client-communications/resend-webhook-core': core,
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../../app/api/webhooks/resend/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, Date, console: { warn() {}, error() {} }, process: { env: { RESEND_WEBHOOK_SECRET: `whsec_${key.toString('base64')}` } },
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency ${id}`); return modules[id]; } });
  async function send(options: { id?: string; message?: string | null; type?: string; invalidSignature?: boolean; timestamp?: number } = {}) {
    const id = options.id ?? 'event-1'; const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: options.type ?? 'email.delivered', data: { email_id: options.message === null ? undefined : options.message ?? 'known-message', to: ['foreign@example.test'], tags: { campaign_id: 'foreign-campaign' } } });
    const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
    return exports.POST!(new Request('https://webhook.example.test/api/webhooks/resend', { method: 'POST', body,
      headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${options.invalidSignature ? 'invalid' : signature}` } }));
  }
  return { send, events, effects, lookups };
}

for (const [label, emails, referrals] of [
  ['cross-family', ['a'], ['b']], ['multiple-referrals', [], ['a', 'b']], ['multiple-email', ['a', 'b'], []],
] as const) {
  test(`signed ${label} message identity is retained without recipient/referral/consent mutation`, async () => {
    for (const type of ['email.delivered', 'email.bounced', 'email.complained']) {
      const f = fixture([...emails], [...referrals]); const response = await f.send({ type });
      assert.equal(response.status, 200); assert.equal((await response.json()).matched, false);
      assert.equal(f.events.get('event-1')?.processingStatus, 'UNMATCHED_AMBIGUOUS_MESSAGE_ID');
      assert.equal(f.events.get('event-1')?.workspaceId, null, 'ambiguous events must not be attributed through diagnostic tags');
      assert.deepEqual(f.effects, []);
    }
  });
}

test('unique email/referral identities preserve processing and reject duplicate event replay', async () => {
  for (const owner of ['a', 'b']) for (const family of ['email', 'referral']) {
    const f = fixture(family === 'email' ? [owner] : [], family === 'referral' ? [owner] : []);
    assert.equal((await f.send()).status, 200);
    assert.equal(f.events.get('event-1')?.workspaceId, owner, 'payload tags/email do not choose a matched recipient');
    assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
    assert.deepEqual(f.effects, family === 'email' ? ['delivery'] : ['referral', 'invitation', 'referral-audit']);
    const before = [...f.effects]; const queries = [...f.lookups];
    assert.equal((await (await f.send()).json()).duplicate, true);
    assert.deepEqual(f.effects, before); assert.deepEqual(f.lookups, queries);
  }
});

test('invalid or expired signatures perform no database lookup or mutation', async () => {
  for (const options of [{ invalidSignature: true }, { timestamp: Math.floor(Date.now() / 1000) - 301 }]) {
    const f = fixture(['a'], []); assert.equal((await f.send(options)).status, 401);
    assert.equal(f.events.size, 0); assert.deepEqual(f.lookups, []); assert.deepEqual(f.effects, []);
  }
});

test('missing/unknown message IDs cannot use recipient email or tags to perform domain writes', async () => {
  for (const message of [null, 'unknown-message']) {
    const f = fixture(['a'], ['b']);
    const response = await f.send({ message }); assert.equal(response.status, 200);
    assert.equal((await response.json()).matched, false); assert.deepEqual(f.effects, []);
    assert.equal(f.events.get('event-1')?.processingStatus, message === null ? 'UNMATCHED_MISSING_MESSAGE_ID' : 'UNMATCHED_MESSAGE_ID');
  }
});
