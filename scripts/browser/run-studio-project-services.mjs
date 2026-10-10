import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-services-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
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
    let mode='success', calls=0, release;
    let revision='2026-01-01T00:00:00.000Z', savedSelection=[];
    await page.route('**/api/admin/projects/synthetic/workflow',async route=>{
      calls++; const body=route.request().postDataJSON(); assert.equal(body.action,'assign-services'); assert.equal(body.expectedUpdatedAt,revision); assert.deepEqual(body.expectedServiceIds,savedSelection);
      if(mode==='pending') await new Promise(resolve=>{release=resolve});
      if(mode==='conflict') return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:'Project changed.',reloadRequired:true})});
      if(mode==='uncertain') return route.abort();
      if(mode==='invalid-receipt') return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,serviceIds:body.serviceIds,updatedAt:revision})});
      if(mode==='validation') return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({success:false,error:'Review this selection.'})});
      savedSelection=body.serviceIds;
      revision = new Date(Date.parse(revision)+1000).toISOString();
      return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,serviceIds:body.serviceIds,updatedAt:revision})});
    });
    const open = async () => {savedSelection=[];revision='2026-01-01T00:00:00.000Z';await page.goto('about:blank');await page.goto(origin+'/#project-services');await page.getByRole('button',{name:/Service Photography/}).waitFor();};
    const photo=page.getByRole('button',{name:/Service Photography/}),film=page.getByRole('button',{name:/Service Property film/}),save=page.getByRole('button',{name:'Save services',exact:true});
    await open();
    assert.equal(await page.getByRole('button',{name:/Service Retired service/}).isDisabled(),true);
    await photo.click(); mode='pending'; await save.click();await page.getByRole('button',{name:'Saving',exact:true}).waitFor();
    assert.equal(await photo.isDisabled(),true);assert.equal(await film.isDisabled(),true);
    while(!release) await new Promise(resolve=>setTimeout(resolve,10)); release();
    await page.getByText('Services saved.',{exact:true}).waitFor();assert.equal(calls,1);
    assert.equal(await save.isDisabled(),true);assert.equal(await photo.getAttribute('aria-pressed'),'true');
    mode='success';await film.click();await save.click();await page.getByText('Services saved.',{exact:true}).waitFor();assert.equal(calls,2);
    await page.screenshot({path:`release-evidence/studio-project-services-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Expand Review and Publish',exact:true}).click();
    await page.getByRole('link',{name:'Edit project details',exact:true}).click();
    assert.equal(await page.getByLabel('Project introduction').isVisible(),true);
    await page.getByRole('link',{name:'Manage project media',exact:true}).click();
    assert.equal(await page.getByLabel('Media notes').isVisible(),true);
    for(const failure of ['validation','conflict','uncertain','invalid-receipt']) {
      mode=failure;await open();await photo.click();await save.click();await page.getByRole('alert').waitFor();
      assert.equal(await photo.getAttribute('aria-pressed'),'true');
      assert.equal(await save.isDisabled(),failure!=='validation');
      if(failure==='validation') {assert.equal(await photo.isDisabled(),false);continue;}
      assert.equal(await photo.isDisabled(),true);
      const reload=page.getByRole('button',{name:'Reload saved project',exact:true});await reload.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#project-services').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
      if(failure==='conflict') await page.screenshot({path:`release-evidence/studio-project-services-recovery-${width}.png`});
      const count=calls;page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(calls,count);assert.equal(await photo.getAttribute('aria-pressed'),'true');
    }
    // Details refresh before an edit must not cause a false service conflict.
    await open();mode='success';
    revision='2026-01-03T00:00:00.000Z';
    await page.evaluate(value=>window.refreshProjectProps(value),revision);
    await page.waitForFunction(value=>window.renderedRevision===value,revision);
    await photo.click();await save.click();await page.getByText('Services saved.',{exact:true}).waitFor();
    // A refresh after selection starts must not silently rebase that draft.
    await open();mode='conflict';await photo.click();
    await page.evaluate(()=>window.refreshProjectProps('2026-01-04T00:00:00.000Z'));
    await page.waitForFunction(()=>window.renderedRevision==='2026-01-04T00:00:00.000Z');
    await save.click();await page.getByRole('alert').waitFor();assert.equal(await photo.getAttribute('aria-pressed'),'true');assert.equal(await save.isDisabled(),true);
    // A refreshed service set is not equivalent to the old visible selection.
    await open();mode='conflict';
    await page.evaluate(()=>window.refreshProjectProps('2026-01-05T00:00:00.000Z',['film']));
    await page.waitForFunction(()=>window.renderedRevision==='2026-01-05T00:00:00.000Z');
    await photo.click();await save.click();await page.getByRole('alert').waitFor();assert.equal(await save.isDisabled(),true);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS services reviewed revision, busy freeze, validation recovery, conflict/uncertain/invalid receipt holds, retained selection and actionable requirements at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
