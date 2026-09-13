import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Exercise the real Next.js server with deliberately unusable database/provider
// credentials. Never load a developer's runtime environment into this check.
const envFiles = (await readdir(process.cwd())).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example');
assert.equal(envFiles.length, 0, 'Run this isolated check from a clean checkout without runtime environment files.');
const socket = createServer();
await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const scratch = await mkdtemp(join(tmpdir(), 'helios-studio-layout-'));
let browser;
let output = '';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: process.cwd(), detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: process.env.CI,
    NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
    DIRECT_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
    AUTH_SECRET: 'synthetic-layout-test-only-not-a-real-secret',
    STUDIO_V2_TENANT_CONTEXT_ENABLED: 'true',
    NEXT_PUBLIC_SITE_URL: 'https://synthetic-public.example.test',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-ISOLATED-LAYOUT-TEST',
  },
});
const append = chunk => { output = (output + chunk.toString()).slice(-12_000); };
child.stdout.on('data', append);
child.stderr.on('data', append);
function stop(signal) {
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Next.js startup timed out')), 90_000);
    const ready = () => { if (/Ready in/.test(output)) { clearTimeout(timer); child.stdout.off('data', ready); resolve(); } };
    child.stdout.on('data', ready);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Next.js exited during startup (${code})`)); });
  });
  const headers = { host: 'unregistered-studio.example.test', 'x-forwarded-host': 'foreign-public.example.test', 'x-workspace-id': 'foreign-company' };
  const response = await fetch(`${origin}/login?next=%2Fadmin`, { headers, signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, 200, 'sign-in must not depend on public workspace resolution or a working database');
  const html = await response.text();
  assert.match(html, /Welcome back/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /helios-structured-data|googletagmanager\.com|G-ISOLATED-LAYOUT-TEST|rel="canonical"/);
  const invite = await fetch(`${origin}/accept-invite?token=synthetic-invalid-token`, { headers, signal: AbortSignal.timeout(90_000) });
  assert.equal(invite.status, 200, 'invitation entry must not load public company settings');
  assert.doesNotMatch(await invite.text(), /helios-structured-data|googletagmanager\.com|rel="canonical"/);
  const protectedPage = await fetch(`${origin}/admin`, { redirect: 'manual', headers: { ...headers, cookie: 'helios_admin_session=invalid.signature' }, signal: AbortSignal.timeout(90_000) });
  assert.equal(protectedPage.status, 307);
  assert.equal(new URL(protectedPage.headers.get('location'), origin).pathname, '/login');
  const protectedApi = await fetch(`${origin}/api/admin/homepage-film`, { headers, signal: AbortSignal.timeout(90_000) });
  assert.equal(protectedApi.status, 401);
  assert.equal((await protectedApi.json()).success, false);
  console.log('PASS: actual Next.js HTTP sign-in and invitation rendering on an unregistered host, no public metadata/tracking, invalid-session redirect and unauthenticated API denial, without a reachable database');

  if (!process.argv.includes('--http-only')) {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const outbound = [];
    const mutations = [];
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) { outbound.push(url.origin); return route.abort(); }
      if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(request.method()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle', timeout: 90_000 });
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.getByRole('heading', { name: 'Welcome back.' }).waitFor();
    await page.getByLabel('Email', { exact: true }).focus();
    assert.equal(await page.getByLabel('Email', { exact: true }).evaluate(node => document.activeElement === node), true);
    assert.equal(await page.locator('script#helios-structured-data, script#google-analytics, script[src*="googletagmanager"]').count(), 0);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: join(scratch, 'studio-sign-in.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(outbound, [], 'Studio browser must not initialize public tracking');
    assert.deepEqual(mutations, [], 'this check must never log in, accept invitations or send mutations');
    console.log('PASS: actual Chromium against Next.js sign-in redirect, keyboard focus, mobile overflow, no public canonical/tracking, no external browser requests and no mutations');
  }
} catch (error) {
  // This process received synthetic-only configuration; capture compilation
  // diagnostics without reading any deployment environment or credentials.
  console.error(output.slice(-6_000));
  throw error;
} finally {
  await browser?.close();
  stop('SIGTERM');
  if (child.exitCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5_000))]);
    if (child.exitCode === null) stop('SIGKILL');
  }
  await rm(scratch, { recursive: true, force: true });
}
