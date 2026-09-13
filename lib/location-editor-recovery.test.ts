import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Element = { type: unknown; props: Record<string, unknown> };
const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const item = node as Element; return [item, ...elements(item.props.children)];
}
function fixture(fetcher: typeof fetch) {
  const values: unknown[] = [];
  let cursor = 0;
  const exports = {} as { default(input: unknown): Element };
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (next: unknown) => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
      useRef: (initial: unknown) => { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'next/link': { default: 'Link' }, 'next/image': { default: 'Image' },
    '@/lib/location-page-content': { AI_LOCATION_FIELDS: [], LOCATION_FIELD_LIMITS: {} },
  };
  runInNewContext(ts.transpileModule(readFileSync('app/admin/locations/LocationPageManager.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, Error, fetch: fetcher, window: { confirm: () => true, location: { reload() {} } }, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  const row = { slug: 'town', state: 'State', county: 'County', heroLead: 'Original lead', introduction: 'Intro', marketTitle: 'Market', marketCopy: 'Copy',
    seoTitle: 'Title', seoDescription: 'Description', localDetails: ['Detail'], serviceArea: 'Area', featureImageStorageKey: null, featureImageUrl: null,
    featureImageAlt: null, featureImageFocalX: 0.5, featureImageFocalY: 0.5, published: false, updatedAt: '2026-09-13T00:00:00.000Z' };
  const initialLocations = [{ ...row, id: 'one', city: 'One', displayOrder: 0 }, { ...row, id: 'two', city: 'Two', displayOrder: 1 }];
  const render = () => { cursor = 0; return elements(exports.default({ initialLocations })); };
  const button = (label: string) => render().find(item => item.type === 'button' && (item.props['aria-label'] === label || item.props.children === label))!;
  return { render, button };
}
const invoke = async (item: Element) => (item.props.onClick as () => Promise<void> | void)();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('location reorder contains network uncertainty, retains displayed order and prevents duplicate admission', async () => {
  let requests = 0;
  let rejectRequest!: (error: Error) => void;
  const { button, render } = fixture(async () => { requests++; return new Promise<Response>((_, reject) => { rejectRequest = reject; }); });
  const move = button('Move One down');
  const build = button('Build a local page');
  const edit = button('Edit');
  const first = invoke(move);
  const duplicate = invoke(move);
  assert.equal(requests, 1);
  assert.equal((render().find(item => item.type === 'h2')!.props.children as unknown[])[0], 'One');
  rejectRequest(new Error('Synthetic connection lost'));
  await first; await duplicate;
  // Invoke captured callbacks after failure, before relying on a fresh render.
  await invoke(move); await invoke(build); await invoke(edit);
  assert.equal(requests, 1);
  assert.equal(render().filter(item => item.props.role === 'dialog').length, 0);
  assert.ok(render().some(item => item.props.role === 'alert'));
  assert.ok(button('Reload saved pages'));
  assert.equal(button('Move One down').props.disabled, true);
  assert.equal(button('Build a local page').props.disabled, true);
});

test('location reorder requires an affirmative acknowledgement and only then changes the displayed order', async () => {
  for (const response of [Response.json({ success: false }, { status: 409 }), new Response('not JSON'), Response.json({ success: false }), Response.json({ success: 'true' })]) {
    let calls = 0;
    const { button, render } = fixture(async () => { calls++; return response; });
    const move = button('Move One down'); await invoke(move); await invoke(move);
    assert.equal(calls, 1);
    assert.equal((render().find(item => item.type === 'h2')!.props.children as unknown[])[0], 'One');
    assert.ok(button('Reload saved pages'));
  }
  const { button, render } = fixture(async () => Response.json({ success: true, revisionProtocol: 1, order: [
    { id: 'two', displayOrder: 0, updatedAt: '2026-09-13T01:00:00.000Z' }, { id: 'one', displayOrder: 1, updatedAt: '2026-09-13T01:00:00.000Z' },
  ] }));
  await invoke(button('Move One down'));
  assert.equal((render().find(item => item.type === 'h2')!.props.children as unknown[])[0], 'Two');
  assert.equal(button('Move One up').props.disabled, false);
});

test('slow location image upload preserves intervening draft text and ignores completion after closing the editor', async () => {
  let finishUpload!: (response: Response) => void;
  let uploads = 0;
  const { button, render } = fixture(async (input) => {
    if (String(input).endsWith('/presign')) return Response.json({ success: true, upload: { key: 'workspaces/b/locations/one.webp', publicUrl: '/synthetic-image', uploadUrl: '/synthetic-upload', contentType: 'image/webp' } });
    uploads++; return new Promise<Response>(resolve => { finishUpload = resolve; });
  });
  await invoke(button('Edit'));
  const upload = render().find(item => item.type === 'input' && item.props.type === 'file')!;
  (upload.props.onChange as (event: unknown) => void)({ target: { files: [{ name: 'test.webp', type: 'image/webp', size: 1 }], value: 'test.webp' } });
  (upload.props.onChange as (event: unknown) => void)({ target: { files: [{ name: 'duplicate.webp', type: 'image/webp', size: 1 }], value: 'duplicate.webp' } });
  await tick();
  const field = render().find(item => item.props.value === 'Original lead')!;
  (field.props.onChange as (value: string) => void)('Edited during upload');
  finishUpload(new Response(null, { status: 200 }));
  await tick();
  assert.ok(render().some(item => item.props.value === 'Edited during upload'));
  assert.equal(uploads, 1);
  const nextUpload = render().find(item => item.type === 'input' && item.props.type === 'file')!;
  (nextUpload.props.onChange as (event: unknown) => void)({ target: { files: [{ name: 'next.webp', type: 'image/webp', size: 1 }], value: 'next.webp' } });
  await tick();
  await invoke(button('Cancel'));
  finishUpload(new Response(null, { status: 200 }));
  await tick();
  assert.equal(render().filter(item => item.props.role === 'dialog').length, 0);
});

test('location AI drafts cannot cross editor contexts or duplicate admission', async () => {
  let calls = 0; let finish!: (response: Response) => void;
  const { button, render } = fixture(async () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); });
  await invoke(button('Edit')); await invoke(button('Open assistant'));
  const generate = button('Auto generate');
  const first = invoke(generate); const duplicate = invoke(generate);
  assert.equal(calls, 1);
  await invoke(button('Close editor'));
  const otherEdit = render().filter(item => item.type === 'button' && item.props.children === 'Edit')[1];
  await invoke(otherEdit); await invoke(button('Open assistant'));
  finish(Response.json({ success: true, draft: { heroLead: 'Draft prepared for the old editor' } }));
  await first; await duplicate;
  assert.equal(button('Apply complete draft'), undefined);
  assert.ok(render().some(item => item.props.value === 'Original lead'));
});

