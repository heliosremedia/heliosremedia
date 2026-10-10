import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-review-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-router', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'import React from \"react\"; export default function Link(p){return React.createElement(\"a\",p)}' : 'export const useRouter=()=>({refresh(){window.refreshCount=(window.refreshCount||0)+1}})' }));
  } }] });
const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
const files = {
  '/': ['text/html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project editor qualification</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'],
  '/style.css': ['text/css',css.css], '/fixture.js': ['text/javascript',bundle.outputFiles[0].contents],
};
const server = createServer((req,res) => { const file = files[req.url]; if (!file || req.method !== 'GET') {res.writeHead(404);res.end();return;} res.setHeader('content-type',file[0]);res.end(file[1]); });
let browser;
try {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true}); await mkdir('release-evidence',{recursive:true});
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)&&route.request().method()==='GET'?route.continue():route.abort());
    await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(window.clipboardFails)throw new Error('Denied');window.copiedPreview=value;}}});});
    let mode='success', creates=0, revokes=0, release;
    const preview={id:'private-link',label:'Owner review',expiresAt:'2050-01-01T00:00:00.000Z',createdAt:'2026-01-01T00:00:00.000Z',lastUsedAt:null,revokedAt:null,url:'https://synthetic.example.test/portfolio/private?preview=synthetic-only'};
    await page.route('**/api/admin/projects/synthetic/previews*',async route=>{
      if(route.request().method()==='DELETE') {
        revokes++;
        if(mode==='revoke-uncertain')return route.abort();
        return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true})});
      }
      creates++;const body=route.request().postDataJSON();assert.equal(body.label,'Owner review');assert.equal(body.days,7);
      if(mode==='pending')await new Promise(resolve=>{release=resolve});
      if(mode==='uncertain')return route.abort();
      if(mode==='invalid-receipt')return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,preview:{...preview,url:'javascript:alert(1)'}})});
      if(mode==='validation')return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:'Configure a preview domain first.'})});
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({success:true,preview})});
    });
    const open=async()=>{await page.goto(origin);await page.getByLabel('Link label',{exact:true}).fill('Owner review');};
    const create=page.getByRole('button',{name:'Create private link',exact:true});
    await open();mode='pending';await create.click();await page.getByRole('button',{name:'Saving link',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Link label',{exact:true}).isDisabled(),true);assert.equal(await page.getByLabel('Expires after',{exact:true}).isDisabled(),true);
    while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();
    await page.getByRole('link',{name:'Open private review',exact:true}).waitFor();assert.equal(creates,1);
    assert.equal(await page.getByRole('link',{name:'Open private review',exact:true}).getAttribute('href'),preview.url);
    await page.evaluate(()=>window.clipboardFails=true);await page.getByRole('button',{name:'Copy link',exact:true}).click();
    await page.getByText(/Clipboard access was unavailable/).waitFor();assert.equal(creates,1);assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.getByLabel('Private link address',{exact:true}).inputValue(),preview.url);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('section').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    await page.screenshot({path:`release-evidence/studio-project-private-review-${width}.png`,fullPage:true});
    await page.evaluate(()=>window.clipboardFails=false);await page.getByRole('button',{name:'Copy link',exact:true}).click();
    await page.getByRole('button',{name:'Copied',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.copiedPreview),preview.url);
    page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Revoke link',exact:true}).click();assert.equal(revokes,0);
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Revoke link',exact:true}).click();await page.getByText('Private review link revoked.',{exact:true}).waitFor();
    assert.equal(revokes,1);assert.equal(await page.getByRole('link',{name:'Open private review',exact:true}).count(),0);
    for(const failure of ['validation','uncertain','invalid-receipt']) {
      await open();mode=failure;await create.click();await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('Link label',{exact:true}).inputValue(),'Owner review');
      assert.equal(await create.isDisabled(),failure!=='validation');
      if(failure==='validation')continue;
      assert.equal(await page.getByText(/No private review links yet/).count(),0,'Unknown creation must not claim an empty saved list');
      const reload=page.getByRole('button',{name:'Reload saved links',exact:true});await reload.scrollIntoViewIfNeeded();
      if(failure==='uncertain')await page.screenshot({path:`release-evidence/studio-project-private-review-recovery-${width}.png`,fullPage:true});
      const count=creates;page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(creates,count);assert.equal(await create.isDisabled(),true);
    }
    mode='success';await open();await create.click();await page.getByRole('link',{name:'Open private review',exact:true}).waitFor();
    mode='revoke-uncertain';page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Revoke link',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(await create.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Revoke link',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('link',{name:'Open private review',exact:true}).count(),0);
    assert.equal(await page.getByText('Needs review',{exact:true}).count(),1,'Unconfirmed revocation must not claim the link is active');
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS private preview creation, clipboard fallback without duplicate POST, busy guard, explicit revoke, uncertain creation/revocation pause and preserved inputs at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
