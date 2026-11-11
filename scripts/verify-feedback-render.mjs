import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import Module, { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile the actual client component in an isolated process. No APIs, database,
// browser state, or email providers are invoked by these server-render checks.
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
loadModule.extensions['.css'] = function(module, filename) {
  // Stable class names let us inspect semantic markup without copying the UI.
  const names = [...fs.readFileSync(filename, 'utf8').matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => match[1]);
  module.exports = Object.fromEntries(names.map(name => [name, name]));
};
const Workspace = loadModule(path.join(repo, 'app/admin/feedback/FeedbackWorkspace.tsx')).default;
const { FEEDBACK_SURVEY } = loadModule(path.join(repo, 'lib/feedback.ts'));
const clients = [
  { id: 'one', displayName: 'Alex Example', email: 'alex@example.com', groupIds: ['g1'], isOriginalRecipient: true },
  { id: 'two', displayName: 'Sam Sample', email: 'sam@example.com', groupIds: [], isOriginalRecipient: false },
];
const base = { survey: FEEDBACK_SURVEY, clients, groups: [{ id: 'g1', name: 'Sample group', count: 1 }], originalCampaign: null, reminders: [], defaultTestEmail: 'qa@example.com' };
const render = dashboard => renderToStaticMarkup(React.createElement(Workspace, { initialDashboard: dashboard }));
const reminder = (id, status, extra = {}) => ({ id, status, subject: `${status} reminder`, previewText: '', body: 'Hello {{FIRST_NAME}}', mode: 'ORIGINAL', recipientCount: 2, sentCount: 0, failedCount: 0, scheduledAt: null, scheduledTimeZone: null, rowVersion: 1, selection: { feedbackSurveyId: FEEDBACK_SURVEY.id, workspaceId: 'fixture', originalCampaignId: FEEDBACK_SURVEY.originalCampaignId, groupIds: [], clientIds: [] }, createdAt: '2026-11-10T18:00:00.000Z', sentAt: null, scheduleError: null, ...extra });

const blank = render(base);
assert.match(blank, /aria-label="Feedback sections"/);
assert.match(blank, /aria-pressed="true"[^>]*>Overview/);
assert.match(blank, /aria-pressed="false"[^>]*>Reminders/);
assert.match(blank, /<div hidden=""><div class="split"><div><h2[^>]*>Reminder plan/);
assert.match(blank, /No reminders yet/);
assert.match(blank, /Original invitation is not available/);
assert.match(blank, /Creating a draft never sends email/);
assert.doesNotMatch(blank, /role="dialog"|<iframe|<form/);
assert.match(blank, /Studio cannot identify respondents or exclude people who have already answered/);
assert.match(blank, /Opens and clicks are not completion signals/);
assert.match(blank, /Responses stay in Google Forms/);
for (const url of [FEEDBACK_SURVEY.formUrl, FEEDBACK_SURVEY.resultsUrl]) {
  assert.ok(blank.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`), 'Google links are direct, safe new-tab links');
}

const history = render({ ...base, originalCampaign: { id: 'original', subject: 'Original', recipientCount: 4, sentCount: 3, sentAt: '2026-11-10T18:00:00.000Z', eligibleRecipientCount: 2 }, reminders: [
  reminder('draft', 'DRAFT'),
  reminder('scheduled', 'SCHEDULED', { mode: 'GROUPS', scheduledAt: '2026-11-20T18:00:00.000Z', scheduledTimeZone: 'America/Denver' }),
  reminder('sent', 'SENT', { mode: 'INDIVIDUALS', sentAt: '2026-11-10T18:00:00.000Z', sentCount: 2 }),
  reminder('cancelled', 'CANCELLED', { mode: 'ALL' }),
  reminder('failed', 'FAILED', { scheduleError: 'Delivery needs attention.' }),
] });
assert.match(history, /Original invitation · accepted<\/dt><dd>3<\/dd>/);
assert.match(history, /Scheduled reminders<\/dt><dd>1<\/dd>/);
assert.match(history, /Reminder drafts<\/dt><dd>1<\/dd>/);
assert.match(history, /Draft · inactive/);
assert.match(history, /Audience checked when scheduled/);
assert.match(history, /Nov 20, 2026, 11:00 AM MST/);
assert.match(history, /Provider acceptance is not confirmed inbox delivery/);
assert.match(history, /2 provider accepted · 0 failed/);
assert.match(history, /Delivery needs attention/);
assert.equal((history.match(/>Edit draft<\/button>/g) || []).length, 1);
assert.equal((history.match(/>Pause to edit<\/button>/g) || []).length, 1);
assert.equal((history.match(/>Cancel<\/button>/g) || []).length, 2);
for (const label of ['Original invitation audience', 'Selected groups', 'Selected clients', 'All eligible clients']) assert.ok(history.includes(label));

const escaped = render({ ...base, reminders: [reminder('draft', 'DRAFT', { subject: '<script>alert("unsafe")</script>', scheduleError: '<img src=x onerror=alert(1)>' })] });
assert.match(escaped, /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;/);
assert.match(escaped, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(escaped, /<script>|<img src=x/);

const many = render({ ...base, reminders: Array.from({ length: 20 }, (_, index) => reminder(`draft-${index}`, 'DRAFT')) });
assert.match(many, /Reminder drafts<\/dt><dd>20<\/dd>/);
assert.equal((many.match(/>Edit draft<\/button>/g) || []).length, 20);
console.log('PASS: actual FeedbackWorkspace React SSR; empty and populated history; inactive drafts; timezone; status-specific controls; safe Google links; anonymous-response limits; escaped copy; multiple independent reminders.');
