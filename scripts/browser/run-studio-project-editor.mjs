import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-editor-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-router', setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: 'export const useRouter=()=>({refresh(){window.refreshCount=(window.refreshCount||0)+1}})' }));
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
    let mode='success', calls=0, release;
    await page.route('**/api/admin/projects/synthetic/details',async route=>{
      calls++; const body=route.request().postDataJSON();assert.equal(body.expectedUpdatedAt,'2026-01-01T00:00:00.000Z');
      if(mode==='pending') await new Promise(resolve=>{release=resolve});
      if(mode==='conflict') return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:'This project changed. Copy your draft and reload.',reloadRequired:true})});
      if(mode==='uncertain') return route.abort();
      return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,project:{id:'synthetic',title:body.title,slug:body.slug,updatedAt:'2026-01-02T00:00:00.000Z'}})});
    });
    const open = async () => {await page.goto(origin);await page.getByRole('button',{name:'Edit project details',exact:true}).click();await page.getByRole('dialog').waitFor();};
    await open();
    await page.getByRole('dialog').getByLabel('Project title',{exact:true}).fill('Reviewed project title');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByRole('button',{name:'Save project',exact:true}).focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Close project details editor');
    await page.screenshot({path:`release-evidence/studio-project-editor-${width}.png`,fullPage:true});
    mode='pending';await page.getByRole('button',{name:'Save project',exact:true}).click();
    await page.getByRole('button',{name:'Saving details',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Project title',{exact:true}).isDisabled(),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
    await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled===true);
    while(!release) await new Promise(resolve=>setTimeout(resolve,10));release();
    await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(calls,1);assert.equal(await page.evaluate(()=>window.refreshCount),1);
    for(const failure of ['conflict','uncertain']) {
      mode=failure;await open();await page.getByLabel('Project title',{exact:true}).fill('Keep this unsaved title');
      await page.getByRole('button',{name:'Save project',exact:true}).click();await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('Project title',{exact:true}).inputValue(),'Keep this unsaved title');
      assert.equal(await page.getByRole('button',{name:'Save project',exact:true}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Reload saved project',exact:true}).count(),1);
      if(failure==='conflict') await page.screenshot({path:`release-evidence/studio-project-conflict-${width}.png`,fullPage:true});
      page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS project editor reviewed save, busy guard, focus containment, stale/uncertain draft preservation and paused retry at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
