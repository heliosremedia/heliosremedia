import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Actual components in an isolated hook harness. */
const jsx = (type: any, props: any) => ({ type, props });
function elements(node: any): any[] {
 if (Array.isArray(node)) return node.flatMap(elements);
 if (!node?.props) return [];
 if (typeof node.type === 'function') return elements(node.type(node.props));
 return [node, ...elements(node.props.children)];
}
const card = (id = 'c1') => ({ id, serviceId: 's' + id, titleOverride: 'Original', destinationOverride: '/portfolio', displayOrder: id === 'c1' ? 0 : 1, active: true, imageStorageKey: null, imageUrl: null, imageAlt: null, mediaMode: 'IMAGE', featuredMediaId: null, videoStorageKey: null, videoUrl: null, service: { id: 's' + id, name: id, slug: id, active: true }, featuredMedia: null });
const placement = { id: 'p1', projectId: 'project1', titleOverride: 'Original', displayOrder: 0, active: true, imageUrl: null, project: { title: 'Project', slug: 'project', status: 'PUBLISHED', locationLabel: null, heroMedia: null } };
function fixture(fetcher: any, project = false, extra: Record<string, any> = {}) {
 const values: any[] = []; let cursor = 0; const cleanups = new Set<() => void>();
 const modules: Record<string, any> = { react: {
 useState(initial: any) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], (next: any) => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
 useRef(initial: any) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
 useEffect(effect: any, deps: any[]) { const i = cursor++; if (!(i in values) || deps.some((v, n) => v !== values[i].deps[n])) { values[i]?.cleanup?.(); const cleanup = effect(); values[i] = { deps, cleanup }; if (cleanup) cleanups.add(cleanup); } },
 useSyncExternalStore(_s: any, read: any) { return read(); },
 }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/image': { default: () => null } };
 function load(path: string): any { const exports = {}; runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Error, URL, Date, AbortController, crypto: globalThis.crypto, setTimeout: () => 0, clearTimeout, fetch: fetcher, window: { addEventListener() {}, removeEventListener() {}, location: { reload() {} } }, ...extra, require(id: string) { if (id in modules) return modules[id]; let path = id.startsWith('@/') ? id.slice(2) : id.startsWith('./') ? 'app/admin/homepage/' + id.slice(2) : ''; if (path) { if (!/\.tsx?$/.test(path)) path += path.includes('useCuration') || path.includes('CurationRecovery') ? '.tsx' : '.ts'; return modules[id] = load(path); } throw new Error('Unexpected ' + id); } }); return exports; }
 const component = load(`app/admin/homepage/Homepage${project ? 'Project' : 'WorkCard'}Manager.tsx`).default;
 const props = project ? { initialPlacements: [placement], projects: [{ id: 'project1', title: 'Project', slug: 'project' }] } : { initialCards: [card(), card('c2')], services: [card().service, card('c2').service], films: [] };
 const render = () => { cursor = 0; return elements(component({ ...props, workspaceId: 'a', initialRevision: 'baseline' })); };
 return { render, button: (name: string) => render().find(e => e.type === 'button' && e.props.children === name), input: () => render().find(e => e.type === 'input' && e.props.type !== 'file' && e.props.type !== 'checkbox'), unmount: () => cleanups.forEach(fn => fn()) };
}
const tick = () => new Promise(r => setTimeout(r, 0));
test('curation actual component synchronously prevents duplicate saves', () => {
 let calls = 0; const f = fixture(() => { calls++; return new Promise(() => {}); }); const save = f.button('Save card'); save.props.onClick(); save.props.onClick(); assert.equal(calls, 1);
});
test('curation actual component does not accept an unvalidated foreign acknowledgement', async () => {
 const f = fixture(async () => Response.json({ success: true, card: { ...card(), titleOverride: 'Foreign' } })); f.button('Save card').props.onClick(); await tick(); assert.equal(f.input().props.value, 'Original');
});
test('curation actual component preserves edits during a pending save', async () => {
 let finish: any; const f = fixture(() => new Promise(r => { finish = r; })); f.button('Save card').props.onClick(); f.input().props.onChange({ target: { value: 'Newer' } }); finish(Response.json({ success: true, card: card() })); await tick(); assert.equal(f.input().props.value, 'Newer');
});
test('curation actual component does not retry automatically after lost acknowledgement', async () => {
 let calls = 0; const f = fixture(async () => { calls++; throw new Error('lost'); }); f.button('Save card').props.onClick(); await tick(); await tick(); assert.equal(calls, 1); assert.equal(f.input().props.value, 'Original');
});
test('curation actual component retains attempted order after uncertain acknowledgement', async () => {
 const f = fixture(async () => { throw new Error('lost'); }); f.button('↓').props.onClick(); await tick(); const titles = f.render().filter(e => e.type === 'h3').map(e => e.props.children); assert.deepEqual(titles, ['c2', 'c1']);
});

