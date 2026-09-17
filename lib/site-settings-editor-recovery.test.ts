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
function fixture(fetcher: typeof fetch, mode = 'navigation', timer = setTimeout, revisionOverride = revision) {
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
      window: { addEventListener(name: string, fn: () => void) { listeners.set(name, fn); }, removeEventListener(name: string) { listeners.delete(name); }, location: { reload() { reloads++; } } },
      require: (id: string) => {
        if (id in modules) return modules[id];
        if (id.startsWith('@/app/admin/settings/')) return modules[id] = load(id.replace('@/', '') + (id.endsWith('settingsDraftCopies') ? '.ts' : '.tsx'));
        if (id.startsWith('@/lib/site-settings-editor')) return modules[id] = load(id.replace('@/', '') + '.ts');
        assert.fail(`Unexpected dependency ${id}`);
      } });
    return exports;
  }
  // Evaluate only the real default data, without loading its server imports.
  const defaultsSource = readFileSync('lib/site-settings.ts', 'utf8').replace(/^import .*;\n/gm, '').split('export async function getSiteSettings')[0];
  const defaults: any = {};
  runInNewContext(ts.transpileModule(defaultsSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: defaults });
  const initialSettings = { ...defaults.defaultSiteSettings, id: revision.id };
  const component = load(mode === 'global' || mode === 'homepage' ? 'app/admin/settings/SiteSettingsForm.tsx' : 'app/admin/homepage/HomepageStructureManager.tsx').default;
  const render = () => { cursor = 0; return elements(component({ initialSettings, initialRevision: revisionOverride, mode })); };
  const button = () => render().find(e => e.type === 'button' && /^Save (settings|Homepage Settings|navigation|structure)$/.test(e.props.children))!;
  return { render, button, initialSettings, reloads: () => reloads, hasWarning: () => listeners.has('beforeunload'), unmount: () => cleanups.forEach(cleanup => cleanup()) };
}

test('settings actual component admits duplicate save callbacks synchronously only once', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return new Promise<Response>(() => {}); }, 'navigation', (() => 0) as any);
  const save = f.button(); save.props.onClick(); save.props.onClick();
  assert.equal(calls, 1);
});

test('settings actual component sends the revision of its open browser state', async () => {
  let submitted: any;
  const f = fixture(async (_url, options) => { submitted = JSON.parse(String(options?.body)); return new Promise<Response>(() => {}); }, 'navigation', (() => 0) as any);
  f.button().props.onClick();
  assert.deepEqual(submitted.editorRevision, revision);
});

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const modes = ['global', 'homepage', 'navigation', 'structure'];
function field(f: ReturnType<typeof fixture>, mode: string) {
  return f.render().find(e => mode === 'navigation' ? e.props['aria-label'] === 'Navigation label'
    : mode === 'structure' ? e.props['aria-label'] === 'Card title'
    : e.type === 'input' && e.props.value === (mode === 'global' ? f.initialSettings.businessName : f.initialSettings.heroPosterAlt))!;
}
function acknowledgement(body: any, settings: any) {
  const nextRevision = { ...body.editorRevision, updatedAt: new Date(Date.parse(body.editorRevision.updatedAt ?? '1970-01-01T00:00:00.000Z') + 1000).toISOString() };
  return { success: true, acknowledgement: { protocol: 1, requestId: body.requestId, scope: body.updateScope ?? 'full', previousRevision: body.editorRevision, revision: nextRevision },
    settings: { ...settings, ...body, ...(body.navigation ? { headerNavigation: body.navigation, footerNavigation: body.navigation } : {}), id: nextRevision.id, workspaceId: nextRevision.storedWorkspaceId, updatedAt: nextRevision.updatedAt } };
}

test('all settings form modes freeze input, fence stale callbacks and advance acknowledged revisions', async () => {
  for (const mode of modes) {
    const requests: any[] = []; let finish!: (r: Response) => void;
    const f = fixture(async (_url, options) => { requests.push(JSON.parse(String(options?.body))); return new Promise<Response>(resolve => { finish = resolve; }); }, mode);
    const oldSave = f.button(); const edit = field(f, mode);
    assert.equal(f.hasWarning(), false);
    assert.ok(edit, mode); edit.props.onChange({ target: { value: 'Retain drafted text' } });
    oldSave.props.onClick(); assert.equal(requests.length, 0, 'pre-edit callback cannot submit old values');
    const capturedEdit = f.render().find(e => e.props.value === 'Retain drafted text')!;
    assert.equal(f.hasWarning(), true);
    const save = f.button(); save.props.onClick(); save.props.onClick();
    assert.equal(requests.length, 1, mode); assert.deepEqual(requests[0].editorRevision, revision);
    edit.props.onChange({ target: { value: 'Late overwritten value' } });
    capturedEdit.props.onChange({ target: { value: 'Edit during save' } });
    assert.ok(f.render().some(e => e.props.value === 'Retain drafted text'), 'accepted pre-save text stays frozen');
    assert.ok(f.render().some(e => (e.type === 'fieldset' || e.type === 'input') && e.props.disabled === true));
    finish(Response.json(acknowledgement(requests[0], f.initialSettings))); await tick();
    assert.ok(f.render().some(e => e.props.value === 'Retain drafted text'), mode);
    assert.equal(f.hasWarning(), false, 'confirmed values clear the navigation warning');
    assert.ok(f.render().some(e => typeof e.props.children === 'string' && /saved|published/i.test(e.props.children)));
    save.props.onClick(); assert.equal(requests.length, 1, 'old saved callback cannot replay');
    f.button().props.onClick(); assert.equal(requests.length, 2);
    assert.equal(requests[1].editorRevision.updatedAt, '2026-09-17T00:00:01.000Z');
    finish(Response.json(acknowledgement(requests[1], f.initialSettings))); await tick();
  }
});

