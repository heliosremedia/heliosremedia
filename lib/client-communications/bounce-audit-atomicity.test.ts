import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as core from './bounce-core.ts';

for (const tenant of ['a', 'b']) test(`bounce audit failure rolls back membership and completion for ${tenant}`, async () => {
  type State = { status: string | null; member: boolean; audits: Array<Record<string, unknown>> };
  let state: State = { status: null, member: false, audits: [] }; let failAudit = true;
  const delegates = (get: () => State) => ({
    resendWebhookEvent: {
      create: async () => { if (get().status) throw new Error('duplicate'); get().status = 'PROCESSING'; },
      updateMany: async ({ where, data }: { where: { processingStatus: string }; data: { processingStatus: string } }) => {
        if (get().status !== where.processingStatus) return { count: 0 };
        get().status = data.processingStatus; return { count: 1 };
      },
      update: async ({ data }: { data: { processingStatus: string } }) => { get().status = data.processingStatus; },
      findFirst: async () => null,
    },
    communicationGroupMembership: { createMany: async () => { get().member = true; } },
    auditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => {
      if (failAudit) throw new Error('audit unavailable'); get().audits.push(data);
    } },
    communicationGroup: { upsert: async () => ({ id: `group-${tenant}` }) },
    campaignRecipient: { findMany: async () => [{ id: 'recipient', clientId: 'client', email: `${tenant}@example.test`, campaign: { workspaceId: tenant } }] },
  });
  const prisma = { ...delegates(() => state), $transaction: async (run: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)) => {
    if (Array.isArray(run)) return Promise.all(run);
    const pending = structuredClone(state); const result = await run(delegates(() => pending)); state = pending; return result;
  } };
  const exports: { processPermanentBounce?: (id: string, event: unknown) => Promise<unknown> } = {};
  const modules: Record<string, unknown> = { 'server-only': {}, '@/lib/prisma': { prisma }, './bounce-core': core,
    './campaign-ownership': { resolveCampaignWorkspace: async (id: string) => id },
    '@/lib/audit': { recordAuditEvent: async () => {} } };
  runInNewContext(ts.transpileModule(readFileSync(new URL('./bounces.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const run = () => exports.processPermanentBounce!('event', { type: 'email.bounced', data: { email_id: 'message', to: [`${tenant}@example.test`], bounce: { type: 'permanent' } } });
  await assert.rejects(run(), /audit unavailable/);
  assert.deepEqual(structuredClone(state), { status: 'FAILED_RETRYABLE', member: false, audits: [] });
  failAudit = false; await run();
  assert.equal(state.status, 'PROCESSED'); assert.equal(state.member, true); assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].workspaceId, tenant); assert.equal(state.audits[0].action, 'CLIENT_PERMANENT_BOUNCE_RECORDED');
  await run(); assert.equal(state.audits.length, 1);
});
