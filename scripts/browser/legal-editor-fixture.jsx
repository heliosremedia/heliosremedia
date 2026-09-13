// Real editor with synthetic responses only. Never mounted in the application.
import React from 'react';
import { createRoot } from 'react-dom/client';
import LegalDocumentsManager from '../../app/admin/settings/LegalDocumentsManager';

const row = { id: 'privacy-one', type: 'PRIVACY_POLICY', title: 'Privacy', content: '<p>Synthetic reviewed privacy copy</p>', published: false, updatedAt: '2026-09-13T00:00:00.000Z' };
const state = window.legalFixture = { calls: [], mode: 'success', pending: null, committed: null };
window.fetch = async (url, options = {}) => {
  if (url !== '/api/admin/legal-documents' || options.method !== 'PATCH') throw new Error('Unexpected synthetic request');
  const submitted = JSON.parse(options.body);
  state.calls.push({ ...submitted, headers: options.headers });
  await new Promise(resolve => { state.pending = resolve; }); state.pending = null;
  const document = { ...submitted, id: submitted.updatedAt === new Date(0).toISOString() ? 'new-owned-id' : submitted.id, title: submitted.title.trim(), content: '<p>' + 'Sanitized synthetic copy. '.repeat(10) + '</p>', updatedAt: new Date(Date.parse(submitted.updatedAt) + 1000).toISOString() };
  state.committed = document;
  if (state.mode === 'lost-ack') throw new Error('PRIVATE lost response');
  if (state.mode === 'conflict' || state.mode === 'forbidden') return Response.json({ success: false, error: 'PRIVATE failure' }, { status: state.mode === 'conflict' ? 409 : 403 });
  if (state.mode === 'non-json') return new Response('PRIVATE malformed response');
  if (state.mode === 'foreign') document.id = 'foreign';
  if (state.mode === 'stale') document.updatedAt = submitted.updatedAt;
  if (state.mode === 'wrong-publication') document.published = !submitted.published;
  return Response.json({ success: true, ...(state.mode === 'legacy' ? {} : { revisionProtocol: 1 }), document });
};
createRoot(document.getElementById('root')).render(<LegalDocumentsManager initialDocuments={[
  row, { ...row, id: 'legal-terms-of-service', type: 'TERMS_OF_SERVICE', title: 'Terms', updatedAt: new Date(0).toISOString() },
]} />);