function acknowledgement(options: any, project = false, mutate?: (value: any) => void) {
 const body = options.body ? JSON.parse(options.body) : {};
 const row = project ? { ...placement, ...body } : { ...card(), ...body };
 const result: any = { success: true, ...(project ? { placement: row } : { card: row }), acknowledgement: { protocol: 1, scope: project ? 'projects' : 'work-cards', requestId: options.headers['x-curation-request'], workspaceId: 'a', previousRevision: options.headers['x-curation-revision'], revision: 'a'.repeat(64), ids: project ? ['p1'] : ['c1','c2'] } };
 mutate?.(result); return Response.json(result);
}
for (const defect of ['company', 'request', 'scope', 'revision', 'previous', 'ids', 'card', 'intent']) test(`curation rejects ${defect} acknowledgement and holds further writes`, async () => {
 let calls = 0; const f = fixture(async (_url: string, options: any) => { calls++; return acknowledgement(options, false, result => {
  const ack = result.acknowledgement;
  if (defect === 'company') ack.workspaceId = 'b';
  if (defect === 'request') ack.requestId = 'old';
  if (defect === 'scope') ack.scope = 'projects';
  if (defect === 'revision') ack.revision = options.headers['x-curation-revision'];
  if (defect === 'previous') ack.previousRevision = 'other';
  if (defect === 'ids') ack.ids = ['foreign'];
  if (defect === 'card') result.card.id = 'foreign';
  if (defect === 'intent') result.card.titleOverride = 'foreign';
 }); });
 f.button('Save card').props.onClick(); await tick(); assert.ok(f.render().some(e => e.type === 'textarea')); assert.equal(f.input().props.value, 'Original'); f.button('Save card').props.onClick(); await tick(); assert.equal(calls, 1);
});
test('curation freezes save body, preserves newer edits and advances authoritative revision', async () => {
 const requests: any[] = []; let finish: any; const f = fixture((_u: string, options: any) => { requests.push(options); return new Promise(r => { finish = () => r(acknowledgement(options)); }); });
 const old = f.button('Save card'); f.input().props.onChange({ target: { value: 'Draft' } }); f.render(); old.props.onClick(); assert.equal(requests.length, 0);
 f.button('Save card').props.onClick(); f.input().props.onChange({ target: { value: 'Newer' } }); finish(); await tick(); assert.equal(JSON.parse(requests[0].body).titleOverride, 'Draft'); assert.equal(f.input().props.value, 'Newer'); f.button('Save card').props.onClick(); assert.equal(requests[1].headers['x-curation-revision'], 'a'.repeat(64));
});
test('curation contains stale tab conflict without retry or draft loss', async () => {
 let calls = 0; const f = fixture(async () => { calls++; return Response.json({ success: false }, { status: 409 }); }); f.button('Save card').props.onClick(); await tick(); assert.ok(f.render().some(e => e.props.role === 'status' && String(e.props.children).startsWith('Conflict:'))); assert.equal(f.input().props.value, 'Original'); f.button('Save card').props.onClick(); assert.equal(calls, 1);
});
test('curation timeout holds writes and ignores late response', async () => {
 let expire: any, finish: any, calls = 0; const f = fixture((_u: string, options: any) => { calls++; return new Promise(r => { finish = () => r(acknowledgement(options)); }); }, false, { setTimeout: (fn: any) => { expire = fn; return 1; } });
 f.button('Save card').props.onClick(); expire(); await tick(); assert.ok(f.render().some(e => e.type === 'textarea')); f.input().props.onChange({ target: { value: 'After timeout' } }); finish(); await tick(); assert.equal(f.input().props.value, 'After timeout'); f.button('Save card').props.onClick(); assert.equal(calls, 1);
});
test('curation bounds JSON settlement and ignores completion after unmount', async () => {
 let finish: any; const f = fixture(async (_u: string, options: any) => ({ ok: true, json: () => new Promise(r => { finish = async () => r(await acknowledgement(options).json()); }) })); f.button('Save card').props.onClick(); await tick(); f.unmount(); await finish(); await tick(); assert.equal(f.input().props.value, 'Original'); assert.equal(f.button('Saving…').props.disabled, true);
});
test('curation project acknowledgement preserves newer controlled title', async () => {
 let finish: any; const f = fixture((_u: string, options: any) => new Promise(r => { finish = () => r(acknowledgement(options, true)); }), true);
 f.input().props.onBlur({ target: { value: 'Original' } }); f.input().props.onChange({ target: { value: 'New project draft' } }); finish(); await tick(); assert.equal(f.input().props.value, 'New project draft');
});
test('curation remove validates deleted identity and retains the draft on unknown result', async () => {
 const f = fixture(async (_u: string, options: any) => acknowledgement(options, false, result => { result.deletedCardId = 'other'; result.acknowledgement.ids = ['c2']; })); f.button('Remove').props.onClick(); await tick(); assert.equal(f.render().filter(e => e.type === 'h3').length, 2); assert.ok(f.render().some(e => e.type === 'textarea'));
});
test('curation rejects stale authoritative order despite success flag', async () => {
 const f = fixture(async (_u: string, options: any) => acknowledgement(options, false, result => { result.cardIds = ['c1','c2']; })); f.button('↓').props.onClick(); await tick(); assert.ok(f.render().some(e => e.type === 'textarea')); assert.deepEqual(f.render().filter(e => e.type === 'h3').map(e => e.props.children), ['c2','c1']);
});
test('curation upload cannot enter during save and late presign cannot transfer after unmount', async () => {
 let calls = 0, finish: any, transfers = 0;
 const fetcher = () => { calls++; return new Promise(r => { finish = () => r(Response.json({ success: true, upload: { key: 'site/homepage/work-cards/c1/image.webp', publicUrl: 'https://assets.test/image.webp', uploadUrl: 'https://upload.test/object', contentType: 'image/webp' } })); }); };
 class XHR { upload = {}; open() {} setRequestHeader() {} send() { transfers++; } }
 const f = fixture(fetcher, false, { XMLHttpRequest: XHR }); f.button('Save card').props.onClick(); f.render().find(e => e.props.type === 'file').props.onChange({ target: { files: [{ name: 'image.webp', type: 'image/webp', size: 10 }], value: '' } }); assert.equal(calls, 1); f.unmount();
 const g = fixture(fetcher, false, { XMLHttpRequest: XHR }); g.render().filter(e => e.props.type === 'file')[1].props.onChange({ target: { files: [{ name: 'image.webp', type: 'image/webp', size: 10 }], value: '' } }); g.unmount(); finish(); await tick(); assert.equal(transfers, 0);
});
test('curation retains prepared media and sibling draft when save acknowledgement is lost', async () => {
 let transfers = 0; class XHR { upload = {}; status = 200; onload!: () => void; open() {} setRequestHeader() {} send() { transfers++; this.onload(); } abort() {} }
 const f = fixture(async (url: string) => { if (url.endsWith('presign')) return Response.json({ success: true, upload: { key: 'site/homepage/work-cards/c1/image.webp', publicUrl: 'https://assets.test/image.webp', uploadUrl: 'https://upload.test/object', contentType: 'image/webp' } }); throw new Error('lost'); }, false, { XMLHttpRequest: XHR });
 const inputs = f.render().filter(e => e.type === 'input' && typeof e.props.value === 'string'); inputs[3].props.onChange({ target: { value: 'Sibling draft' } }); f.render().filter(e => e.props.type === 'file')[1].props.onChange({ target: { files: [{ name: 'image.webp', type: 'image/webp', size: 10 }], value: '' } }); await tick(); await tick(); f.render(); const copy = f.render().find(e => e.type === 'textarea'); assert.match(copy.props.value, /site\/homepage\/work-cards\/c1\/image.webp/); assert.match(copy.props.value, /Sibling draft/); assert.equal(transfers, 1);
});
test('curation confirmed remove changes only the acknowledged record', async () => {
 const f = fixture(async (_u: string, options: any) => acknowledgement(options, false, result => { result.deletedCardId = 'c1'; result.acknowledgement.ids = ['c2']; })); f.button('Remove').props.onClick(); await tick(); assert.deepEqual(f.render().filter(e => e.type === 'h3').map(e => e.props.children),['c2']);
});
test('curation confirmed reorder preserves sibling unsaved text', async () => {
 const f = fixture(async (_u: string, options: any) => acknowledgement(options, false, result => { result.cardIds = ['c2','c1']; result.acknowledgement.ids = ['c2','c1']; })); f.input().props.onChange({ target: { value: 'Sibling retained' } }); f.button('↓').props.onClick(); await tick(); const values = f.render().filter(e => e.type === 'input').map(e => e.props.value); assert.ok(values.includes('Sibling retained')); assert.deepEqual(f.render().filter(e => e.type === 'h3').map(e => e.props.children),['c2','c1']);
});
test('curation project blur callbacks are synchronously admitted once', () => {
 let calls=0; const f=fixture(() => { calls++; return new Promise(() => {}); },true); const input=f.input(); input.props.onBlur({target:{value:'Original'}}); input.props.onBlur({target:{value:'Original'}}); assert.equal(calls,1);
});
test('curation successful response cannot admit the previous save callback again', async () => {
 let calls=0; const f=fixture(async (_u:string, options:any) => { calls++; return acknowledgement(options); }); const old=f.button('Save card'); old.props.onClick(); await tick(); old.props.onClick(); assert.equal(calls,1);
});
