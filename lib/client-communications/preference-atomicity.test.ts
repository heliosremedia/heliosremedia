import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function fixture() {
  type State = { status: string; history: string[]; subscribed: boolean; membership: boolean };
  let state: State = { status: 'UNKNOWN', history: [], subscribed: false, membership: false };
  let fail = false;
  const delegates = (get: () => State) => ({
    marketingEmailPreference: {
      findUnique: async () => ({ id: 'preference', status: get().status }),
      upsert: async ({ update }: { update: { status: string } }) => { get().status = update.status; return { id: 'preference', status: update.status }; },
    },
    marketingEmailPreferenceEvent: { create: async ({ data }: { data: { status: string } }) => { get().history.push(data.status); } },
    communicationClient: {
      findMany: async () => [{ id: 'client' }],
      updateMany: async ({ data }: { data: { emailSubscribed: boolean } }) => { get().subscribed = data.emailSubscribed; },
    },
    communicationGroup: { upsert: async () => ({ id: 'group' }) },
    communicationGroupMembership: {
      createMany: async () => { if (fail) throw new Error('group mutation failed'); get().membership = true; },
      deleteMany: async () => { if (fail) throw new Error('group mutation failed'); get().membership = false; },
    },
  });
  const prisma = { ...delegates(() => state), $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
    const pending = structuredClone(state);
    const result = await run(delegates(() => pending));
    state = pending;
    return result;
  } };
  const exports: { setMarketingPreference?: (input: { email: string; status: string; source: string }) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = { 'server-only': {}, 'node:crypto': {}, '@/lib/prisma': { prisma },
    './normalization': { normalizeEmail: (email: string) => email }, './preference-rules': {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL('./preferences.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { snapshot: () => structuredClone(state), fail: (value: boolean) => { fail = value; },
    set: (status: string) => exports.setMarketingPreference!({ email: 'synthetic@example.test', status, source: 'TEST' }) };
}

for (const status of ['UNSUBSCRIBED', 'SUBSCRIBED']) test(`group failure rolls back ${status} preference and history before retry`, async () => {
  const f = fixture();
  if (status === 'SUBSCRIBED') await f.set('UNSUBSCRIBED');
  const before = f.snapshot();
  f.fail(true);
  await assert.rejects(f.set(status), /group mutation failed/);
  assert.deepEqual(f.snapshot(), before);
  f.fail(false);
  await f.set(status);
  assert.deepEqual(f.snapshot(), { status, history: [...before.history, status], subscribed: status === 'SUBSCRIBED', membership: status === 'UNSUBSCRIBED' });
});
