import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// This isolated test process compiles the real client components for server rendering.
const repo = fileURLToPath(new URL('..', import.meta.url));
const loadModule = createRequire(import.meta.url);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(repo, request.slice(2)) : request, parent, ...args);
};
for (const ext of ['.tsx', '.ts']) loadModule.extensions[ext] = function(module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  module._compile(result.outputText, filename);
};
const Studio = loadModule(path.join(repo, 'app/admin/email-studio/BulkEmailStudio.tsx')).default;
const Tabs = loadModule(path.join(repo, 'app/admin/components/AdminWorkspaceTabs.tsx')).default;
const Summary = loadModule(path.join(repo, 'app/admin/components/AdminSummaryCards.tsx')).default;
const clients = [
  { id: 'one', firstName: 'Alex', lastName: 'Example', displayName: 'Alex Example', email: 'alex@example.com', phone: null, groupIds: ['g1'] },
  { id: 'two', firstName: 'Sam', lastName: 'Sample', displayName: 'Sam Sample', email: 'sam@example.com', phone: null, groupIds: [] },
];
const base = { clients, groups: [{ id: 'g1', name: 'Sample group', count: 1 }], campaigns: [], canSend: false, defaultTestEmail: 'qa@example.com', deliveryHealth: React.createElement('p', {}, 'Synthetic health report') };
const blank = renderToStaticMarkup(React.createElement(Studio, base));
assert.match(blank, /id="email-studio-tab-compose"[^>]*aria-selected="true"/);
assert.match(blank, /id="email-studio-panel-campaigns"[^>]*hidden=""/);
assert.match(blank, /id="email-studio-panel-health"[^>]*hidden=""/);
assert.doesNotMatch(blank, /id="email-studio-panel-compose"[^>]*hidden=/);
assert.match(blank, /2 eligible/);
assert.match(blank, /No campaigns yet/);
const initialDraft = { id: 'draft', subject: 'Saved group draft', previewText: '', body: 'Hello {{FIRST_NAME}}', templateKey: 'HELIOS_SIGNATURE', imageUrl: null, imageAlt: null, imageCaption: null, imageLink: null, recipientMode: 'GROUPS', selection: { groupIds: ['g1'] } };
const draft = renderToStaticMarkup(React.createElement(Studio, { ...base, initialDraft }));
assert.match(draft, /1 eligible/);
assert.match(draft, /aria-pressed="true"[^>]*>Groups</);
assert.match(draft, /value="Saved group draft"/);
assert.match(draft, /Hello \{\{FIRST_NAME\}\}/);
assert.match(draft, /Sample group/);
const individual = renderToStaticMarkup(React.createElement(Studio, { ...base, initialDraft: { ...initialDraft, recipientMode: 'INDIVIDUALS', selection: { clientIds: ['two'] } } }));
assert.match(individual, /1 eligible/);
assert.match(individual, /aria-pressed="true"[^>]*>Individuals</);
const tabs = renderToStaticMarkup(React.createElement(Tabs, { idPrefix: 'sample', label: 'Example workspace', items: [{ id: 'one', label: 'First' }, { id: 'two', label: 'Second' }], value: 'two', onChange: () => {} }));
assert.match(tabs, /id="sample-tab-one"[^>]*tabindex="-1"/);
assert.match(tabs, /id="sample-tab-two"[^>]*tabindex="0"/);
const summaryDefault = renderToStaticMarkup(React.createElement(Summary, { items: [{ label: 'Count', value: 2 }] }));
const summaryCompact = renderToStaticMarkup(React.createElement(Summary, { items: [{ label: 'Count', value: 2 }], compact: true }));
assert.doesNotMatch(summaryDefault, /admin-summary-compact/);
assert.match(summaryCompact, /admin-summary-compact/);
console.log('PASS: actual React SSR for blank, group-draft, and individual-draft composer; selected/hidden view semantics; recipient counts; reusable tab IDs; compact summary opt-in.');
