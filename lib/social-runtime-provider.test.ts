import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture() {
  let locks = 0;
  const exports: { syntheticSocialFetch?: (url: string, options: RequestInit) => Promise<Response> } = {};
  const modules: Record<string, unknown> = {
    'node:assert/strict': assert,
    '@/lib/prisma': { prisma: { $transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ $queryRaw: async () => { locks++; return [{ locked: 1 }]; } }) } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL('../scripts/rehearsal/request-isolation/social-provider.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Response, Headers, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const body = (id: string, grounding = false) => ({ instructions: `You are Social Studio for Synthetic ${id}.`, input: `AI_FACT_${id}${grounding ? ` AI_DRAFT_${id}` : ''}`, text: { format: { type: grounding ? 'json_schema' : 'json_object' } } });
  return { body, locks: () => locks, call: (input: unknown, url = 'https://api.openai.com/v1/responses') => exports.syntheticSocialFetch!(url, {
    method: 'POST', headers: { Authorization: 'Bearer packet34-synthetic-no-provider' }, body: JSON.stringify(input),
  }) };
}
for (const id of ['a', 'b']) test(`synthetic Social provider ${id} returns owned drafts without network`, async () => {
  const h = fixture();
  const generated = await (await h.call(h.body(id))).json();
  assert.equal(JSON.parse(generated.output_text).FACEBOOK.caption, `AI_DRAFT_${id}`); assert.equal(h.locks(), 1);
  const grounded = await (await h.call(h.body(id, true))).json();
  assert.equal(JSON.parse(grounded.output_text).platforms.FACEBOOK.caption, `AI_DRAFT_${id}`); assert.equal(h.locks(), 1);
});
test('synthetic Social provider rejects unexpected destinations, tenants and foreign facts before database access', async () => {
  const h = fixture();
  await assert.rejects(h.call(h.body('a'), 'https://unexpected.example.test'));
  await assert.rejects(h.call(h.body('c')));
  await assert.rejects(h.call({ ...h.body('a'), input: 'AI_FACT_b' }));
  await assert.rejects(h.call({ ...h.body('a'), input: 'AI_FACT_a AI_FACT_b' }));
  assert.equal(h.locks(), 0);
});
