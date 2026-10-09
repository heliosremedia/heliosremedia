import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['scripts/browser/studio-project-create-fixture.jsx'], bundle: true, jsx: 'automatic', write: false,
  plugins: [{ name: 'synthetic-create-action', setup(b) {
    b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
    b.onResolve({ filter: /^\.\/actions$/ }, args => args.importer.endsWith('NewProjectForm.tsx') ? { path: 'action', namespace: 'synthetic' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ loader: 'jsx', resolveDir: process.cwd(), contents: args.path === 'next/link' ? 'export default function Link(props){return <a {...props}/>}' : args.path === 'action'
      ? 'export async function createProject(previous,data){const r=await fetch("/synthetic-create",{method:"POST",body:JSON.stringify(Object.fromEntries(data))});return r.json()}'
      : 'const router={push(path){window.pushed=path}};export const useRouter=()=>router;' }));
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
    let mode='validation', calls=0;
    await page.route('**/synthetic-create',async route=>{
      calls++; const body=route.request().postDataJSON();assert.equal(body.requestId,'00000000-0000-4000-8000-000000000001');
      assert.equal(body.city,'Fort Collins');assert.equal(body.shortDescription,'Keep this description');
      if(mode==='uncertain') return route.abort();
      return route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='validation'?{error:'Review the project fields.'}:{error:null,projectId:'synthetic-created'})});
    });
    const fill = async () => {
      await page.goto(origin);await page.getByLabel('Project title',{exact:false}).fill('Synthetic home');
      await page.getByLabel('City',{exact:true}).fill('Fort Collins');await page.getByLabel('Short description',{exact:true}).fill('Keep this description');
    };
    await fill();
    await page.getByRole('button',{name:'Create draft',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('City',{exact:true}).inputValue(),'Fort Collins');
    assert.equal(await page.getByLabel('Short description',{exact:true}).inputValue(),'Keep this description');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`release-evidence/studio-project-create-${width}.png`,fullPage:true});
    mode='success';await page.getByRole('button',{name:'Create draft',exact:true}).click();await page.waitForFunction(()=>window.pushed==='/admin/projects/synthetic-created');
    assert.equal(await page.getByRole('button',{name:'Create draft',exact:true}).isDisabled(),true);
    mode='uncertain';await fill();await page.getByRole('button',{name:'Create draft',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('City',{exact:true}).inputValue(),'Fort Collins');
    assert.equal(await page.getByLabel('Short description',{exact:true}).inputValue(),'Keep this description');
    assert.equal(await page.getByRole('button',{name:'Create draft',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('link',{name:'check Projects',exact:true}).getAttribute('href'),'/admin/projects');
    assert.equal(calls,3);assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS draft creation controlled fields survive validation and uncertain transport, success opens the draft and uncertain creation pauses resubmission at 390/1440');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
