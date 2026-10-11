import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const scratch = await mkdtemp(join(tmpdir(), 'helios-inquiries-'));
const evidenceDir = join(process.cwd(), 'release-evidence');
const stub = join(scratch, 'next-navigation-stub.js');
const harness = join(scratch, 'harness.tsx');
let browser;

try {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(stub, 'export function useRouter(){return {refresh(){window.dispatchEvent(new Event("synthetic-router-refresh"));}}}\n');
  await writeFile(harness, `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import InquiryManager from ${JSON.stringify(join(process.cwd(), 'app/admin/inquiries/InquiryManager.tsx'))};
    const inquiry = {
      id:'inquiry-1', status:'NEW', name:'Morgan Listing', email:'morgan@example.test', phone:'970-555-0100',
      propertyAddress:'123 Longview Drive', city:'Fort Collins', state:'CO', postalCode:'80524',
      desiredDate:'2026-10-20T16:00:00.000Z', message:'Please call about the listing.', sourcePage:'/inquire',
      referrer:null, ctaName:'Request a quote', utmSource:null, utmMedium:null, utmCampaign:null, utmContent:null, utmTerm:null,
      consent:true, assignedToId:null, assignedTo:null, followUpAt:null, requestedServices:[{service:{id:'photo',name:'Photography'}}],
      notes:[], activities:[], createdAt:'2026-10-10T16:00:00.000Z', updatedAt:'2026-10-10T16:00:00.000Z', lastActivityAt:'2026-10-10T16:00:00.000Z'
    };
    window.__failNextWorkflow = false;
    window.__deferWorkflow = false;
    window.__resolveWorkflow = null;
    window.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === 'update-workflow') {
        if (window.__failNextWorkflow) { window.__failNextWorkflow=false; throw new Error('synthetic network failure'); }
        if (window.__deferWorkflow) await new Promise(resolve => { window.__resolveWorkflow=resolve; });
        return Response.json({success:true,inquiry:{id:body.inquiryId,status:body.status,assignedToId:body.assignedToId,followUpAt:body.followUpAt,lastActivityAt:'2026-10-11T00:00:00.000Z'}});
      }
      return Response.json({success:true,note:{id:'note-1',body:body.note,createdAt:'2026-10-11T00:00:00.000Z',author:{displayName:'Owner'}}});
    };
    createRoot(document.getElementById('root')).render(<InquiryManager initialInquiries={[inquiry]} users={[{id:'editor-1',displayName:'Editor One',role:'EDITOR'}]} />);
  `);
  const result = await build({
    entryPoints: [harness], bundle: true, platform: 'browser', format: 'iife', write: false,
    nodePaths: [join(process.cwd(), 'node_modules')],
    jsx: 'automatic', plugins: [{ name: 'next-navigation-stub', setup(api) {
      api.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: stub }));
    } }],
  });
  const script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:#111;color:#eee"><main id="root"></main></body></html>');
  await page.addScriptTag({ content: script });
  const row = page.getByRole('button', { name: 'Open inquiry: Morgan Listing' });
  await row.waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry list fits a phone viewport');

  await row.click();
  const dialog = page.getByRole('dialog', { name: 'Morgan Listing' });
  await dialog.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close inquiry details', 'opening details moves focus to the close control');
  const close = page.getByRole('button', { name: 'Close inquiry details' });
  await row.focus();
  await page.keyboard.press('Tab');
  assert.equal(await close.evaluate(node => document.activeElement === node), true, 'keyboard focus cannot escape the open modal');
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByLabel('Follow up').evaluate(node => document.activeElement === node), true, 'Shift+Tab stays inside the modal');
  await page.keyboard.press('Tab');
  assert.equal(await close.evaluate(node => document.activeElement === node), true, 'Tab wraps to the first modal control');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry details fit a phone viewport');
  await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-390.png'), fullPage: true });

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
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').textContent(), /Unable to save change/);
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'inquiry details fit a desktop viewport');
  await page.screenshot({ path: join(evidenceDir, 'studio-inquiries-1440.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: real InquiryManager React component in Chromium; named dialog, focus entry/trap/return, Escape close, mobile overflow, acknowledged workflow state and failed-save recovery');
} finally {
  await browser?.close();
  await rm(scratch, { recursive: true, force: true });
}