test('navigation editing retains new links with duplicate destinations until explicit edits and save', async () => {
  const f = fixture(async (_url, options) => Response.json(acknowledgement(JSON.parse(String(options?.body)), f.initialSettings)));
  const count = () => f.render().filter(e => e.props['aria-label'] === 'Navigation label').length;
  const before = count();
  f.render().find(e => e.type === 'button' && e.props.children === 'Add link')!.props.onClick();
  assert.equal(count(), before + 1);
  assert.ok(f.render().some(e => e.props.value === 'New link'));
  f.button().props.onClick(); await tick();
  assert.equal(count(), before + 1);
});

test('ephemeral recovery collection retains all mounted settings copies and removes unmounted copies', () => {
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('app/admin/settings/settingsDraftCopies.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports });
  let title = 'First draft'; let notifications = 0;
  const unsubscribe = exports.subscribeSettingsCopies(() => notifications++);
  const removeFirst = exports.registerSettingsCopy({}, () => ({ title }));
  const removeSecond = exports.registerSettingsCopy({}, () => ({ title: 'Second draft' }));
  const copied = exports.readSettingsCopies(); assert.match(copied, /First draft/); assert.match(copied, /Second draft/);
  title = 'Later first draft'; exports.refreshSettingsCopies(); assert.notEqual(exports.readSettingsCopies(), copied);
  removeFirst(); assert.doesNotMatch(exports.readSettingsCopies(), /first draft/i);
  removeSecond(); assert.equal(exports.readSettingsCopies(), '[]'); assert.equal(notifications, 5); unsubscribe();
});

test('all six actual settings upload callbacks share synchronous admission and fence unmounted preparation', async () => {
  for (const [mode, index] of [['global', 0], ['global', 1], ['homepage', 0], ['homepage', 1], ['homepage', 2], ['homepage', 3]] as const) {
    const requests: string[] = []; let finish!: (response: Response) => void;
    const f = fixture(async (url) => { requests.push(String(url)); return new Promise<Response>(resolve => { finish = resolve; }); }, mode);
    field(f, mode).props.onChange({ target: { value: 'Draft retained during upload' } });
    const file = f.render().filter(e => e.type === 'input' && e.props.type === 'file')[index];
    const event = () => ({ target: { value: '', files: [{ name: 'synthetic.png', type: 'image/png', size: 10 }] } });
    file.props.onChange(event()); file.props.onChange(event());
    assert.equal(requests.length, 1); assert.match(requests[0], /presign$/);
    assert.ok(f.render().some(e => e.props.value === 'Draft retained during upload' && e.props.disabled === true));
    f.unmount(); finish(Response.json({ success: true, upload: { key: 'synthetic', publicUrl: '/image.png', uploadUrl: '/upload', contentType: 'image/png' } }));
    await tick(); assert.equal(requests.length, 1, 'late presign cannot issue a settings write or start XHR after unmount');
  }
});

test('all settings forms retain drafts and hold mismatched or unknown acknowledgements without retries', async () => {
  for (const mode of modes) for (const kind of ['identity', 'workspace', 'stored-workspace', 'scope', 'request', 'revision', 'prior', 'row-revision', 'invalid-date', 'shape', 'legacy', 'conflict', 'json', 'network']) {
    let calls = 0;
    const f = fixture(async (_url, options) => {
      calls++; const body = JSON.parse(String(options?.body)); const result = acknowledgement(body, f.initialSettings);
      if (kind === 'identity') result.settings.id = 'foreign';
      if (kind === 'workspace') result.acknowledgement.revision.workspaceId = 'a';
      if (kind === 'stored-workspace') result.settings.workspaceId = 'a';
      if (kind === 'scope') result.acknowledgement.scope = 'other';
      if (kind === 'request') result.acknowledgement.requestId = 'other';
      if (kind === 'revision') result.acknowledgement.revision.updatedAt = result.settings.updatedAt = revision.updatedAt;
      if (kind === 'prior') result.acknowledgement.previousRevision = { ...revision, updatedAt: new Date(0).toISOString() };
      if (kind === 'row-revision') result.settings.updatedAt = revision.updatedAt;
      if (kind === 'invalid-date') result.acknowledgement.revision.updatedAt = result.settings.updatedAt = 'invalid';
      if (kind === 'shape') result.settings.standardPrinciples = 'bad';
      if (kind === 'legacy') result.acknowledgement.protocol = 0;
      if (kind === 'json') return new Response('PRIVATE malformed');
      if (kind === 'network') throw new Error('PRIVATE transport');
      if (kind === 'conflict') return Response.json({ success: false, error: 'PRIVATE error' }, { status: 409 });
      return Response.json(result);
    }, mode);
    field(f, mode).props.onChange({ target: { value: 'Preserve this draft' } });
    const save = f.button(); save.props.onClick(); await tick(); save.props.onClick();
    assert.equal(calls, 1, `${mode} ${kind}`);
    const copy = f.render().find(e => e.props['aria-label'] === 'Unsaved settings copy')!;
    assert.ok(copy?.props.readOnly, `${mode} ${kind}`); assert.match(copy.props.value, /Preserve this draft/);
    const alert = f.render().find(e => e.props.role === 'alert')!;
    assert.doesNotMatch(alert.props.children, /PRIVATE/);
    assert.match(alert.props.children, kind === 'conflict' ? /changed since/ : /uncertain/);
    const reload = () => f.render().find(e => e.type === 'button' && e.props.children === 'Reload saved settings')!;
    reload().props.onClick(); assert.equal(f.reloads(), 0);
    f.render().find(e => e.props['aria-label'] === 'I have preserved my settings copy')!.props.onChange({ target: { checked: true } });
    reload().props.onClick(); assert.equal(f.reloads(), 1); assert.equal(calls, 1);
  }
});

test('fetch and JSON timeouts hold retained settings and late settlement cannot release recovery', async () => {
  for (const mode of modes) for (const stage of ['fetch', 'json']) {
    let timeout!: () => void; let finish!: (value: any) => void; let body: any; let calls = 0;
    const f = fixture(async (_url, options) => {
      calls++; body = JSON.parse(String(options?.body));
      if (stage === 'fetch') return new Promise<Response>(resolve => { finish = resolve; });
      return { ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response;
    }, mode, ((fn: () => void) => { timeout = fn; return 0; }) as any);
    field(f, mode).props.onChange({ target: { value: 'Timeout draft' } });
    f.button().props.onClick(); await tick(); timeout(); await tick();
    finish(stage === 'fetch' ? Response.json(acknowledgement(body, f.initialSettings)) : acknowledgement(body, f.initialSettings)); await tick();
    assert.ok(f.render().some(e => e.props.role === 'alert'));
    assert.match(f.render().find(e => e.props['aria-label'] === 'Unsaved settings copy')!.props.value, /Timeout draft/);
    f.button().props.onClick(); assert.equal(calls, 1);
  }
});

test('unmounted settings callbacks cannot write or accept a late response into a newer instance', async () => {
  for (const mode of modes) {
    let finish!: (r: Response) => void; let body: any; let calls = 0;
    const old = fixture(async (_url, options) => { calls++; body = JSON.parse(String(options?.body)); return new Promise<Response>(resolve => { finish = resolve; }); }, mode);
    const oldSave = old.button(); oldSave.props.onClick(); old.unmount();
    const fresh = fixture(async () => { calls++; throw new Error('unexpected'); }, mode);
    field(fresh, mode).props.onChange({ target: { value: 'New instance draft' } });
    finish(Response.json(acknowledgement(body, old.initialSettings))); await tick(); oldSave.props.onClick();
    assert.equal(calls, 1); assert.ok(fresh.render().some(e => e.props.value === 'New instance draft'));
    assert.ok(!fresh.render().some(e => e.props.role === 'alert'));
  }
});

test('full settings acknowledges cleared nullable fields and preserves legacy nullable ownership and creation', async () => {
  for (const old of [{ ...revision, id: 'default', storedWorkspaceId: null }, { ...revision, updatedAt: null }]) {
    let body: any;
    const f = fixture(async (_url, options) => {
      body = JSON.parse(String(options?.body));
      const result = acknowledgement(body, f.initialSettings);
      result.settings.heroPosterAlt = null;
      return Response.json(result);
    }, 'global', setTimeout, old as any);
    f.button().props.onClick(); await tick();
    assert.ok(!f.render().some(e => e.props.role === 'alert'));
    f.button().props.onClick(); await tick();
    assert.notEqual(body.editorRevision.updatedAt, old.updatedAt);
  }
});
