// Actual editor, synthetic transport only. No provider or authenticated hosted evidence.
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomepageFilmManager from '../../app/admin/homepage/HomepageFilmManager';
import HomepageStructureManager from '../../app/admin/homepage/HomepageStructureManager';
import { defaultSiteSettings } from '../../lib/site-settings';
const revision = { id: 'workspace:b', workspaceId: 'b', storedWorkspaceId: 'b', updatedAt: '2026-09-17T00:00:00.000Z' };
const initial = { featuredFilmEnabled: true, featuredFilmVideoStorageKey: 'legacy.mp4', featuredFilmVideoUrl: 'https://assets.test/legacy.mp4', featuredFilmPosterStorageKey: 'legacy.webp', featuredFilmPosterUrl: 'https://assets.test/legacy.webp', featuredFilmDestination: '/portfolio' };
const state = window.filmFixture = { mode: 'success', calls: [], presigns: 0, uploads: 0, pending: null, presignPending: null, transferPending: null, jsonPending: null, slowTransfer: false, committed: initial };
window.fetch = async (url, options = {}) => {
 const body = JSON.parse(options.body);
 if (url === '/api/admin/homepage-film/presign' && options.method === 'POST') {
  state.lastKind = body.kind; state.presigns++; await new Promise(r => { state.presignPending = r; }); state.presignPending = null;
  const key = `workspaces/b/site-featured-film/${body.kind}-new.${body.kind === 'video' ? 'mp4' : 'webp'}`, publicUrl = `https://assets.test/${key}`;
  const result = { success: true, upload: { key, publicUrl, uploadUrl: 'https://upload.test/object', contentType: body.fileType }, acknowledgement: { protocol: 1, requestId: body.requestId, workspaceId: 'b', kind: body.kind, key, publicUrl, registered: true } };
  if (state.mode === 'foreign-upload') result.acknowledgement.workspaceId = 'a';
  if (state.mode === 'unregistered-upload') result.acknowledgement.registered = false;
  return Response.json(result);
 }
 if (url !== '/api/admin/homepage-film' || options.method !== 'PATCH') throw new Error('Unexpected fetch');
 state.calls.push({ ...body, headers: options.headers }); await new Promise(r => { state.pending = r; }); state.pending = null;
 const settings = Object.fromEntries(Object.keys(initial).map(k => [k, body[k]]));
 const next = { ...body.editorRevision, updatedAt: new Date(Date.parse(body.editorRevision.updatedAt) + 1000).toISOString() };
 const media = Object.fromEntries(['video', 'poster'].map(kind => {
  const prefix = kind === 'video' ? 'featuredFilmVideo' : 'featuredFilmPoster', key = settings[prefix + 'StorageKey'], url = settings[prefix + 'Url'];
  return [kind, { kind, workspaceId: 'b', key, url, verification: !key && !url ? 'empty' : key === state.committed[prefix + 'StorageKey'] && url === state.committed[prefix + 'Url'] ? 'retained' : 'registered' }];
 }));
 const ack = { protocol: 1, requestId: body.requestId, scope: 'featured-film', previousRevision: body.editorRevision, revision: next, media };
 state.committed = settings;
 if (state.mode === 'lost-ack') throw new Error('PRIVATE lost response');
 if (state.mode === 'non-json') return new Response('PRIVATE not JSON');
 if (state.mode === 'conflict') return Response.json({ success: false }, { status: 409 });
 if (state.mode === 'foreign-id') ack.revision.id = 'foreign';
 if (state.mode === 'foreign-workspace') ack.revision.workspaceId = 'a';
 if (state.mode === 'foreign-owner') ack.revision.storedWorkspaceId = 'a';
 if (state.mode === 'stale') ack.revision.updatedAt = body.editorRevision.updatedAt;
 if (state.mode === 'invalid-revision') ack.revision.updatedAt = 'invalid';
 if (state.mode === 'wrong-prior') ack.previousRevision = { ...revision, id: 'other' };
 if (state.mode === 'wrong-request') ack.requestId = 'other';
 if (state.mode === 'wrong-scope') ack.scope = 'full';
 if (state.mode === 'wrong-intent') settings.featuredFilmEnabled = !settings.featuredFilmEnabled;
 if (state.mode === 'wrong-media') { settings.featuredFilmVideoStorageKey = media.video.key = 'workspaces/a/site-featured-film/video-new.mp4'; }
 if (state.mode === 'wrong-url') settings.featuredFilmVideoUrl = media.video.url = 'https://foreign.test/video.mp4';
 if (state.mode === 'unregistered') media[state.lastKind ?? 'video'].verification = 'unregistered';
 if (state.mode === 'foreign-proof') media[state.lastKind ?? 'video'].workspaceId = 'a';
 if (state.mode === 'legacy') ack.protocol = 0;
 const result = { success: true, settings, acknowledgement: ack };
 if (state.mode === 'slow-json') return { ok: true, json: () => new Promise(r => { state.jsonPending = () => r(result); }) };
 return Response.json(result);
};
window.XMLHttpRequest = class {
 upload = {}; status = 200;
 open(method, url) { if (method !== 'PUT' || url !== 'https://upload.test/object') throw new Error('Unexpected upload'); }
 setRequestHeader() {}
 send() { state.uploads++; if (state.slowTransfer) state.transferPending = () => this.onload(); else queueMicrotask(() => this.onload()); }
 abort() { this.onabort?.(); }
};
const root = createRoot(document.getElementById('root')); let epoch = 0;
state.remount = () => { epoch++; root.render(<React.Fragment key={epoch}><HomepageFilmManager initialSettings={initial} initialRevision={revision} />{location.search.includes('combined') ? <HomepageStructureManager initialSettings={defaultSiteSettings} initialRevision={revision} mode="navigation" /> : null}</React.Fragment>); };
state.remount();