test('location save submits the open revision, retains uncertain drafts and fences duplicate/stale callbacks', async () => {
  let calls = 0; let finish!: (response: Response) => void; let submitted = {} as Record<string, unknown>;
  const { button, render } = fixture(async (_url, options) => {
    calls++; submitted = JSON.parse(String(options?.body));
    assert.equal(new Headers(options?.headers).get('x-helios-location-revision'), '1');
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  await invoke(button('Edit'));
  const lead = render().find(item => item.props.value === 'Original lead')!;
  (lead.props.onChange as (value: string) => void)('Keep this unsaved copy');
  const save = button('Save draft'), close = button('Close editor');
  const first = invoke(save); await invoke(save); await invoke(close);
  assert.equal(calls, 1); assert.equal(submitted.expectedUpdatedAt, '2026-09-13T00:00:00.000Z');
  assert.equal(submitted.heroLead, 'Keep this unsaved copy');
  assert.equal(render().find(item => item.type === 'fieldset')!.props.disabled, true);
  assert.equal(render().filter(item => item.props.role === 'dialog').length, 1);
  finish(Response.json({ success: false }, { status: 409 })); await first; await invoke(save);
  assert.equal(calls, 1); assert.ok(render().some(item => item.props.value === 'Keep this unsaved copy'));
  assert.equal(button('Save draft').props.disabled, true);
  await invoke(button('Cancel')); assert.ok(button('Reload saved pages'));
});

test('location reorder uses authoritative revisions and refuses legacy, foreign or duplicate response rows', async () => {
  const good = [{ id: 'one', displayOrder: 8, updatedAt: '2026-09-13T02:00:00.000Z' }, { id: 'two', displayOrder: 9, updatedAt: '2026-09-13T02:00:00.000Z' }];
  for (const result of [{ success: true }, { success: true, revisionProtocol: 1, order: [good[0], good[0]] },
    { success: true, revisionProtocol: 1, order: [good[0], { ...good[1], id: 'foreign' }] }]) {
    const { button } = fixture(async () => Response.json(result));
    await invoke(button('Move One down')); assert.ok(button('Reload saved pages'));
  }
  const requests: Record<string, unknown>[] = [];
  const { button, render } = fixture(async (_url, options) => { requests.push(JSON.parse(String(options?.body))); return Response.json({ success: true, revisionProtocol: 1, order: good }); });
  await invoke(button('Move One down'));
  assert.equal((render().find(item => item.type === 'h2')!.props.children as unknown[])[0], 'One', 'server order is used even if it differs from the guessed swap');
  await invoke(button('Move One down'));
  assert.equal(requests[1].expectedUpdatedAt, good[0].updatedAt);
  assert.deepEqual(requests[1].expectedOrder, good.map(({ id, updatedAt }) => ({ id, updatedAt })));
});
