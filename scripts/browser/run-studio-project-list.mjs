import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-list-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-router', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ resolveDir: process.cwd(), contents: args.path === 'next/image' ? 'export default function Image(){return null}' : args.path === 'next/link' ? 'import React from \"react\"; export default function Link(p){return React.createElement(\"a\",p)}' : 'export const useRouter=()=>({refresh(){window.refreshCount=(window.refreshCount||0)+1}})' }));
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
    let writes=0, revision="a".repeat(64), mode="success", release;
    await page.route('**/api/admin/projects/order',async route=>{writes++;const body=route.request().postDataJSON();assert.equal(body.expectedRevision,revision);assert.deepEqual(new Set(body.projectIds),new Set(['draft','published','archived']));if(mode==='pending')await new Promise(resolve=>{release=resolve});if(mode==='uncertain')return route.abort();if(mode==='json')return route.fulfill({contentType:'application/json',body:'invalid'});if(mode==='conflict')return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,reloadRequired:true})});const next=revision==='b'.repeat(64)?'c'.repeat(64):'b'.repeat(64);await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,workspaceId:mode==='foreign'?'b':'a',revision:mode==='stale'?revision:next,projectIds:mode==='wrong-order'?[...body.projectIds].reverse():body.projectIds})});revision=next;});
    await page.goto(origin+'/');
    const title=page.getByRole('link',{name:'A private mountain property with a long descriptive project name',exact:true});
    await title.waitFor();
    assert.equal(await title.getAttribute('href'),'/admin/projects/draft?returnTo=%2Fadmin%2Fprojects');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(width===390){
      assert.equal(await page.locator('table').evaluate(table=>table.getBoundingClientRect().width<=innerWidth-32),true);
      for(const status of ['Draft','Published','Archived']) assert.equal(await page.getByText(status,{exact:true}).filter({visible:true}).count(),1);
      for(const link of await page.getByRole('link',{name:'Edit →',exact:true}).all()) {
        const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
      }
      assert.equal(await page.getByText('Boulder, Colorado · 1 asset',{exact:true}).isVisible(),true);
    }
    await page.screenshot({path:`release-evidence/studio-project-list-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Select',exact:true}).click();
    await page.getByRole('checkbox',{name:'Select Retained project',exact:true}).check();
    await page.getByRole('button',{name:'Move top',exact:true}).click();
    await page.getByText('Project order saved. The portfolio now uses this order.',{exact:true}).waitFor();
    assert.equal(writes,1);assert.ok((await page.locator('tbody tr').first().innerText()).includes('Retained project'));
    await page.getByRole('button',{name:'Done',exact:true}).click();
    const handle=page.getByRole('button',{name:'Move project Retained project',exact:true});
    await handle.focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('button[aria-pressed="true"]'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(()=>document.body.textContent.includes('over droppable area draft'));
    await page.keyboard.press('Space');
    await page.waitForFunction(()=>document.querySelector('tbody tr')?.textContent.includes('A private mountain'));
    assert.equal(writes,2);
    for(const outcome of ['pending','uncertain','json','conflict','foreign','stale','wrong-order']) {
      revision='a'.repeat(64);mode=outcome;release=undefined;await page.goto(origin+'/');
      await page.getByRole('button',{name:'Select',exact:true}).click();
      await page.getByRole('checkbox',{name:'Select Retained project',exact:true}).check();
      const count=writes;await page.getByRole('button',{name:'Move top',exact:true}).evaluate(button=>{button.click();button.click()});
      if(outcome==='pending'){
        await page.getByText('Saving project order…',{exact:true}).waitFor();
        assert.equal(await page.getByRole('button',{name:'Move bottom',exact:true}).isDisabled(),true);
        assert.equal(await page.getByRole('checkbox',{name:'Select City residence',exact:true}).isDisabled(),true);
        while(!release)await new Promise(resolve=>setTimeout(resolve,10));release();
        await page.getByText('Project order saved. The portfolio now uses this order.',{exact:true}).waitFor();
      }else{
        const reload=page.getByRole('button',{name:'Review saved project order',exact:true});await reload.waitFor();
        assert.equal(await page.getByRole('button',{name:'Move bottom',exact:true}).isDisabled(),true);
        assert.ok((await page.locator('tbody tr').first().innerText()).includes('Retained project'));
        assert.equal(await page.getByRole('checkbox',{name:'Select Retained project',exact:true}).isChecked(),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        if(outcome==='conflict')await page.screenshot({path:`release-evidence/studio-project-order-recovery-${width}.png`,fullPage:true});
        page.once('dialog',dialog=>dialog.dismiss());await reload.click();assert.equal(await reload.isVisible(),true);
      }
      assert.equal(writes,count+1);
    }
    await page.goto(origin+'/?filtered=1');
    assert.equal(await page.getByRole('button',{name:'Select',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Move project Retained project',exact:true}).isDisabled(),true);
    assert.equal(await title.getAttribute('href'),'/admin/projects/draft?returnTo=%2Fadmin%2Fprojects%3Fstatus%3DDRAFT');
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS responsive project list at 390/1440: visible title/status/actions, preserved return filters, selection moves and keyboard ordering; synthetic transport only');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
