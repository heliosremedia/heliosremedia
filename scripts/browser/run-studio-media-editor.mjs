import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-media-editor-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-transports', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|image)$|^\.\/(MediaUploader|StreamVideoUploader|ExternalMediaForm)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path === 'next/navigation' ? 'export const useRouter=()=>({refresh(){window.refreshCount=(window.refreshCount||0)+1}})' : 'export default function SyntheticBoundary(){return null}' }));
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
    const item={id:'media',sourceType:'UPLOADED_IMAGE',provider:null,storageKey:null,originalFilename:'Owned photograph',altText:'Existing description',caption:'Existing caption',mimeType:'image/jpeg',externalUrl:null,externalId:null,fileSize:100,width:100,height:100,aspectRatio:1,mediaCategory:'PHOTOGRAPHY',serviceId:'service',displayOrder:0,visibility:'VISIBLE',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',publicUrl:'',isHero:false};
    let mode='pending', calls=0, release;
    await page.route('**/api/admin/projects/synthetic/media',async route=>{
      if(route.request().method()==='GET') return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,media:[item]})});
      assert.equal(route.request().method(),'PATCH');calls++;
      const body=route.request().postDataJSON();assert.equal(body.action,'update-asset');assert.equal(body.expectedUpdatedAt,item.updatedAt);
      if(mode==='pending') await new Promise(resolve=>{release=resolve});
      if(mode==='conflict') return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:'This asset changed. Copy the draft and reload.',reloadRequired:true})});
      if(mode==='uncertain') return route.abort();
      return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,media:{...item,...body,updatedAt:'2026-01-02T00:00:00.000Z'}})});
    });
    const open=async()=>{await page.goto(origin);await page.getByRole('button',{name:'Open actions for Owned photograph',exact:true}).click();await page.getByRole('menuitem',{name:'Edit asset details',exact:true}).click();await page.getByRole('dialog',{name:'Edit asset details'}).waitFor();};
    await open();await page.getByLabel('Asset filename',{exact:true}).fill('Reviewed photograph');
    await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Saving asset',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Asset filename',{exact:true}).isDisabled(),true);
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Edit asset details'}).count(),1);
    while(!release) await new Promise(resolve=>setTimeout(resolve,10));release();
    await page.getByRole('dialog',{name:'Edit asset details'}).waitFor({state:'detached'});assert.equal(calls,1);
    for(const failure of ['conflict','uncertain']) {
      mode=failure;await open();await page.getByLabel('Asset filename',{exact:true}).fill('Keep this draft filename');
      await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('dialog').getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('Asset filename',{exact:true}).inputValue(),'Keep this draft filename');
      assert.equal(await page.getByLabel('Asset filename',{exact:true}).isDisabled(),false);
      assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Reload saved media',exact:true}).count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.getByRole('dialog').locator('form').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
      if(failure==='conflict') await page.screenshot({path:`release-evidence/studio-media-editor-${width}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS media metadata reviewed save, busy guard, conflict/uncertain draft preservation and paused retry at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
