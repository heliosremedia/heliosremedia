// Actual project/card editors. Transport and upload are synthetic; no hosted/provider claims.
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomepageProjectManager from '../../app/admin/homepage/HomepageProjectManager';
import HomepageWorkCardManager from '../../app/admin/homepage/HomepageWorkCardManager';
const card = (id, order) => ({ id, serviceId: 's' + id, titleOverride: 'Title ' + id, destinationOverride: '/portfolio', displayOrder: order, active: true, imageStorageKey: null, imageUrl: null, imageAlt: null, mediaMode: 'IMAGE', featuredMediaId: null, videoStorageKey: null, videoUrl: null, service: { id: 's' + id, name: 'Service ' + id, slug: id, active: true }, featuredMedia: null });
const initialCards = [card('c1', 0), card('c2', 1)];
const placement = { id: 'p1', projectId: 'project1', titleOverride: 'Project title', displayOrder: 0, active: true, imageUrl: null, project: { title: 'Project', slug: 'project', status: 'PUBLISHED', locationLabel: null, heroMedia: null } };
const state = window.curationFixture = { mode: 'success', calls: [], pending: null, jsonPending: null, presignPending: null, transferPending: null, uploads: 0, presigns: 0, slowTransfer: false, sequence: 0, cards: initialCards, placements: [placement] };
window.fetch = async (url, options = {}) => {
 const body = options.body ? JSON.parse(options.body) : {};
 if (url.endsWith('/presign')) {
  state.presigns++; await new Promise(r => { state.presignPending = r; });
  const key = `workspaces/a/homepage-work-cards/${body.cardId}/${body.kind}-test.webp`, url = location.origin + '/'+key;
  const result = {success:true,upload:{key,publicUrl:url,uploadUrl:'https://upload.test/object',contentType:body.fileType},media:{protocol:1,intent:'prepare',workspaceId:'a',cardId:body.cardId,kind:body.kind,key,url,mediaId:key,assetId:'asset1',verification:'registered'},acknowledgement:{protocol:1,workspaceId:'a',scope:'work-cards',requestId:options.headers['x-curation-request'],previousRevision:options.headers['x-curation-revision'],revision:options.headers['x-curation-revision'],ids:state.cards.map(row=>row.id)}};
  if(state.mode==='upload-company')result.media.workspaceId='b';
  if(state.mode==='upload-card')result.media.cardId='c2';
  if(state.mode==='upload-url')result.media.url=location.origin+'/other';
  if(state.mode==='upload-unregistered')result.media.verification='pending';
  return Response.json(result);
 }
 state.calls.push({ url, body, headers: options.headers, method: options.method }); await new Promise(r => { state.pending = r; }); state.pending = null;
 const scope = url.includes('homepage-projects') ? 'projects' : 'work-cards', isProject = scope === 'projects';
 let rows = isProject ? state.placements : state.cards;
 const id = body.cardId || body.placementId || new URL(url, location.origin).searchParams.get(isProject ? 'placementId' : 'cardId');
 let result = { success: true };
 if (options.method === 'DELETE') { rows = rows.filter(row => row.id !== id); result[isProject ? 'deletedPlacementId' : 'deletedCardId'] = id; }
 else if (body.action === 'reorder') { rows = body.cardIds.map((id, i) => ({ ...rows.find(row => row.id === id), displayOrder: i })); result.cardIds = rows.map(row => row.id); }
 else if (options.method === 'POST') { const row = isProject ? placement : card('c3', rows.length); rows = [...rows, row]; result[isProject ? 'placement' : 'card'] = row; }
 else { rows = rows.map(row => row.id === id ? { ...row, ...body } : row); result[isProject ? 'placement' : 'card'] = rows.find(row => row.id === id); }
 if (isProject) state.placements = rows; else state.cards = rows;
 const ack = { protocol: 1, requestId: options.headers['x-curation-request'], scope, workspaceId: 'a', previousRevision: options.headers['x-curation-revision'], revision: (++state.sequence).toString(16).padStart(64,'0'), ids: rows.map(row => row.id) };
 result.acknowledgement = ack;
 if(result.card && options.method==='PATCH')result.media={protocol:1,intent:'attach',cardId:result.card.id,...Object.fromEntries(['image','video'].map(kind=>{const key=result.card[kind+'StorageKey'],url=result.card[kind+'Url'];return [kind,{workspaceId:'a',cardId:result.card.id,kind,key,url,mediaId:key,assetId:key?'asset1':null,verification:key?'registered':'empty'}];}))};
 if(state.mode==='attachment-asset' && result.media)result.media.image.assetId='other';
 if (state.mode === 'lost') throw new Error('PRIVATE lost response');
 if (state.mode === 'non-json') return new Response('PRIVATE invalid JSON');
 if (state.mode === 'conflict') return Response.json({ success: false }, { status: 409 });
 if (state.mode === 'company') ack.workspaceId = 'other';
 if (state.mode === 'revision') ack.revision = ack.previousRevision;
 if (state.mode === 'request') ack.requestId = 'older';
 if (state.mode === 'identity' && result.card) result.card = { ...result.card, id: 'other' };
 if (state.mode === 'order') ack.ids = [...ack.ids].reverse();
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
const root = createRoot(document.getElementById('root')); let instance = 0;
function render() { root.render(<React.Fragment key={instance}><section aria-label="Featured project editor"><HomepageProjectManager workspaceId="a" initialRevision={'0'.repeat(64)} initialPlacements={[placement]} projects={[{ id: 'project1', title: 'Project', slug: 'project' }]} /></section><section aria-label="Work cards editor"><HomepageWorkCardManager workspaceId="a" initialRevision={'0'.repeat(64)} initialCards={initialCards} services={[...initialCards.map(row => row.service), card('c3',2).service]} films={[]} /></section></React.Fragment>); }
state.remount = () => { instance++; render(); }; render();
