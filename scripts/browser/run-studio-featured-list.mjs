import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-featured-list-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
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
    const page = await browser.newPage({viewport:{width,height:1000}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)&&route.request().method()==='GET'?route.continue():route.abort());
    let mode='success',calls=0,release,revision='a'.repeat(64),expected=['p1','p2','p3','p4','p5','p6'];
    await page.route('**/api/admin/projects/featured',async route=>{
      calls++;const body=route.request().postDataJSON();assert.equal(body.expectedRevision,revision);assert.deepEqual(body.projectIds,expected);
      if(mode==='pending')await new Promise(resolve=>{release=resolve});
      if(mode==='uncertain')return route.abort();
      if(mode==='json')return route.fulfill({contentType:'application/json',body:'invalid'});
      if(['conflict','forbidden','server','preview'].includes(mode))return route.fulfill({status:mode==='forbidden'?403:mode==='server'?500:409,contentType:'application/json',body:JSON.stringify({success:false,error:'Review required.'})});
      const next=revision==='a'.repeat(64)?'b'.repeat(64):'c'.repeat(64);
      const receipt={success:true,workspaceId:mode==='wrong-workspace'?'foreign':'synthetic',projectIds:mode==='wrong-order'?[...body.projectIds].reverse():body.projectIds,revision:mode==='stale-receipt'?revision:next};revision=next;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(receipt)});
    });
    const save=()=>page.getByRole('button',{name:'Save Featured Projects',exact:true});
    const open=async()=>{mode='success';revision='a'.repeat(64);expected=['p1','p2','p3','p4','p5','p6'];await page.goto('about:blank');await page.goto(origin);await save().waitFor();};
    const replace=async()=>{
      await page.getByLabel('Published project to feature').selectOption('p7');await page.getByRole('button',{name:'Replace a Featured Project',exact:true}).click();
      await page.getByRole('button',{name:'Confirm Replacement',exact:true}).click();expected=['p1','p2','p3','p4','p5','p7'];
    };
    await open();await replace();mode='pending';const before=calls;
    await save().evaluate(button=>{button.click();button.click()});await page.getByRole('button',{name:'Saving…',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Published project to feature').isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Remove Project 7',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Move Project 1, currently position 1',exact:true}).isDisabled(),true);
    while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();await page.getByText('Featured projects saved in the displayed order.',{exact:true}).waitFor();assert.equal(calls,before+1);
    await page.screenshot({path:`release-evidence/studio-featured-list-${width}.png`,fullPage:true});
    mode='success';await page.getByRole('button',{name:'Remove Project 7',exact:true}).click();expected=expected.slice(0,5);await save().click();await page.getByText('Featured projects saved in the displayed order.',{exact:true}).waitFor();assert.equal(calls,before+2);
    for(const failure of ['conflict','forbidden','server','preview','uncertain','json','stale-receipt','wrong-workspace','wrong-order']) {
      await open();await replace();await page.getByLabel('Local project note').fill('Retain this local note');mode=failure;const count=calls;
      await save().click();await page.getByRole('heading',{name:'Review saved featured projects',exact:true}).waitFor();
      assert.equal(calls,count+1);assert.equal(await save().isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Remove Project 7',exact:true}).isDisabled(),true);assert.equal(await page.getByLabel('Published project to feature').isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Move Project 1, currently position 1',exact:true}).isDisabled(),true);
      const reload=page.getByRole('button',{name:'Review saved featured list',exact:true});await reload.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(failure==='uncertain')await page.screenshot({path:`release-evidence/studio-featured-list-recovery-${width}.png`,fullPage:true});
      page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(calls,count+1);assert.equal(await page.getByLabel('Local project note').inputValue(),'Retain this local note');
    }
    // Existing keyboard sorting remains usable before saving.
    await open();const handle=page.getByRole('button',{name:'Move Project 1, currently position 1',exact:true});await handle.focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('button[aria-label="Move Project 1, currently position 1"]')?.getAttribute('aria-pressed')==='true');
    // dnd-kit's keyboard listener attaches on the next task; wait for measured layout before moving.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role="status"]')).some(node=>/over droppable area p[2-7]/.test(node.textContent||'')));
    await page.keyboard.press('Space');
    await page.waitForFunction(()=>!document.querySelector('ol > li')?.textContent?.includes('Project 1'));
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS featured-list replacement, reviewed saves, recovery and keyboard sorting at 390/1440.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
