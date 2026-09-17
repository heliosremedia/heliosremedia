// Actual settings editors. All writes and media transfers are synthetic, on loopback only.
import React from 'react';
import { createRoot } from 'react-dom/client';
import SiteSettingsForm from '../../app/admin/settings/SiteSettingsForm';
import HomepageStructureManager from '../../app/admin/homepage/HomepageStructureManager';
import { defaultSiteSettings } from '../../lib/site-settings';

const revision = { id: 'workspace:b', workspaceId: 'b', storedWorkspaceId: 'b', updatedAt: '2026-09-17T00:00:00.000Z' };
const initial = { ...defaultSiteSettings, id: revision.id, heroPosterUrl: null, heroVideoUrl: null,
  heliosStandardImageUrl: null, primaryConversionImageUrl: null, businessName: 'Synthetic Company B' };
const state = window.settingsFixture = { calls: [], mode: 'success', pending: null, jsonPending: null, uploads: 0, presigns: 0, presignPending: null, committed: null };
window.fetch = async (url, options = {}) => {
  if (url.startsWith('/api/admin/site-settings/') && url.endsWith('/presign') && options.method === 'POST') {
    state.presigns++;
    await new Promise(resolve => { state.presignPending = resolve; }); state.presignPending = null;
    return Response.json({ success: true, upload: { key: 'workspaces/b/synthetic/image.png', publicUrl: '/synthetic-image.svg', uploadUrl: '/synthetic-upload', contentType: 'image/png' } });
  }
  if (url !== '/api/admin/site-settings' || options.method !== 'PATCH') throw new Error('Unexpected synthetic fetch');
  const body = JSON.parse(options.body); state.calls.push({ ...body, headers: options.headers });
  await new Promise(resolve => { state.pending = resolve; }); state.pending = null;
  const next = { ...body.editorRevision, updatedAt: new Date(Date.parse(body.editorRevision.updatedAt) + 1000).toISOString() };
  const settings = { ...initial, ...body, ...(body.navigation ? { headerNavigation: body.navigation, footerNavigation: body.navigation } : {}), id: next.id, workspaceId: next.storedWorkspaceId, updatedAt: next.updatedAt };
  const ack = { protocol: 1, requestId: body.requestId, scope: body.updateScope ?? 'full', previousRevision: body.editorRevision, revision: next };
  state.committed = settings;
  if (state.mode === 'lost-ack') throw new Error('PRIVATE transport');
  if (state.mode === 'non-json') return new Response('PRIVATE malformed');
  if (state.mode === 'conflict') return Response.json({ success: false, error: 'PRIVATE stale state' }, { status: 409 });
  if (state.mode === 'foreign-id') settings.id = 'foreign';
  if (state.mode === 'foreign-workspace') ack.revision.workspaceId = 'a';
  if (state.mode === 'foreign-row') settings.workspaceId = 'a';
  if (state.mode === 'wrong-scope') ack.scope = 'other';
  if (state.mode === 'wrong-request') ack.requestId = 'other';
  if (state.mode === 'wrong-prior') ack.previousRevision = { ...revision, updatedAt: new Date(0).toISOString() };
  if (state.mode === 'stale') ack.revision.updatedAt = settings.updatedAt = body.editorRevision.updatedAt;
  if (state.mode === 'invalid-revision') ack.revision.updatedAt = settings.updatedAt = 'invalid';
  if (state.mode === 'legacy') ack.protocol = 0;
  const result = { success: true, settings, acknowledgement: ack };
  if (state.mode === 'slow-json') return { ok: true, json: () => new Promise(resolve => { state.jsonPending = () => resolve(result); }) };
  return Response.json(result);
};
window.XMLHttpRequest = class SyntheticUpload extends EventTarget {
  upload = new EventTarget(); status = 200;
  open(method, url) { if (method !== 'PUT' || url !== '/synthetic-upload') throw new Error('Unexpected synthetic upload'); }
  setRequestHeader() {}
  send() { state.uploads++; queueMicrotask(() => { this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')); }); }
  abort() { this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend')); }
};
const root = createRoot(document.getElementById('root'));
let epoch = 0;
const mode = new URLSearchParams(location.search).get('form') ?? 'navigation';
const editor = (form, key) => <section key={key} data-editor={form}>{form === 'global' || form === 'homepage'
  ? <SiteSettingsForm initialSettings={initial} initialRevision={revision} mode={form}
      brandIdentityAddon={<label>Independent brand tool<input aria-label="Independent brand tool" /></label>}
      legalAddon={<label>Independent legal tool<input aria-label="Independent legal tool" /></label>} />
  : <HomepageStructureManager initialSettings={initial} initialRevision={revision} mode={form} />}</section>;
state.remount = () => { epoch++; root.render(mode === 'combined' ? ['navigation', 'homepage', 'structure'].map(form => editor(form, `${epoch}-${form}`)) : editor(mode, epoch)); };
state.remount();
