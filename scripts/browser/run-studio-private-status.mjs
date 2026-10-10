import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-private-status-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-router', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'import React from \"react\"; export default function Link(p){return React.createElement(\"a\",p)}' : 'export const useRouter=()=>({refresh(){window.refreshCount=(window.refreshCount||0)+1}})' }));
  } }] });
const css = await postcss([tailwind()]).process(await readFile('app/globals.css', 'utf8'), { from: 'app/globals.css' });
const files = {
  '/': ['text/html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project editor qualification</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'],
  '/style.css': ['text/css',css.css], '/fixture.js': ['text/javascript',bundle.outputFiles[0].contents],
};
const server = createServer((req,res) => { const file = files[req.url.split('?')[0]]; if (!file || req.method !== 'GET') {res.writeHead(404);res.end();return;} res.setHeader('content-type',file[0]);res.end(file[1]); });
let browser;
try {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true}); await mkdir('release-evidence',{recursive:true});
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:1000}}), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)&&route.request().method()==='GET'?route.continue():route.abort());
    let mode='success',calls=0,release,revision,status;
    await page.route('**/api/admin/projects/synthetic/workflow',async route=>{
      calls++;const body=route.request().postDataJSON();assert.ok(['unpublish','archive'].includes(body.action));assert.equal(body.expectedUpdatedAt,revision);assert.equal(body.expectedStatus,status);
      if(mode==='pending')await new Promise(resolve=>{release=resolve});
      if(mode==='uncertain')return route.abort();
      if(mode==='json')return route.fulfill({contentType:'application/json',body:'invalid'});
      if(['conflict','forbidden','server'].includes(mode))return route.fulfill({status:mode==='conflict'?409:mode==='forbidden'?403:500,contentType:'application/json',body:JSON.stringify({success:false,error:'Saved status needs review.',reloadRequired:true})});
      const updatedAt=new Date(Date.parse(revision)+1000).toISOString();
      const target=body.action==='archive'?'ARCHIVED':'DRAFT';
      const receipt={success:true,updatedAt:mode==='stale-receipt'?revision:updatedAt,project:{id:'synthetic',status:mode==='wrong-status'?'PUBLISHED':target,featured:false,featuredStartedAt:null,featuredExpiresAt:null,publishedAt:null}};
      revision=updatedAt;status=target;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(receipt)});
    });
    const open=async(initial='PUBLISHED')=>{revision='2026-01-01T00:00:00.000Z';status=initial;await page.goto('about:blank');await page.goto(origin+(initial==='ARCHIVED'?'/?archived=1':'/')+'#project-publishing');await page.getByRole('button',{name:initial==='ARCHIVED'?'Restore to draft':'Move to draft',exact:true}).waitFor();};
    const move=()=>page.getByRole('button',{name:'Move to draft',exact:true});
    const archive=()=>page.getByRole('button',{name:'Archive project',exact:true});
    await open();mode='pending';const before=calls;
    await move().evaluate(button=>{button.click();button.click()});
    await page.getByRole('button',{name:'Moving to draft',exact:true}).waitFor();assert.equal(await archive().isDisabled(),true);assert.equal(await page.getByLabel('Featured project duration').isDisabled(),true);
    while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();
    await page.getByText('Project moved to draft.',{exact:true}).waitFor();assert.equal(calls,before+1);assert.equal(await page.getByRole('link',{name:'View live project',exact:true}).count(),0);
    mode='success';page.once('dialog',dialog=>dialog.dismiss());await archive().click();assert.equal(calls,before+1);
    page.once('dialog',dialog=>dialog.accept());await archive().click();await page.getByText('Project archived. Its content is retained.',{exact:true}).waitFor();assert.equal(calls,before+2);assert.equal(await archive().count(),0);
    await page.screenshot({path:`release-evidence/studio-private-status-${width}.png`,fullPage:true});
    for(const failure of ['conflict','forbidden','server','uncertain','json','stale-receipt','wrong-status']) {
      await open();mode=failure;const count=calls;
      await page.getByRole('button',{name:'Expand Project details',exact:true}).click();await page.getByLabel('Project introduction').fill('Retained local introduction');
      // An uncertain result must not invite retry or claim the old live status is current.
      await move().click();await page.getByRole('heading',{name:'Review saved status',exact:true}).waitFor();
      assert.equal(await move().isDisabled(),true);assert.equal(await archive().isDisabled(),true);assert.equal(await page.getByLabel('Featured project duration').isDisabled(),true);
      assert.equal(await page.getByLabel('Featured project duration').inputValue(),'REVIEW');
      assert.equal(await page.getByText('Always featured',{exact:false}).count(),0);
      assert.equal(await page.getByText('Review this draft before making it public.',{exact:true}).count(),0);
      assert.equal(await page.getByRole('link',{name:'View live project',exact:true}).count(),0);
      const reload=page.getByRole('button',{name:'Review saved project status',exact:true});await reload.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('#project-publishing').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
      if(failure==='conflict')await page.screenshot({path:`release-evidence/studio-private-status-recovery-${width}.png`});
      page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(calls,count+1);assert.equal(await move().isDisabled(),true);assert.equal(await page.getByLabel('Project introduction').inputValue(),'Retained local introduction');
      await page.getByRole('button',{name:'Expand Services and SEO',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Service Photography/}).isDisabled(),true);
    }
    await open();mode='uncertain';page.once('dialog',dialog=>dialog.accept());await archive().click();await page.getByRole('heading',{name:'Review saved status',exact:true}).waitFor();assert.equal(await archive().isDisabled(),true);
    // A refreshed details revision is usable while the reviewed status is unchanged.
    await open();mode='success';revision='2026-01-03T00:00:00.000Z';await page.evaluate(value=>window.refreshProjectProps(value),revision);await page.waitForFunction(value=>window.renderedRevision===value,revision);
    await move().click();await page.getByText('Project moved to draft.',{exact:true}).waitFor();
    // An incomplete archived project can return to draft without becoming public.
    await open('ARCHIVED'); mode='pending'; release=undefined; const restoreCalls=calls;
    const restore=()=>page.getByRole('button',{name:'Restore to draft',exact:true});
    assert.equal(await page.getByRole('button',{name:'Publish project',exact:true}).isDisabled(),true);
    await restore().evaluate(button=>{button.click();button.click()});
    await page.getByRole('button',{name:'Restoring to draft',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Featured project duration').isDisabled(),true);
    while(!release)await new Promise(resolve=>setTimeout(resolve,10)); release();
    await page.getByText('Project restored to draft. Its content remains private.',{exact:true}).waitFor();
    assert.equal(calls,restoreCalls+1); assert.equal(await restore().count(),0);
    assert.equal(await page.getByRole('link',{name:'View live project',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Publish project',exact:true}).isDisabled(),true);
    assert.equal(await archive().isEnabled(),true);
    await page.screenshot({path:`release-evidence/studio-restore-draft-${width}.png`,fullPage:true});
    for(const failure of ['conflict','forbidden','server','uncertain','json','stale-receipt','wrong-status']) {
      await open('ARCHIVED'); mode=failure;
      await page.getByRole('button',{name:'Expand Project details',exact:true}).click();
      await page.getByLabel('Project introduction').fill('Retain restored project notes');
      await restore().click(); await page.getByRole('heading',{name:'Review saved status',exact:true}).waitFor();
      assert.equal(await restore().isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Publish project',exact:true}).isDisabled(),true);
      const reload=page.getByRole('button',{name:'Review saved project status',exact:true});
      await reload.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(failure==='conflict') await page.screenshot({path:`release-evidence/studio-restore-draft-recovery-${width}.png`});
      page.once('dialog',dialog=>dialog.dismiss()); await reload.click();
      assert.equal(await page.getByLabel('Project introduction').inputValue(),'Retain restored project notes');
      assert.equal(await restore().isDisabled(),true);
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS reviewed unpublish/archive at 390/1440: version/status receipts, duplicate/pending guards, cancellation, seven held outcomes, paused controls and explicit saved-state review; synthetic transport only');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
