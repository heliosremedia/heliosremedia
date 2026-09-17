import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/* eslint-disable @typescript-eslint/no-explicit-any -- Executable actual-component hook harness. */
type Element = { type: any; props: Record<string, any> };
const jsx = (type: any, props: Element['props']): Element => ({ type, props });
function elements(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  if (typeof node.type === 'function') return elements(node.type(node.props));
  return [node, ...elements(node.props.children)];
}
const revision = { id: 'workspace:b', workspaceId: 'b', storedWorkspaceId: 'b', updatedAt: '2026-09-17T00:00:00.000Z' };
function fixture(fetcher: typeof fetch, mode = 'navigation', timer = setTimeout, revisionOverride = revision, extra: Record<string, any> = {}, initialOverride: Record<string, any> = {}) {
  const values: any[] = []; let cursor = 0; let reloads = 0;
  const cleanups = new Set<() => void>();
  const listeners = new Map<string, () => void>();
  const modules: Record<string, any> = {
    react: {
      useState: (initial: any) => { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], (next: any) => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
      useRef: (initial: any) => { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
      useSyncExternalStore: (_subscribe: unknown, read: () => string) => read(),
      useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
        const i = cursor++;
        if (!(i in values) || deps.some((value, index) => value !== values[i].deps[index])) {
          if (values[i]?.cleanup) { values[i].cleanup(); cleanups.delete(values[i].cleanup); }
          const cleanup = effect(); values[i] = { deps, cleanup }; if (cleanup) cleanups.add(cleanup);
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/app/admin/components/AdminCardControls': { AdminCardToggle: () => null },
    '@/app/admin/components/AdminSectionNavigator': { default: () => null },
  };
  function load(path: string): any {
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, Error, URL, Date, AbortController, crypto: globalThis.crypto, setTimeout: timer, clearTimeout, fetch: fetcher,
      ...extra,
      window: { addEventListener(name: string, fn: () => void) { listeners.set(name, fn); }, removeEventListener(name: string) { listeners.delete(name); }, location: { reload() { reloads++; } } },
      require: (id: string) => {
        if (id in modules) return modules[id];
        if (id === './useFilmRecovery') return modules[id] = load('app/admin/homepage/useFilmRecovery.tsx');
        if (id === './site-settings-editor') return modules[id] = load('lib/site-settings-editor.ts');
        if (id.startsWith('@/app/admin/homepage/')) return modules[id] = load(id.replace('@/', '') + '.tsx');
        if (id.startsWith('@/lib/')) return modules[id] = load(id.replace('@/', '') + '.ts');
        if (id.startsWith('@/app/admin/settings/')) return modules[id] = load(id.replace('@/', '') + (id.endsWith('settingsDraftCopies') ? '.ts' : '.tsx'));
        if (id.startsWith('@/lib/site-settings-editor')) return modules[id] = load(id.replace('@/', '') + '.ts');
        assert.fail(`Unexpected dependency ${id}`);
      } });
    return exports;
  }
  const initialSettings = { featuredFilmEnabled: false, featuredFilmVideoStorageKey: null, featuredFilmVideoUrl: null, featuredFilmPosterStorageKey: null, featuredFilmPosterUrl: null, featuredFilmDestination: '/portfolio', ...initialOverride };
  const component = load('app/admin/homepage/HomepageFilmManager.tsx').default;
  const render = () => { cursor = 0; return elements(component({ initialSettings, initialRevision: revisionOverride, mode })); };
  const button = () => render().find(e => e.type === 'button' && /^(Save feature|Saving…)$/.test(e.props.children))!;
  return { render, button, initialSettings, reloads: () => reloads, hasWarning: () => listeners.has('beforeunload'), unmount: () => cleanups.forEach(cleanup => cleanup()) };
}


test('film actual component admits duplicate save callbacks only once', () => {
 let calls = 0;
 const f = fixture(async () => { calls++; return new Promise<Response>(() => {}); }, 'film', (() => 0) as any);
 const save = f.button(); save.props.onClick(); save.props.onClick(); assert.equal(calls, 1);
});
test('film actual component submits its authoritative open revision', () => {
 let body: any;
 const f = fixture(async (_url, options) => { body = JSON.parse(String(options?.body)); return new Promise<Response>(() => {}); }, 'film', (() => 0) as any);
 f.button().props.onClick(); assert.deepEqual(body.editorRevision, revision);
});

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function ack(body: any, before: any) {
 const next = { ...body.editorRevision, updatedAt: new Date(Date.parse(body.editorRevision.updatedAt ?? '1970-01-01T00:00:00.000Z') + 1000).toISOString() };
 const settings = Object.fromEntries(Object.keys(before).map(k => [k, body[k]]));
 const media = Object.fromEntries(['video', 'poster'].map(kind => {
  const prefix = kind === 'video' ? 'featuredFilmVideo' : 'featuredFilmPoster';
  const key = settings[prefix + 'StorageKey'], url = settings[prefix + 'Url'];
  return [kind, { key, url, kind, workspaceId: next.workspaceId, verification: !key && !url ? 'empty' : key === before[prefix + 'StorageKey'] && url === before[prefix + 'Url'] ? 'retained' : 'registered' }];
 }));
 return { success: true, settings, acknowledgement: { protocol: 1, requestId: body.requestId, scope: 'featured-film', previousRevision: body.editorRevision, revision: next, media } };
}
const edit = (f: ReturnType<typeof fixture>) => f.render().find(e => e.type === 'input' && typeof e.props.value === 'string')!;
const copy = (f: ReturnType<typeof fixture>) => f.render().find(e => e.type === 'textarea')!;

test('film freezes admitted input, rejects old callbacks and advances confirmed revision', async () => {
 const bodies: any[] = []; let finish!: (r: Response) => void;
 const f = fixture(async (_u, options) => { bodies.push(JSON.parse(String(options?.body))); return new Promise<Response>(r => { finish = r; }); });
 const old = f.button(); edit(f).props.onChange({ target: { value: '/draft' } }); old.props.onClick(); assert.equal(bodies.length, 0);
 const frozenEdit = edit(f); const save = f.button(); save.props.onClick(); save.props.onClick(); frozenEdit.props.onChange({ target: { value: '/lost' } });
 assert.equal(edit(f).props.value, '/draft'); assert.equal(edit(f).props.disabled, true);
 f.render().find(e => e.props.type === 'file')!.props.onChange({ target: { files: [{ name: 'a.mp4', type: 'video/mp4', size: 1 }], value: '' } });
 assert.equal(bodies.length, 1, 'upload cannot enter during save');
 finish(Response.json(ack(bodies[0], f.initialSettings))); await tick();
 assert.equal(edit(f).props.value, '/draft'); assert.equal(f.hasWarning(), false); save.props.onClick(); assert.equal(bodies.length, 1);
 f.button().props.onClick(); assert.equal(bodies[1].editorRevision.updatedAt, '2026-09-17T00:00:01.000Z');
 finish(Response.json(ack(bodies[1], f.initialSettings))); await tick();
});

test('film holds independent malformed acknowledgement cases, keeps drafts and requires explicit copy before reload', async () => {
 const mutations: Record<string, (d: any) => void> = {
  identity: d => { d.acknowledgement.revision.id = 'other'; }, workspace: d => { d.acknowledgement.revision.workspaceId = 'a'; },
  owner: d => { d.acknowledgement.revision.storedWorkspaceId = 'a'; }, stale: d => { d.acknowledgement.revision.updatedAt = revision.updatedAt; },
  malformedRevision: d => { d.acknowledgement.revision.updatedAt = 'bad'; }, scope: d => { d.acknowledgement.scope = 'full'; },
  operation: d => { d.acknowledgement.requestId = 'other'; }, previous: d => { d.acknowledgement.previousRevision = { ...revision, id: 'other' }; },
  legacy: d => { delete d.acknowledgement; }, intent: d => { d.settings.featuredFilmEnabled = true; },
  destination: d => { d.settings.featuredFilmDestination = '/foreign'; }, proof: d => { d.acknowledgement.media.video.workspaceId = 'a'; },
  key: d => { d.settings.featuredFilmVideoStorageKey = 'workspaces/a/site-featured-film/video-new.mp4'; },
 };
 for (const mode of [...Object.keys(mutations), 'conflict', 'network', 'json']) {
  let calls = 0;
  const f = fixture(async (_u, options) => { calls++; if (mode === 'network') throw new Error('lost'); if (mode === 'json') return new Response('not JSON');
   const data = ack(JSON.parse(String(options?.body)), f.initialSettings); mutations[mode]?.(data); return Response.json(data, { status: mode === 'conflict' ? 409 : 200 }); });
  edit(f).props.onChange({ target: { value: '/retained' } }); f.button().props.onClick(); await tick();
  assert.ok(copy(f), mode); assert.match(copy(f).props.value, /retained/); assert.equal(f.button().props.disabled, true);
  f.button().props.onClick(); assert.equal(calls, 1); const reload = f.render().find(e => e.props.children === 'Reload saved film')!;
  reload.props.onClick(); assert.equal(f.reloads(), 0);
  f.render().find(e => e.props['aria-label'] === 'I have preserved my film copy')!.props.onChange({ target: { checked: true } });
  f.render().find(e => e.props.children === 'Reload saved film')!.props.onClick(); assert.equal(f.reloads(), 1); assert.equal(calls, 1);
 }
});

test('film fetch and JSON timeouts fence late settlements and old remount callbacks', async () => {
 for (const mode of ['fetch', 'json']) {
  let fire!: () => void, finish!: (value: any) => void, body: any;
  const timer = ((fn: () => void) => { fire = fn; return 0; }) as any;
  const f = fixture(async (_u, options) => { body = JSON.parse(String(options?.body)); return mode === 'fetch' ? new Promise<Response>(r => { finish = r; }) : { ok: true, json: () => new Promise(r => { finish = r; }) } as Response; }, 'film', timer);
  f.button().props.onClick(); await tick(); fire(); await tick(); assert.ok(copy(f), mode);
  const data = ack(body, f.initialSettings); finish(mode === 'fetch' ? Response.json(data) : data); await tick(); assert.ok(copy(f));
  f.unmount(); const fresh = fixture(async () => { throw new Error('must not write'); }); assert.equal(edit(fresh).props.value, '/portfolio');
  f.button().props.onClick(); assert.equal(edit(fresh).props.value, '/portfolio');
 }
});

function uploadHarness(phase: 'presign' | 'transfer' | 'save', failure = false) {
 let finish!: (r?: any) => void; const calls: any[] = []; let transfers = 0;
 class XHR { upload = {}; status = 200; onload = () => {}; onabort = () => {}; open() {} setRequestHeader() {} abort() { this.onabort(); } send() { transfers++; if (phase === 'transfer') finish = () => this.onload(); else this.onload(); } }
 const f = fixture(async (url, options) => {
  const body = JSON.parse(String(options?.body)); calls.push({ url, body });
  if (String(url).endsWith('/presign')) {
   const key = `workspaces/b/site-featured-film/${body.kind}-new.${body.kind === 'video' ? 'mp4' : 'webp'}`;
   const result = Response.json({ success: true, upload: { key, publicUrl: `https://assets.test/${key}`, uploadUrl: 'https://upload.test/object', contentType: body.fileType }, acknowledgement: { protocol: 1, requestId: body.requestId, workspaceId: 'b', kind: body.kind, key, publicUrl: `https://assets.test/${key}`, registered: true } });
   if (phase === 'presign') return new Promise<Response>(r => { finish = () => r(result); }); return result;
  }
  if (failure) throw new Error('ack lost');
  return Response.json(ack(body, f.initialSettings));
 }, 'film', setTimeout, revision, { XMLHttpRequest: XHR });
 return { f, calls, finish: () => finish(), transfers: () => transfers };
}
function startUpload(f: ReturnType<typeof fixture>, kind: 'video' | 'poster') {
 const input = f.render().find(e => e.props.type === 'file' && e.props.accept.startsWith(kind === 'video' ? 'video/' : 'image/'))!;
 input.props.onChange({ target: { files: [{ name: 'test', type: kind === 'video' ? 'video/mp4' : 'image/webp', size: 1 }], value: '' } }); return input;
}

test('film upload admission preserves prepared references after lost acknowledgement without replay', async () => {
 for (const kind of ['video', 'poster'] as const) {
  const h = uploadHarness('save', true); const input = startUpload(h.f, kind); h.f.button().props.onClick(); input.props.onChange({ target: { files: [{ type: 'video/mp4', size: 1 }], value: '' } });
  await tick(); await tick(); assert.equal(h.calls.length, 2); assert.equal(h.transfers(), 1); assert.match(copy(h.f).props.value, new RegExp(kind + '-new')); assert.equal(h.f.button().props.disabled, true);
 }
});
test('film late presign or transfer after navigation cannot attach to a remounted editor', async () => {
 for (const phase of ['presign', 'transfer'] as const) {
  const h = uploadHarness(phase); startUpload(h.f, 'video'); await tick(); h.f.unmount(); h.finish(); await tick();
  assert.equal(h.calls.length, 1); assert.equal(h.transfers(), phase === 'presign' ? 0 : 1);
 }
});
test('film replacement and removal confirm explicit media identity and retain attempted removal after uncertainty', async () => {
 for (const kind of ['video', 'poster'] as const) {
  const h = uploadHarness('save'); startUpload(h.f, kind); await tick(); await tick(); assert.equal(h.f.button().props.disabled, false);
  assert.ok(h.f.render().some(e => typeof e.props.children === 'string' && /saved and confirmed/.test(e.props.children)));
 }
 const initial = { featuredFilmEnabled: true, featuredFilmVideoStorageKey: 'legacy.mp4', featuredFilmVideoUrl: 'https://assets.test/legacy.mp4', featuredFilmPosterStorageKey: 'legacy.webp', featuredFilmPosterUrl: 'https://assets.test/legacy.webp' };
 for (const kind of ['film', 'poster']) {
  let body: any;
  const f = fixture(async (_u, options) => { body = JSON.parse(String(options?.body)); throw new Error('lost'); }, 'film', setTimeout, revision, {}, initial);
  f.render().find(e => e.props.children === `Remove ${kind} reference`)!.props.onClick(); await tick();
  assert.equal(kind === 'film' ? body.featuredFilmVideoUrl : body.featuredFilmPosterUrl, null);
  if (kind === 'film') assert.equal(body.featuredFilmEnabled, false);
  assert.ok(copy(f)); assert.equal(f.button().props.disabled, true);
 }
});

test('film accepts unchanged legacy media, nullable ownership and creation', async () => {
 for (const stored of [null, 'b']) {
  for (const updatedAt of [null, revision.updatedAt]) {
   const f = fixture(async (_u, options) => Response.json(ack(JSON.parse(String(options?.body)), f.initialSettings)), 'film', setTimeout, { ...revision, storedWorkspaceId: stored, updatedAt });
   f.button().props.onClick(); await tick(); assert.equal(f.button().props.disabled, false);
  }
 }
 const initial = { featuredFilmVideoStorageKey: 'site/old.mp4', featuredFilmVideoUrl: 'https://assets.test/site/old.mp4' };
 const f = fixture(async (_u, options) => Response.json(ack(JSON.parse(String(options?.body)), f.initialSettings)), 'film', setTimeout, revision, {}, initial);
 f.button().props.onClick(); await tick(); assert.equal(f.button().props.disabled, false);
});
