import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const scratch = await mkdtemp(`${process.cwd()}/.studio-media-`);
let browser, server;
try {
  await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Page from './app/admin/media/page'; import Shell from './app/admin/components/StudioShell'; export async function render(params){return renderToStaticMarkup(<Shell businessName="Synthetic Northern Colorado Media" session={{workspaceId:'synthetic',role:'OWNER',displayName:'Synthetic owner'}}>{await Page({searchParams:Promise.resolve(params)})}</Shell>)}`, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', outfile: `${scratch}/fixture.mjs`,
    plugins: [{ name: 'synthetic-read-only-page', setup(b) {
      b.onResolve({ filter: /^(next\/(link|image|navigation)|@\/lib\/(prisma|auth\/session|r2-upload))$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
      b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ loader: 'jsx', resolveDir: process.cwd(), contents: {
        'next/link': 'export default function Link(props){return <a {...props}/>}',
        'next/image': 'export default function Image({fill,unoptimized,priority,...props}){return <img {...props}/>}',
        'next/navigation': 'export const usePathname=()=>"/admin/media";export const useRouter=()=>({});export function notFound(){throw Error("NOT_FOUND")}',
        '@/lib/auth/session': 'export const requireAdminSession=async()=>({workspaceId:"synthetic",role:"OWNER"})',
        '@/lib/r2-upload': 'export function getPublicAssetUrl(){throw Error("No asset access in fixture")}',
        '@/lib/prisma': 'export const prisma={media:{count:async()=>0,findMany:async()=>[]},project:{count:async()=>0,findFirst:async()=>({id:"synthetic-project",title:"Stonewater Sanctuary"})}}',
      }[args.path] }));
    } }] });
  const { render } = await import(pathToFileURL(`${scratch}/fixture.mjs`));
  const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
  const pages = {};
  for (const [mode, params] of Object.entries({ empty: {}, selected: { project: 'synthetic-project' }, search: { search: 'missing' } })) pages[mode] = await render(params);
  server = createServer((req, res) => {
    if (req.url === '/style.css') { res.setHeader('content-type','text/css'); res.end(css.css); return; }
    const mode = new URL(req.url, 'http://localhost').searchParams.get('mode') || 'empty';
    res.setHeader('content-type','text/html'); res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Studio media qualification</title></head><body>${pages[mode] || pages.empty}</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  await mkdir('release-evidence', { recursive: true });
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route('**/*', route => route.request().url().startsWith(origin) && route.request().method() === 'GET' ? route.continue() : route.abort());
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Add your first project media.' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Create a project', exact: true }).getAttribute('href'), '/admin/projects/new');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const supportingText = page.getByText('Media belongs to a project.', { exact: false });
    const color = await supportingText.evaluate(element => getComputedStyle(element).color);
    assert.ok(color.includes('0.65') || color.includes('65%'), `Supporting text must retain readable opacity: ${color}`);
    await page.screenshot({ path: `release-evidence/studio-media-empty-${width}.png`, fullPage: true });
    await page.goto(`${origin}/?mode=selected`);
    assert.equal(await page.getByRole('link', { name: 'Manage project media', exact: true }).getAttribute('href'), '/admin/projects/synthetic-project#project-media');
    assert.equal(await page.getByRole('link', { name: 'Add project media', exact: true }).getAttribute('href'), '/admin/projects/synthetic-project#project-media');
    await page.getByRole('heading', { name: 'No assets match these filters.' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `release-evidence/studio-media-selected-${width}.png`, fullPage: true });
    await page.goto(`${origin}/?mode=search`);
    assert.equal(await page.getByRole('link', { name: 'View all assets', exact: true }).getAttribute('href'), '/admin/media');
    assert.equal(await page.getByRole('searchbox', { name: 'Search media library' }).inputValue(), 'missing');
    await page.close();
  }
  console.log('PASS actual Media Library server-rendered page inside Studio shell at 390/1440: empty/search/project actions and no overflow; synthetic read-only data, no providers');
} finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(scratch, { recursive: true, force: true }); }
