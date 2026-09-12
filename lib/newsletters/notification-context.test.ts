import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function harness() {
  let companies = [{ id: 'a' }], exists = true, owner = 'a', ownershipFails = false, providerFails = false;
  const sent: Array<Record<string, unknown>> = [], logs: unknown[] = [];
  const modules: Record<string, unknown> = {
    'server-only': {}, '@/lib/site': { getSiteUrl: () => 'https://synthetic.invalid' },
    '@/lib/prisma': { prisma: {
      newsletterEdition: { findUnique: async ({ where }: { where: { id: string } }) => { assert.equal(where.id, 'edition/a'); return exists ? { id: 'edition/a', subject: 'Stored subject', cycleKey: 'cycle', series: { name: 'Stored series', workspaceId: owner } } : null; } },
      workspace: { findMany: async ({ take }: { take: number }) => { assert.equal(take, 2); return companies; } },
    } },
    './ownership': { resolveNewsletterWorkspace: async (id: string) => { assert.equal(id, owner); if (ownershipFails) throw new Error('Ambiguous'); return id; } },
    './notifications': { sendNewsletterAdminNotification: async (input: Record<string, unknown>) => { sent.push(input); if (providerFails) throw new Error('Private provider error'); return { delivered: true }; } },
  };
  const exports: { notifyNewsletterEdition?: (input: unknown) => Promise<{ delivered: boolean }> } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./notification-context.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console: { error: (...args: unknown[]) => logs.push(args) }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; },
  });
  return { call: () => exports.notifyNewsletterEdition!({ editionId: 'edition/a', kind: 'SEND_COMPLETED', detail: 'Stored execution result', editionLabel: 'Forged label', workspaceId: 'forged', reviewUrl: 'https://foreign.invalid' }), sent, logs,
    multiple: () => { companies = [{ id: 'a' }, { id: 'b' }]; }, foreign: () => { owner = 'b'; }, none: () => { companies = []; }, missing: () => { exists = false; }, ambiguous: () => { ownershipFails = true; }, failProvider: () => { providerFails = true; } };
}

test("legacy newsletter notification uses stored edition identity and only one matching company", async () => {
  const h = harness(); assert.equal((await h.call()).delivered, true);
  assert.equal(h.sent.length, 1);
  assert.equal(JSON.stringify(h.sent[0]), JSON.stringify({ kind: 'SEND_COMPLETED', detail: 'Stored execution result', editionLabel: 'Stored subject', reviewUrl: 'https://synthetic.invalid/admin/newsletter-studio/editions/edition%2Fa' }));
});

test("ambiguous, foreign and missing newsletter ownership never reach the global notification provider", async () => {
  for (const scenario of ['multiple', 'foreign', 'none', 'missing', 'ambiguous'] as const) {
    const h = harness(); h[scenario](); assert.equal((await h.call()).delivered, false); assert.equal(h.sent.length, 0, scenario);
  }
});

test("notification transport errors are bounded and do not throw into the job outcome", async () => {
  const h = harness(); h.failProvider(); assert.equal((await h.call()).delivered, false); assert.equal(h.sent.length, 1);
  assert.equal(JSON.stringify(h.logs).includes('Private provider error'), false);
  assert.equal(JSON.stringify(h.logs).includes('Stored subject'), false);
});
