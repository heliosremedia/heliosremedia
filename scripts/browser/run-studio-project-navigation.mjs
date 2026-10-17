import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-navigation-fixture.jsx'], bundle: true, jsx: 'automatic', write: false });
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
    const page = await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith(origin)&&route.request().method()==='GET'?route.continue():route.abort());
    await page.goto(origin);
    const toggle=(title)=>page.getByRole('button',{name:`Expand ${title}`,exact:true});
    for(const title of ['Project Identity','Media','Services and SEO','Review and Publish']) assert.equal(await toggle(title).getAttribute('aria-expanded'),'false');
    const reached=async(id,title)=>{
      await page.waitForFunction(id=>document.activeElement?.id===id,id);
      assert.equal(await page.getByRole('button',{name:`Collapse ${title}`,exact:true}).getAttribute('aria-expanded'),'true');
      assert.equal(await page.getByLabel(`${title} draft`,{exact:true}).isVisible(),true);
      assert.equal(await page.locator(`#${id}`).evaluate(el=>{const nav=document.querySelector('nav[aria-label="Project Editor sections"]');return el.getBoundingClientRect().top>=nav.getBoundingClientRect().bottom-1}),true,'Target is below sticky navigation');
    };
    await page.getByRole('link',{name:'Open Details: Add summary',exact:true}).click();await reached('project-identity','Project Identity');
    await page.getByLabel('Project Identity draft',{exact:true}).fill('Preserve this local draft');
    await page.getByRole('button',{name:'Collapse Project Identity',exact:true}).click();
    await page.getByRole('link',{name:'Open Details: Add summary',exact:true}).click();await reached('project-identity','Project Identity');
    assert.equal(await page.getByLabel('Project Identity draft',{exact:true}).inputValue(),'Preserve this local draft');
    await page.getByRole('link',{name:'Upload media',exact:true}).click();await reached('project-media','Media');
    assert.equal(await page.evaluate(()=>location.hash),'#project-media');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`release-evidence/studio-project-navigation-${width}.png`,fullPage:false});
    await page.getByRole('link',{name:'Open Services: 0 selected',exact:true}).click();await reached('project-services','Services and SEO');
    await page.getByRole('button',{name:'Collapse Services and SEO',exact:true}).click();
    const publish=page.getByRole('link',{name:'Open Publish: Draft',exact:true});await publish.focus();await page.keyboard.press('Enter');await reached('project-publishing','Review and Publish');
    await page.goBack();await page.waitForFunction(()=>location.hash==='#project-services');
    await page.getByLabel('Services and SEO draft',{exact:true}).waitFor({state:'visible'});
    assert.equal(await page.getByLabel('Project Identity draft',{exact:true}).inputValue(),'Preserve this local draft');
    assert.equal(await page.evaluate(()=>window.fixtureBoots),1,'Section navigation must not remount drafts');
    await page.goto(`${origin}/#project-media`);await page.getByLabel('Media draft',{exact:true}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Collapse Media',exact:true}).click();
    await page.getByRole('link',{name:'Open Media: 0 assets',exact:true}).click();await reached('project-media','Media');
    await page.getByLabel('Media draft',{exact:true}).fill('Keep attached media notes');
    if(width===390) await page.getByRole('combobox').selectOption('project-publishing');
    else await page.getByRole('button',{name:'Review and Publish',exact:true}).click();
    await reached('project-publishing','Review and Publish');
    assert.equal(await page.getByLabel('Media draft',{exact:true}).inputValue(),'Keep attached media notes');
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS real project progress cards, media CTA, initial/repeated hash, history, keyboard and existing navigator reveal mounted sections without losing drafts at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
