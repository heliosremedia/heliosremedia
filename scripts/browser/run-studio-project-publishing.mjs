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
    let mode='success',calls=0,release,revision,status;
    await page.route('**/api/admin/projects/synthetic/workflow',async route=>{
      calls++;const body=route.request().postDataJSON();assert.ok(['unpublish','publish','set-featured'].includes(body.action));assert.equal(body.expectedUpdatedAt,revision);assert.equal(body.expectedStatus,status);
      if(mode==='pending')await new Promise(resolve=>{release=resolve});
      if(mode==='uncertain')return route.abort();
      if(mode==='json')return route.fulfill({contentType:'application/json',body:'invalid'});
      if(['conflict','forbidden','server'].includes(mode))return route.fulfill({status:mode==='conflict'?409:mode==='forbidden'?403:500,contentType:'application/json',body:JSON.stringify({success:false,error:'Review saved project.',reloadRequired:true})});
      const updatedAt=new Date(Date.parse(revision)+1000).toISOString();
      const target=body.action==='unpublish'?'DRAFT':'PUBLISHED';
      const featured=body.action==='set-featured'&&body.featuredDuration!=='NONE';
      const expires=featured&&body.featuredDuration!=='ALWAYS'?new Date(Date.parse(updatedAt)+Number(body.featuredDuration.split('_')[0])*86400000).toISOString():null;
      const receipt={success:true,updatedAt:mode==='stale-receipt'?revision:updatedAt,project:{id:mode==='wrong-project'?'foreign':'synthetic',status:mode==='wrong-status'?'ARCHIVED':target,featured,featuredStartedAt:featured?updatedAt:null,featuredExpiresAt:mode==='wrong-duration'?updatedAt:expires,publishedAt:target==='PUBLISHED'?updatedAt:null}};
      revision=updatedAt;status=target;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(receipt)});
    });
    const open=async()=>{mode='success';revision='2026-01-01T00:00:00.000Z';status='PUBLISHED';await page.goto('about:blank');await page.goto(origin+'/#project-publishing');await page.getByRole('button',{name:'Move to draft',exact:true}).waitFor();};
    const toDraft=async()=>{await page.getByRole('button',{name:'Move to draft',exact:true}).click();await page.getByText('Project moved to draft.',{exact:true}).waitFor();};
    const publish=()=>page.getByRole('button',{name:'Publish project',exact:true});
    const duration=()=>page.getByLabel('Featured project duration');
    await open();await toDraft();mode='pending';const before=calls;
    await publish().evaluate(button=>{button.click();button.click()});await page.getByRole('button',{name:'Publishing',exact:true}).waitFor();
    assert.equal(await duration().isDisabled(),true);while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();
    await page.getByText('Project published.',{exact:true}).waitFor();assert.equal(calls,before+1);
    mode='success';await duration().selectOption('7_DAYS');await page.getByText('Featured placement saved.',{exact:true}).waitFor();assert.equal(await duration().inputValue(),'TIMED');
    await page.screenshot({path:`release-evidence/studio-project-publishing-${width}.png`,fullPage:true});
    for(const action of ['publish','set-featured']) for(const failure of ['conflict','forbidden','server','uncertain','json','stale-receipt','wrong-project','wrong-status',...(action==='set-featured'?['wrong-duration']:[])]) {
      await open();if(action==='publish')await toDraft();mode=failure;const count=calls;
      await page.getByRole('button',{name:'Expand Project details',exact:true}).click();await page.getByLabel('Project introduction').fill('Keep this local introduction');
      if(action==='publish')await publish().click();else await duration().selectOption('7_DAYS');
      await page.getByRole('heading',{name:'Review saved status',exact:true}).waitFor();
      assert.equal(calls,count+1);assert.equal(await duration().isDisabled(),true);assert.equal(await duration().inputValue(),'REVIEW');
      assert.equal(await page.getByRole('link',{name:'View live project',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Archive project',exact:true}).isDisabled(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const reload=page.getByRole('button',{name:'Review saved project status',exact:true});await reload.scrollIntoViewIfNeeded();
      if(action==='publish'&&failure==='uncertain')await page.screenshot({path:`release-evidence/studio-project-publishing-recovery-${width}.png`});
      page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(calls,count+1);assert.equal(await page.getByLabel('Project introduction').inputValue(),'Keep this local introduction');
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS reviewed publication and featured placement, duplicate requests, uncertain receipts and responsive recovery at 390/1440.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
