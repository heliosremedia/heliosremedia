import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/* eslint-disable @typescript-eslint/no-explicit-any -- Narrow executable React VM harness. */

type Element = { type: unknown; props: Record<string, any> };
const jsx = (type: unknown, props: Element['props']): Element => ({ type, props });
function elements(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  return node?.props ? [node, ...elements(node.props.children)] : [];
}
const original = { id: 'privacy-one', type: 'PRIVACY_POLICY', title: 'Privacy', content: '<p>Reviewed copy</p>', published: false, updatedAt: '2026-09-13T00:00:00.000Z' };
function fixture(fetcher: typeof fetch, row = original, timer = setTimeout) {
  const values: any[] = []; let cursor = 0; let reloads = 0;
  const exports = {} as { default(input: unknown): Element };
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], (next: any) => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
      useRef: (initial: unknown) => { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
      useEffect: () => {},
    }, 'react/jsx-runtime': { jsx, jsxs: jsx },
  };
  runInNewContext(ts.transpileModule(readFileSync('app/admin/settings/LegalDocumentsManager.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, Date, AbortController, setTimeout: timer, clearTimeout, fetch: fetcher,
    window: { location: { reload() { reloads++; } } }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const initialDocuments = [row, { ...original, id: 'terms-one', type: 'TERMS_OF_SERVICE', title: 'Terms' }];
  const render = () => { cursor = 0; return elements(exports.default({ initialDocuments })); };
  const button = (label: string) => render().find(e => e.type === 'button' && e.props.children === label)!;
  return { render, button, reloads: () => reloads };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const ack = (patch = {}) => Response.json({ success: true, revisionProtocol: 1, document: { ...original, updatedAt: '2026-09-13T01:00:00.000Z', ...patch } });

test('legal editor admits one save synchronously and freezes captured input callbacks', async () => {
  let calls = 0; let finish!: (r: Response) => void;
  const f = fixture(async () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); });
  const save = f.button('Save document');
  const field = f.render().find(e => e.props.value === 'Privacy')!;
  save.props.onClick(); save.props.onClick();
  assert.equal(calls, 1);
  field.props.onChange({ target: { value: 'Late unsaved title' } });
  assert.ok(f.render().some(e => e.props.value === 'Privacy'));
  assert.equal(f.render().find(e => e.props.value === 'Privacy')!.props.disabled, true);
  finish(ack()); await tick();
  assert.equal(f.button('Save document').props.disabled, false);
  save.props.onClick(); assert.equal(calls, 1, 'stale saved-revision callback cannot submit again');
});

test('legal editor holds uncertain or untrusted responses and retains both drafts for explicit recovery', async () => {
  for (const response of [new Response('not JSON'), Response.json({ success: true }), ack({ id: 'foreign' }), ack({ type: 'TERMS_OF_SERVICE' }), ack({ updatedAt: original.updatedAt }), ack({ published: 'yes' }), Response.json({ success: false }, { status: 409 }), Response.json({ success: false }, { status: 403 })]) {
    let calls = 0;
    const f = fixture(async () => { calls++; return response; });
    f.render().find(e => e.props.value === 'Privacy')!.props.onChange({ target: { value: 'Retain my title' } });
    const save = f.button('Save document'); save.props.onClick(); await tick(); save.props.onClick();
    assert.equal(calls, 1); assert.equal(f.button('Save document').props.disabled, true);
    assert.ok(f.render().some(e => e.props.role === 'alert'));
    const recovery = f.render().find(e => e.props['aria-label'] === 'Unsaved legal documents')!;
    assert.equal(recovery.props.readOnly, true); assert.match(recovery.props.value, /Retain my title/); assert.match(recovery.props.value, /Terms/);
    const reload = f.button('Reload saved documents'); reload.props.onClick(); assert.equal(f.reloads(), 0);
    f.render().find(e => e.props['aria-label'] === 'I have preserved my unsaved copy')!.props.onChange({ target: { checked: true } });
    f.button('Reload saved documents').props.onClick(); assert.equal(f.reloads(), 1);
  }
});

test('legal editor accepts sanitized authoritative data and new document identity only from the unsaved sentinel', async () => {
  const f = fixture(async () => ack({ title: 'Server title', content: '<p>' + 'Safe content '.repeat(20) + '</p>', published: true }), { ...original, title: '  Server title  ', content: '<p>' + 'Reviewed '.repeat(20) + '</p>', published: true });
  f.button('Save document').props.onClick(); await tick();
  assert.ok(f.render().some(e => e.props.value === 'Server title'));
  assert.ok(f.render().some(e => typeof e.props.children === 'string' && e.props.children === 'Server title saved and published.'));
  const creating = fixture(async () => ack({ id: 'new-owned-id' }), { ...original, id: 'legal-privacy-policy', updatedAt: new Date(0).toISOString() });
  creating.button('Save document').props.onClick(); await tick();
  assert.equal(creating.button('Save document').props.disabled, false);
  const legacy = fixture(async () => ack({ id: 'legal-privacy-policy' }), { ...original, id: 'legal-privacy-policy' });
  legacy.button('Save document').props.onClick(); await tick();
  assert.equal(legacy.button('Save document').props.disabled, false, 'migrated legacy ID with a real revision remains valid');
});

test('obvious invalid legal drafts stay editable without issuing a write', async () => {
  for (const row of [{ ...original, title: ' ' }, { ...original, published: true }]) {
    let calls = 0; const f = fixture(async () => { calls++; return ack(); }, row);
    f.button('Save document').props.onClick(); await tick();
    assert.equal(calls, 0); assert.equal(f.button('Save document').props.disabled, false);
    assert.ok(f.render().some(e => e.props.role === 'status'));
  }
});

test('legal editor bounds fetch and JSON settlement, ignores late success and does not leak transport errors', async () => {
  for (const stage of ['fetch', 'json', 'network']) {
    let timeout!: () => void; let finish!: (value: any) => void; let signal: AbortSignal | undefined;
    let calls = 0;
    const f = fixture(async (_url, options) => {
      calls++; signal = options?.signal as AbortSignal;
      if (stage === 'network') throw new Error('PRIVATE transport failure');
      if (stage === 'fetch') return new Promise<Response>(resolve => { finish = resolve; });
      return { ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response;
    }, original, ((fn: () => void) => { timeout = fn; return 0; }) as unknown as typeof setTimeout);
    const save = f.button('Save document'); save.props.onClick(); await tick();
    if (stage !== 'network') { timeout(); await tick(); assert.equal(signal?.aborted, true); }
    assert.equal(f.button('Save document').props.disabled, true);
    const alert = f.render().find(e => e.props.role === 'alert')!;
    assert.doesNotMatch(alert.props.children, /PRIVATE/);
    if (stage === 'fetch') finish(ack());
    if (stage === 'json') finish(await ack().json());
    await tick(); save.props.onClick();
    assert.equal(calls, 1); assert.equal(f.button('Save document').props.disabled, true);
    assert.ok(f.render().some(e => e.props.value === original.content));
  }
});
