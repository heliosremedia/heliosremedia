import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-command-center-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-next-navigation', setup(build) {
    build.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'synthetic-next' }));
    build.onLoad({ filter: /.*/, namespace: 'synthetic-next' }, args => ({ loader: 'jsx', resolveDir: process.cwd(), contents: args.path === 'next/link'
      ? 'import React from "react"; export default function Link(props) { return <a {...props}/> }'
      : 'export const usePathname=()=>"/admin/studio"; export const useRouter=()=>({refresh(){window.studioRefreshCount=(window.studioRefreshCount||0)+1},replace(){}});' }));
  } }] });
const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
const files = {
  '/': ['text/html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio synthetic qualification</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'],
  '/api/admin/studio/newsletter-jobs': ['application/json', JSON.stringify({ success: true, health: {
    observedAt: '2026-10-08T15:00:00Z', counts: { pending: 1, active: 0, review: 0, failed: 0 }, truncated: false, automaticRetryAllowed: false,
    jobs: [{ id: 'held-job', editionId: 'held-edition', type: 'SEND', state: 'PENDING', dueAt: '2026-10-07T15:00:00Z', attempts: 0,
      heldForReactivation: true, editionLabel: 'Held autumn newsletter', editionStatus: 'SCHEDULED', seriesStatus: 'ACTIVE' }],
  } })],
  '/fixture.js': ['text/javascript', bundle.outputFiles[0].contents],
  '/style.css': ['text/css', css.css],
};
const server = createServer((request, response) => {
  const file = files[request.url.split('?')[0]];
  if (!file || request.method !== 'GET') { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': file[0], 'Cache-Control': 'no-store' }); response.end(file[1]);
});
let browser;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  await mkdir('release-evidence', { recursive: true });
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(origin) && route.request().method() === 'GET' ? route.continue() : route.abort());
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Command Center', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Review delivery →' }).getAttribute('href'), '/admin/newsletter-studio/editions/synthetic');
    assert.equal(await page.getByRole('link', { name: 'Stonewater Sanctuary' }).getAttribute('href'), '/admin/projects/synthetic');
    assert.equal(await page.getByRole('link', { name: 'New project', exact: true }).getAttribute('href'), '/admin/projects/new');
    const projectButton = page.getByRole('link', { name: 'New project', exact: true });
    const foreground = await projectButton.evaluate(element => getComputedStyle(element).color);
    assert.ok(foreground === 'oklch(0.147 0.004 49.25)' || foreground === 'rgb(28, 25, 23)', `New project must use dark text, received ${foreground}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'studio-content');
    if (width < 1024) {
      await page.getByText('Studio navigation', { exact: true }).click();
      const nav = page.getByRole('navigation', { name: 'Mobile Studio navigation', exact: true });
      assert.equal(await nav.getByRole('link', { name: 'Command Center', exact: true }).getAttribute('aria-current'), 'page');
      await page.getByText('Studio navigation', { exact: true }).click();
      assert.equal(await nav.isVisible(), false);
    } else {
      assert.equal(await page.getByRole('navigation', { name: 'Studio navigation', exact: true }).locator('[aria-current="page"]').count(), 1);
    }
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    assert.equal(await page.evaluate(() => window.studioRefreshCount), 1);
    await page.getByRole('button', { name: 'Refresh job status', exact: true }).click();
    await page.getByText('Held after reactivation.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open edition review for Held autumn newsletter' }).getAttribute('href'), '/admin/newsletter-studio/editions/held-edition#delivery-review-title');
    assert.equal(await page.getByRole('button', { name: /retry|resend|publish/i }).count(), 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `release-evidence/studio-command-center-${width}.png`, fullPage: true });
    await page.goto(`${origin}/?mode=unavailable`);
    await page.getByText('Attention data is unavailable.', { exact: false }).waitFor();
    assert.equal(await page.getByText('Unavailable', { exact: true }).count(), 3);
    assert.equal(await page.getByRole('link', { name: 'Review delivery →' }).count(), 0);
    await page.goto(`${origin}/?mode=empty`);
    await page.getByText('Your projects will appear here as you create them.').waitFor();
    assert.equal(await page.getByText('No upcoming items were returned by the connected modules.').count(), 1);
    await page.route('**/api/admin/studio/newsletter-jobs', async route => {
      const payload = JSON.parse(files['/api/admin/studio/newsletter-jobs'][1]);
      payload.health.editionReviewAvailable = false;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Refresh job status', exact: true }).click();
    await page.getByText('Status review is available.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open edition review for Held autumn newsletter' }).count(), 0);
    await page.goto(`${origin}/?mode=schedule-change`);
    await page.getByRole('button', { name: 'Change send date', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Change send date' }).waitFor();
    const confirm = dialog.getByRole('button', { name: 'Change date and require review' });
    assert.equal(await confirm.isDisabled(), true);
    await dialog.getByLabel('New send date and time (UTC)', { exact: true }).fill('2100-01-02T12:30');
    await dialog.getByRole('checkbox').check();
    await page.screenshot({ path: `release-evidence/studio-schedule-change-${width}.png`, fullPage: true });
    await confirm.click();
    assert.equal(await page.locator('output').textContent(), '2100-01-02T12:30:00.000Z');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('button', { name: 'Change send date', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.goto(`${origin}/?mode=schedule-failure`);
    await page.getByRole('button', { name: 'Change send date', exact: true }).click();
    await page.getByLabel('New send date and time (UTC)', { exact: true }).fill('2100-01-02T12:30');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Change date and require review' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Change date and require review' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS Studio shell and Command Center ${width}px: navigation, skip link, real module links, refresh, held-job review, unavailable and empty states`);
  }
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
