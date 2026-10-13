import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const scratch = await mkdtemp(join(tmpdir(), 'helios-login-'));
let browser;
try {
  const navigation = join(scratch, 'navigation.js');
  const fixture = join(scratch, 'fixture.jsx');
  await writeFile(navigation, 'export const useRouter=()=>({replace(path){window.__destination=path},refresh(){window.__refreshes++}});');
  await writeFile(fixture, [
    'import React from "react"; import {createRoot} from "react-dom/client";',
    'import LoginForm from '+JSON.stringify(join(process.cwd(), 'app/login/LoginForm.tsx'))+';',
    'window.__requests=[]; window.__refreshes=0; window.__destination=null;',
    'window.fetch=async(url,options)=>{window.__requests.push({url,method:options.method,body:JSON.parse(options.body)});return new Promise((resolve,reject)=>{window.__resolve=resolve;window.__reject=reject})};',
    'createRoot(document.getElementById("root")).render(<main className="admin-form-scope min-h-screen bg-[#080809] p-5 text-white"><section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#111] p-7"><h1 className="text-3xl">Welcome back.</h1><LoginForm next="/admin/studio"/></section></main>);',
  ].join('\n'));
  const bundle = await build({entryPoints:[fixture],bundle:true,platform:'browser',format:'iife',write:false,jsx:'automatic',nodePaths:[join(process.cwd(),'node_modules')],
    plugins:[{name:'synthetic-navigation',setup(api){api.onResolve({filter:/^next\/navigation$/},()=>({path:navigation}));}}]});
  const css = await postcss([tailwind()]).process(await readFile('app/globals.css','utf8'),{from:'app/globals.css'});
  await mkdir('release-evidence',{recursive:true});
  browser = await chromium.launch({headless:true});
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.route('**/*',route=>route.abort());
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({content:css.css});await page.addScriptTag({content:bundle.outputFiles[0].text});
    const email=page.getByLabel('Email',{exact:true}),password=page.getByLabel('Password',{exact:true});
    await email.fill('owner@example.test');await password.fill('synthetic-password-only');
    // Two same-tick submit events reproduce re-entry before React commits disabled state.
    await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
    await page.getByRole('button',{name:'Signing in…',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__requests.length),1);
    assert.equal(await email.isDisabled(),true);assert.equal(await password.isDisabled(),true);
    await page.screenshot({path:'release-evidence/studio-login-pending-'+width+'.png'});
    await page.evaluate(()=>window.__reject(new TypeError('synthetic transport detail')));
    const alert=page.getByRole('alert');await alert.waitFor();
    assert.match(await alert.innerText(),/Check your connection and try again/);
    assert.doesNotMatch(await alert.innerText(),/synthetic transport detail/);
    assert.equal(await email.inputValue(),'owner@example.test');assert.equal(await password.inputValue(),'synthetic-password-only');
    assert.equal(await email.isDisabled(),false);
    assert.equal(await page.evaluate(()=>window.__destination),null);
    await page.screenshot({path:'release-evidence/studio-login-recovery-'+width+'.png'});
    const submit=page.getByRole('button',{name:'Enter workspace',exact:true});
    await submit.click();await page.waitForFunction(()=>window.__requests.length===2);
    await page.evaluate(()=>window.__resolve(new Response('<html>Unavailable</html>',{status:503})));
    await page.waitForFunction(()=>document.querySelector('form')?.getAttribute('aria-busy')==='false');
    assert.match(await alert.innerText(),/Sign-in could not be confirmed/);
    assert.doesNotMatch(await alert.innerText(),/Unexpected token|SyntaxError/);
    await submit.click();await page.waitForFunction(()=>window.__requests.length===3);
    await page.evaluate(()=>window.__resolve(Response.json({success:false,error:'The email or password is incorrect.'},{status:401})));
    await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent==='The email or password is incorrect.');
    assert.equal(await page.evaluate(()=>window.__destination),null);
    await submit.click();await page.waitForFunction(()=>window.__requests.length===4);
    await page.evaluate(()=>window.__resolve(Response.json({success:true})));
    await page.waitForFunction(()=>window.__destination==='/admin/studio');
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.getByRole('button',{name:'Signing in…',exact:true}).isDisabled(),true);
    await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(await page.evaluate(()=>window.__requests.length),4,'no duplicate login while navigation is pending');
    assert.equal(await page.evaluate(()=>window.__refreshes),1);
    assert.equal(await page.evaluate(()=>window.__requests.every(r=>r.url==='/api/admin/auth/login'&&r.method==='POST'&&r.body.email==='owner@example.test'&&r.body.password==='synthetic-password-only')),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('PASS login at 390/1440: one pending request, retained inputs, transport/invalid-response recovery, server rejection and confirmed navigation; synthetic transport only');
} finally {
  await browser?.close();
  await rm(scratch,{recursive:true,force:true});
}
