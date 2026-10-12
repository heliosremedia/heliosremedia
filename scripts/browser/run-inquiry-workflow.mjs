import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const scratch = await mkdtemp(join(tmpdir(), 'helios-inquiries-'));
const evidenceDir = join(process.cwd(), 'release-evidence');
const stub = join(scratch, 'next-navigation-stub.js');
const linkStub = join(scratch, 'next-link-stub.jsx');
const harness = join(scratch, 'harness.tsx');
let browser;

try {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(stub, 'export function useRouter(){return {refresh(){window.dispatchEvent(new Event("synthetic-router-refresh"));}}}\n');
  await writeFile(linkStub, 'export default function Link(props){return <a {...props}/>;}\n');
  await writeFile(harness, `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import InquiryManager from ${JSON.stringify(join(process.cwd(), 'app/admin/inquiries/InquiryManager.tsx'))};
    const inquiry = {
      id:'inquiry-1', status:'NEW', name:'Morgan Listing', email:'morgan@example.test', phone:'970-555-0100',
      propertyAddress:'123 Longview Drive', city:'Fort Collins', state:'CO', postalCode:'80524',
      desiredDate:'2026-10-20T16:00:00.000Z', message:'Please call about the listing.', sourcePage:'/inquire',
      referrer:null, ctaName:'Request a quote', utmSource:null, utmMedium:null, utmCampaign:null, utmContent:null, utmTerm:null,
      consent:true, assignedToId:null, assignedTo:null, followUpAt:'2026-10-20T16:30:00.000Z', requestedServices:[{service:{id:'photo',name:'Photography'}}],
      notes:[], activities:[{id:'activity-1',action:'PROJECT_DRAFT_CREATED',summary:'A private project draft was started from this inquiry.',metadata:{projectId:'project-1',projectTitle:'123 Longview Drive'},createdAt:'2026-10-11T00:00:00.000Z',actor:{displayName:'Owner'}}], createdAt:'2026-10-10T16:00:00.000Z', updatedAt:'2026-10-10T16:00:00.000Z', lastActivityAt:'2026-10-10T16:00:00.000Z'
    };
    window.__deferNote = false;
    window.__resolveNote = null;
    window.__noteSequence = 0;
    window.__failNextWorkflow = false;
    window.__deferWorkflow = false;
    window.__resolveWorkflow = null;
    window.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      window.__lastRequest = body;
      if (body.action === 'update-workflow') {
        if (window.__failNextWorkflow) { window.__failNextWorkflow=false; throw new Error('synthetic network failure'); }
        if (window.__deferWorkflow) await new Promise(resolve => { window.__resolveWorkflow=resolve; });
        return Response.json({success:true,inquiry:{id:body.inquiryId,status:body.status,assignedToId:body.assignedToId,followUpAt:body.followUpAt,lastActivityAt:'2026-10-11T00:00:00.000Z'}});
      }
      if (window.__deferNote) await new Promise(resolve => { window.__resolveNote=resolve; });
      return Response.json({success:true,note:{id:'note-'+(++window.__noteSequence),body:body.note,createdAt:'2026-10-11T00:00:00.000Z',author:{displayName:'Owner'}}});
    };
    createRoot(document.getElementById('root')).render(<InquiryManager initialInquiries={[inquiry, {...inquiry, id:'inquiry-2', name:'Taylor Buyer'}]} users={[{id:'editor-1',displayName:'Editor One',role:'EDITOR'}]} />);
  `);
  const result = await build({
    entryPoints: [harness], bundle: true, platform: 'browser', format: 'iife', write: false,
    nodePaths: [join(process.cwd(), 'node_modules')],
    jsx: 'automatic', plugins: [{ name: 'next-navigation-and-link-stub', setup(api) {
      api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: stub }));
      api.onResolve({ filter: /^next\/link$/ }, () => ({ path: linkStub }));
    } }],
  });
  const script = result.outputFiles[0].text;
  const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Denver', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route('**/*', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="admin-form-scope"><main id="root"></main></body></html>');
  await page.addStyleTag({ content: css.css });
  await page.addScriptTag({ content: script });
  const row = page.getByRole('button', { name: 'Open inquiry: Morgan Listing' });
  await row.waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry list fits a phone viewport');

  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Morgan Listing' });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate(node => getComputedStyle(node).position), 'fixed', 'actual application stylesheet positions the modal');
  assert.equal(await page.getByRole('link', { name: 'Start project draft' }).getAttribute('href'), '/admin/projects/new?inquiry=inquiry-1', 'inquiry detail provides the scoped draft handoff');
  assert.equal(await page.getByRole('link', { name: 'Open project draft' }).getAttribute('href'), '/admin/projects/project-1', 'inquiry activity keeps the created project reachable');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close inquiry details', 'opening details moves focus to the close control');
  const close = page.getByRole('button', { name: 'Close inquiry details' });
  await row.focus();
  await page.keyboard.press('Tab');
  assert.equal(await close.evaluate(node => document.activeElement === node), true, 'keyboard focus cannot escape the open modal');
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('link', { name: 'Open project draft' }).evaluate(node => document.activeElement === node), true, 'Shift+Tab wraps to the last modal control');
  await page.keyboard.press('Tab');
  assert.equal(await close.evaluate(node => document.activeElement === node), true, 'Tab wraps to the first modal control');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry details fit a phone viewport');
  await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-390.png'), fullPage: false });

  assert.equal(await page.getByLabel('Follow up', { exact: true }).inputValue(), '2026-10-20T10:30', 'stored UTC follow-up displays in the browser local time zone');
  await page.getByLabel('Follow up', { exact: true }).fill('2026-10-21T11:45');
  await page.waitForFunction(() => window.__lastRequest?.followUpAt === '2026-10-21T17:45:00.000Z');
  await page.waitForFunction(() => !document.querySelector('input[type="datetime-local"]').disabled);
  assert.equal(await page.getByLabel('Follow up', { exact: true }).inputValue(), '2026-10-21T11:45', 'acknowledged UTC value keeps the chosen local wall-clock time');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await row.evaluate(node => document.activeElement === node), true, 'closing with Escape restores focus to the opened inquiry');

  await row.click();
  await page.getByLabel('Status').selectOption('CONTACTED');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('label')).some(label =>
    label.textContent?.trim().startsWith('Status') && label.querySelector('select')?.value === 'CONTACTED'));
  assert.equal(await page.getByLabel('Status').inputValue(), 'CONTACTED', 'confirmed workflow state appears after the server acknowledgement');
  await page.evaluate(() => { window.__failNextWorkflow = true; });
  await page.getByLabel('Status').selectOption('QUALIFIED');
  assert.equal(await page.getByLabel('Status').inputValue(), 'CONTACTED', 'failed save never leaves an optimistic status in the UI');
  const alert = dialog.getByRole('alert');
  await alert.waitFor();
  await alert.scrollIntoViewIfNeeded();
  assert.equal(await alert.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return node === hit || node.contains(hit);
  }), true, 'save failure is visible inside the styled modal, not obscured behind its overlay');
  await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-recovery-390.png'), fullPage: false });
  assert.match(await page.getByRole('alert').textContent(), /Unable to save change\. Check your connection/);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry details fit a desktop viewport');
  await alert.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-1440.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inquiry: Taylor Buyer' }).click();
  const otherDialog = page.getByRole('dialog', { name: 'Taylor Buyer' });
  await otherDialog.waitFor();
  assert.equal(await page.getByRole('alert').count(), 0, 'a different inquiry does not inherit the previous inquiry save error');
  await page.keyboard.press('Escape');
  await row.click();
  await dialog.getByRole('alert').waitFor();
  const noteInput = page.getByRole('textbox', { name: 'Add a private follow-up note' });
  const submittedNote = 'Morgan: confirm photography access.';
  await noteInput.fill(submittedNote);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inquiry: Taylor Buyer' }).click();
  await otherDialog.waitFor();
  assert.equal(await noteInput.inputValue(), '', 'a different inquiry starts with its own note draft');
  await noteInput.fill('Taylor: call after the showing.');
  await page.keyboard.press('Escape');
  await row.click();
  assert.equal(await noteInput.inputValue(), submittedNote, 'reopening an inquiry restores its unsaved draft');
  await page.evaluate(() => { window.__deferNote = true; });
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.waitForFunction(() => typeof window.__resolveNote === 'function');
  await noteInput.fill('Morgan: newer follow-up draft.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open inquiry: Taylor Buyer' }).click();
  await page.evaluate(() => window.__resolveNote());
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Saving…'));
  assert.equal(await noteInput.inputValue(), 'Taylor: call after the showing.', 'another inquiry save cannot clear the active draft');
  assert.equal(await otherDialog.getByText(submittedNote, { exact: true }).count(), 0, 'saved note stays with its original inquiry');
  await page.keyboard.press('Escape');
  await row.click();
  await dialog.getByText(submittedNote, { exact: true }).waitFor();
  assert.equal(await noteInput.inputValue(), 'Morgan: newer follow-up draft.', 'late acknowledgement preserves text typed after submission');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noteInput.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-notes-'+width+'.png'), fullPage: false });
  }
  await page.evaluate(() => { window.__deferNote = false; });
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await dialog.getByText('Morgan: newer follow-up draft.', { exact: true }).waitFor();
  assert.equal(await noteInput.inputValue(), '', 'acknowledgement clears the submitted draft when it is still current');
  assert.deepEqual(errors, []);
  console.log('PASS: real InquiryManager React component in Chromium; named dialog, focus entry/trap/return, Escape close, application styles, mobile overflow, local-time follow-up round trip, acknowledged workflow state visible failed-save recovery, inquiry-specific note drafts and late-save preservation');
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
}
