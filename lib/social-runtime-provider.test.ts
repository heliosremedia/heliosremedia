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
  const body = (id: string, grounding = false, platforms = ['FACEBOOK']) => ({ instructions: `You are Social Studio for Synthetic ${id}.`, input: `Create distinct social drafts for: ${platforms.join(", ")}. AI_FACT_${id}${grounding ? ` AI_DRAFT_${id}` : ''}`, text: { format: { type: grounding ? 'json_schema' : 'json_object', schema: { properties: { platforms: { required: platforms } } } } } });
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

test('synthetic Social provider supplies exactly the requested two platforms at both stages', async () => {
  const h = fixture();
  for (const grounding of [false, true]) {
    const response = await (await h.call(h.body('a', grounding, ['FACEBOOK', 'INSTAGRAM']))).json();
    const result = JSON.parse(response.output_text);
    const drafts = grounding ? result.platforms : Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'campaignBrief'));
    assert.deepEqual(Object.keys(drafts).sort(), ['FACEBOOK', 'INSTAGRAM']);
    assert.equal(drafts.FACEBOOK.caption, 'AI_DRAFT_a'); assert.equal(drafts.INSTAGRAM.caption, 'AI_DRAFT_a');
  }
});
test('synthetic Social provider rejects empty, duplicate and unsupported platform sets before locking', async () => {
  const h = fixture();
  for (const platforms of [[], ['FACEBOOK', 'FACEBOOK'], ['OTHER']]) {
    for (const grounding of [false, true]) await assert.rejects(h.call(h.body('a', grounding, platforms)));
  }
  assert.equal(h.locks(), 0);
});
