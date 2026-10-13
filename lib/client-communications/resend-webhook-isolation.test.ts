import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as core from './resend-webhook-core.ts';

function fixture(emailOwners: Array<string | null>, referralOwners: Array<string | null>, options: { creator?: string; tenantMode?: boolean; workspaces?: string[]; afterTerminalWrite?: () => void; beforeEffect?: (name: string) => Promise<void> } = {}) {
  const key = Buffer.from('synthetic-webhook-signing-key-only');
  const events = new Map<string, Record<string, unknown>>();
  const effects: string[] = []; const lookups: string[] = []; const failureWrites: string[] = [];
  const emails = emailOwners.map((workspaceId, n) => ({ id: `recipient-${n}`, clientId: `client-${n}`, email: `${workspaceId}@example.test`, campaign: { workspaceId, createdBy: { workspaceId: options.creator ?? workspaceId } } }));
  const referrals = referralOwners.map((workspaceId, n) => ({ id: `referral-${n}`, invitationId: `invitation-${n}`, campaignId: `campaign-${n}`, submissionId: null, campaign: { workspaceId, createdBy: { workspaceId: options.creator ?? workspaceId } } }));
  const matching = <T>(family: string, rows: T[], where: { providerMessageId: string }, take = 2) => {
    lookups.push(family); return where.providerMessageId === 'known-message' ? rows.slice(0, take) : [];
  };
  const effect = (name: string) => async () => { effects.push(name); await options.beforeEffect?.(name); return {}; };
  const prisma = {
    workspace: { findMany: async () => (options.workspaces ?? ['a', 'b']).map(id => ({ id })) },
    resendWebhookEvent: {
      findUnique: async ({ where }: { where: { providerEventId: string } }) => { lookups.push('event'); const row = events.get(where.providerEventId); return row ? { ...row } : null; },
      create: async ({ data }: { data: Record<string, unknown> & { providerEventId: string } }) => { if (events.has(data.providerEventId)) throw Object.assign(new Error('unique event'), { code: 'P2002' }); events.set(data.providerEventId, { ...data }); return data; },
      update: async ({ where, data }: { where: { providerEventId: string }; data: Record<string, unknown> }) => { Object.assign(events.get(where.providerEventId)!, data); if (data.processingStatus === "PROCESSED") options.afterTerminalWrite?.(); return {}; },
      updateMany: async ({ where, data }: { where: { providerEventId: string } & Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = events.get(where.providerEventId);
        if (!row || Object.entries(where).some(([key, value]) => row[key] !== value)) return { count: 0 };
        if (data.processingStatus === 'FAILED_RETRYABLE') failureWrites.push(where.providerEventId);
        Object.assign(row, data); return { count: 1 };
      },
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
    $transaction: async (operations: Promise<unknown>[] | ((transaction: unknown) => Promise<unknown>)): Promise<unknown> => typeof operations === "function" ? operations(prisma) : Promise.all(operations),
  };
  const ownership: Record<string, unknown> = {};
  const ownershipModules: Record<string, unknown> = { 'server-only': {}, '@/lib/prisma': { prisma }, '@/lib/auth/session': {},
    '@/lib/workspace-context-core': { tenantContextEnabled: () => options.tenantMode ?? true } };
  runInNewContext(ts.transpileModule(readFileSync(new URL('./campaign-ownership.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: ownership, require: (id: string) => { assert.ok(id in ownershipModules); return ownershipModules[id]; } });
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    'node:crypto': crypto, 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma },
    '@/lib/client-communications/preferences': { setMarketingPreference: effect('preference') },
    '@/lib/client-communications/bounces': { processPermanentBounce: effect('bounce') },
    '@/lib/client-communications/resend-webhook-core': core,
    '@/lib/client-communications/campaign-ownership': ownership,
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../../app/api/webhooks/resend/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, Date, console: { warn() {}, error() {} }, process: { env: { RESEND_WEBHOOK_SECRET: `whsec_${key.toString('base64')}` } },
    require: (id: string) => { assert.ok(id in modules, `Unexpected dependency ${id}`); return modules[id]; } });
  async function sendRaw(body: string, options: { id?: string; invalidSignature?: boolean; timestamp?: number } = {}) {
    const id = options.id ?? 'event-1'; const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
    return exports.POST!(new Request('https://webhook.example.test/api/webhooks/resend', { method: 'POST', body,
      headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${options.invalidSignature ? 'invalid' : signature}` } }));
  }
  async function send(options: { id?: string; message?: string | null; type?: string; invalidSignature?: boolean; timestamp?: number } = {}) {
    const body = JSON.stringify({ type: options.type ?? 'email.delivered', data: { email_id: options.message === null ? undefined : options.message ?? 'known-message', to: ['foreign@example.test'], tags: { campaign_id: 'foreign-campaign' } } });
    return sendRaw(body, options);
  }
  return { send, sendRaw, events, effects, lookups, failureWrites };
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
    assert.deepEqual(f.effects, before); assert.deepEqual(f.lookups, [...queries, 'event']);
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


test('stored campaign owner survives creator transfer for email and referral events', async () => {
  for (const owner of ['a', 'b']) for (const family of ['email', 'referral']) {
    const f = fixture(family === 'email' ? [owner] : [], family === 'referral' ? [owner] : [], { creator: owner === 'a' ? 'b' : 'a' });
    assert.equal((await f.send()).status, 200);
    assert.equal(f.events.get('event-1')?.workspaceId, owner);
  }
});

test('unowned multitenant messages remain retryable without domain writes; legacy singleton is preserved', async () => {
  for (const family of ['email', 'referral']) {
    for (const tenantMode of [true, false]) {
      const f = fixture(family === 'email' ? [null] : [], family === 'referral' ? [null] : [], { creator: 'a', tenantMode });
      assert.equal((await f.send()).status, 503); assert.deepEqual(f.effects, []);
      assert.equal(f.events.get('event-1')?.processingStatus, 'FAILED_RETRYABLE');
    }
    const legacy = fixture(family === 'email' ? [null] : [], family === 'referral' ? [null] : [], { creator: 'moved-actor', tenantMode: false, workspaces: ['a'] });
    assert.equal((await legacy.send()).status, 200); assert.equal(legacy.events.get('event-1')?.workspaceId, 'a');
  }
});

test('unmatched signed tags do not grant tenant ownership of diagnostic records', async () => {
  const f = fixture([], []); assert.equal((await f.send({ message: 'unknown' })).status, 200);
  assert.equal(f.events.get('event-1')?.workspaceId, null);
  assert.ok(!f.lookups.includes('diagnostic-tag'));
});


test('signed malformed envelopes and consumed fields reject400 before any database access', async () => {
  const payloads = [null, [], true, 7, 'text', {}, { type: [] },
    ...[true, 42, 'text', []].map(data => ({ type: 'email.delivered', data })),
    ...[42, {}, []].map(email_id => ({ type: 'email.delivered', data: { email_id } })),
    ...[true, 42, 'text', []].map(click => ({ type: 'email.clicked', data: { click } })),
    { type: 'email.clicked', data: { click: { link: {} } } },
    ...[true, 42, 'text', []].map(bounce => ({ type: 'email.bounced', data: { bounce } })),
    { type: 'email.bounced', data: { bounce: { type: 42 } } },
    { type: 'email.bounced', data: { bounce: { subtype: [] } } },
    { type: 'email.bounced', data: { bounce: { message: {} } } },
    { type: 'email.delivered', created_at: {} }];
  for (const body of ['{', ...payloads.map(payload => JSON.stringify(payload))]) {
    const f = fixture(['a'], []); const response = await f.sendRaw(body);
    assert.equal(response.status, 400, body);
    assert.equal(f.events.size, 0); assert.deepEqual(f.lookups, []); assert.deepEqual(f.effects, []);
  }
});

test('unknown and inherited event names are ignored without database access', async () => {
  for (const type of ['email.future_event', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const f = fixture(['a'], []);
    const response = await f.sendRaw(JSON.stringify({ type, data: { email_id: {} } }));
    assert.equal(response.status, 200); assert.equal((await response.json()).ignored, true);
    assert.equal(f.events.size, 0); assert.deepEqual(f.lookups, []); assert.deepEqual(f.effects, []);
  }
});

test('signature admission precedes parsing and nullable optional fields keep missing-ID behavior', async () => {
  const unsigned = fixture(['a'], []);
  assert.equal((await unsigned.sendRaw('null', { invalidSignature: true })).status, 401);
  assert.deepEqual(unsigned.lookups, []);
  for (const data of [null, {}, { email_id: null, click: null, bounce: null }, { email_id: '', click: { link: null }, bounce: { type: null, subtype: null, message: null } }]) {
    const f = fixture([], []); assert.equal((await f.sendRaw(JSON.stringify({ type: 'email.delivered', created_at: null, data }))).status, 200);
    assert.equal(f.events.get('event-1')?.processingStatus, 'UNMATCHED_MISSING_MESSAGE_ID'); assert.deepEqual(f.effects, []);
  }
});


test('event IDs retain their original message and event-type identity on replay', async () => {
  for (const owner of ['a', 'b']) for (const processingStatus of ['FAILED_RETRYABLE', 'PROCESSING', 'PROCESSED']) {
    for (const original of [
      { providerMessageId: 'different-message', eventType: 'email.delivered' },
      { providerMessageId: null, eventType: 'email.delivered' },
      { providerMessageId: 'known-message', eventType: 'email.bounced' },
    ]) {
      const f = fixture([owner], []);
      f.events.set('event-1', { providerEventId: 'event-1', ...original, processingStatus, workspaceId: owner === 'a' ? 'b' : 'a' });
      const before = JSON.stringify([...f.events]);
      assert.equal((await f.send()).status, 409);
      assert.equal(JSON.stringify([...f.events]), before); assert.deepEqual(f.effects, []);
      assert.deepEqual(f.lookups, ['event']);
    }
  }
});

test('an unchanged failed event identity can still retry', async () => {
  const f = fixture(['a'], []);
  f.events.set('event-1', { providerEventId: 'event-1', providerMessageId: 'known-message', eventType: 'email.delivered', processingStatus: 'FAILED_RETRYABLE' });
  assert.equal((await f.send({ message: ' known-message ' })).status, 200);
  assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
  assert.deepEqual(f.effects, ['delivery']);
});


test('a concurrent first-insert loser cannot mark the winning event failed', async () => {
  for (const owner of ['a', 'b']) {
    const f = fixture([owner], []);
    const responses = await Promise.all([f.send(), f.send()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 503]);
    assert.deepEqual(f.failureWrites, []);
    assert.deepEqual(f.effects, ['delivery']);
    assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
    assert.equal((await (await f.send()).json()).duplicate, true);
    assert.deepEqual(f.effects, ['delivery']);
  }
});

test('an admitted processing failure remains retryable', async () => {
  const f = fixture([null], []);
  assert.equal((await f.send()).status, 503);
  assert.deepEqual(f.failureWrites, ['event-1']);
  assert.equal(f.events.get('event-1')?.processingStatus, 'FAILED_RETRYABLE');
  assert.deepEqual(f.effects, []);
});


test('concurrent failed-event retries admit only one processor', async () => {
  for (const owner of ['a', 'b']) for (const family of ['email', 'referral']) {
    const f = fixture(family === 'email' ? [owner] : [], family === 'referral' ? [owner] : []);
    f.events.set('event-1', { providerEventId: 'event-1', providerMessageId: 'known-message', eventType: 'email.delivered', processingStatus: 'FAILED_RETRYABLE' });
    const responses = await Promise.all([f.send(), f.send()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 503]);
    assert.deepEqual(f.failureWrites, []);
    assert.deepEqual(f.effects, family === 'email' ? ['delivery'] : ['referral', 'invitation', 'referral-audit']);
    assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
    assert.equal((await (await f.send()).json()).duplicate, true);
  }
});


test('follow-up failures never expose completed events or acknowledge in-flight duplicates', async () => {
  for (const owner of ['a', 'b']) for (const type of ['email.complained', 'email.bounced']) {
    let enter!: () => void; let reject!: (error: Error) => void;
    const entered = new Promise<void>(resolve => { enter = resolve; });
    const held = new Promise<void>((_resolve, fail) => { reject = fail; });
    let pause = true;
    const f = fixture([owner], [], { beforeEffect: async name => {
      if (pause && name === (type === 'email.complained' ? 'preference' : 'bounce')) { enter(); await held; }
    } });
    const pending = f.send({ type });
    await entered;
    try {
      assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSING');
      assert.equal(f.events.get('event-1')?.processedAt, null);
      const before = [...f.effects];
      assert.equal((await f.send({ type })).status, 503);
      assert.deepEqual(f.effects, before);
    } finally { reject(new Error('Synthetic follow-up failure')); }
    assert.equal((await pending).status, 503);
    assert.equal(f.events.get('event-1')?.processingStatus, 'FAILED_RETRYABLE');
    assert.deepEqual(f.failureWrites, ['event-1']);
    if (type === 'email.complained') {
      pause = false;
      assert.equal((await f.send({ type })).status, 200);
      assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
      const before = [...f.effects];
      assert.equal((await (await f.send({ type })).json()).duplicate, true);
      assert.deepEqual(f.effects, before);
    }
  }
});


test('an observed terminal write is not downgraded by a later acknowledgement error', async () => {
  for (const owner of ['a', 'b']) {
    const f = fixture([owner], [], { afterTerminalWrite: () => { throw new Error('synthetic acknowledgement failure'); } });
    assert.equal((await f.send({ type: 'email.complained' })).status, 503);
    assert.equal(f.events.get('event-1')?.processingStatus, 'PROCESSED');
    assert.deepEqual(f.failureWrites, []);
    const before = [...f.effects];
    assert.equal((await (await f.send({ type: 'email.complained' })).json()).duplicate, true);
    assert.deepEqual(f.effects, before);
  }
});
