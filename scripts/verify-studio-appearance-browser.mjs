/** Synthetic browser QA: actual client components and stylesheet, no production data or APIs. */
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';
const output=path.resolve('.studio-appearance-qa');
await fs.mkdir(output,{recursive:true});
const nextMocks={name:'next-router-fixture',setup(b){
 b.onResolve({filter:/^next\/(navigation|link)$/},args=>({path:args.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.endsWith('navigation')?'export const usePathname=()=>"/admin"; export const useRouter=()=>({replace(){},refresh(){}});':'import React from "react"; export default function Link({children,...props}){return React.createElement("a",props,children)}',resolveDir:process.cwd()}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
}};
const common={bundle:true,plugins:[nextMocks],jsx:'automatic',logLevel:'error'};
await build({...common,entryPoints:['scripts/fixtures/studio-appearance.tsx'],platform:'node',format:'cjs',external:['react','react-dom'],outfile:`${output}/fixture.cjs`});
await build({...common,stdin:{contents:'import React from "react"; import {hydrateRoot} from "react-dom/client"; import App from "./scripts/fixtures/studio-appearance"; hydrateRoot(document.getElementById("root"),React.createElement(App));',resolveDir:process.cwd(),loader:'tsx'},platform:'browser',outfile:`${output}/client.js`});
const App=createRequire(import.meta.url)(`${output}/fixture.cjs`).default;
const base=await postcss([tailwind()]).process(await fs.readFile('app/globals.css','utf8'),{from:'app/globals.css'});
const appearance=await postcss([tailwind()]).process(await fs.readFile('app/admin/studio-appearance.css','utf8'),{from:'app/admin/studio-appearance.css'});
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${base.css}\n${appearance.css}</style></head><body><div id="root">${renderToString(React.createElement(App))}</div><script src="/client.js"></script></body></html>`;
const server=createServer(async(req,res)=>{
 if(['/fonts/helios.otf','/fonts/heliosbold.ttf','/fonts/heliosbolditalic.ttf'].includes(req.url)){res.setHeader('content-type',req.url.endsWith('.otf')?'font/otf':'font/ttf');res.end(await fs.readFile('public'+req.url));return;}
 res.setHeader('content-type',req.url==='/client.js'?'text/javascript':'text/html');res.end(req.url==='/client.js'?await fs.readFile(`${output}/client.js`):html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
 const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);await page.getByRole('radio',{name:'System',exact:true}).waitFor();
 const surface=()=>page.locator('.admin-form-scope').first().evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(await surface(),'rgb(244, 244, 243)');
 await page.getByText('Night',{exact:true}).click();assert.equal(await surface(),'rgb(9, 9, 10)');
 await page.reload();assert.equal(await page.getByRole('radio',{name:'Night',exact:true}).isChecked(),true);
 assert.equal(await surface(),'rgb(9, 9, 10)');
 await page.screenshot({path:`${output}/night-desktop.png`,fullPage:true});
 await page.getByText('Day',{exact:true}).click();assert.equal(await surface(),'rgb(244, 244, 243)');
 assert.equal(await page.getByLabel('Legacy solid black field').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
 assert.notEqual(await page.getByRole('checkbox').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
 await page.screenshot({path:`${output}/day-desktop.png`,fullPage:true});
 await page.getByRole('radio',{name:'Day',exact:true}).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await page.getByRole('radio',{name:'Night',exact:true}).isChecked(),true);
 await page.getByText('System',{exact:true}).click();await page.emulateMedia({colorScheme:'dark'});assert.equal(await surface(),'rgb(9, 9, 10)');
 await page.emulateMedia({colorScheme:'light'});assert.equal(await surface(),'rgb(244, 244, 243)');
 const tab=await context.newPage();await tab.goto(url);await tab.getByText('Night',{exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.admin-form-scope').dataset.studioAppearance==='night');await tab.close();
 await page.getByText('Day',{exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.screenshot({path:`${output}/day-mobile.png`,fullPage:true});
 assert.ok(await page.getByRole('radio',{name:'Day',exact:true}).isVisible());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 // Bootstrap must also preserve stored Night before hydration can execute.
 const noHydration=await context.newPage();await noHydration.route('**/client.js',r=>r.abort());
 await noHydration.addInitScript(()=>localStorage.setItem('helios-studio-appearance','night'));
 await noHydration.goto(url);assert.equal(await noHydration.locator('.admin-form-scope').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(9, 9, 10)');
 console.log('PASS: hydrated actual shell, persistence/reload, native keyboard radios, live system changes, cross-tab storage, mobile drawer, no overflow, no hydration errors, pre-hydration persisted theme.');
} finally {await browser.close();server.close();}
