/** Computed cascade regression fixture. No service calls, real data or HTTP server. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const compile = async path => (await postcss([tailwind()]).process(await fs.readFile(path,'utf8'),{from:path})).css;
const globalCss=await compile('app/globals.css');
const themeCss=await compile('app/admin/studio-appearance.css');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
try {
 const page=await browser.newPage();
 // Chromium/Tailwind may serialize equivalent colors as rgb, rgba or oklab.
 // Compare rendered sRGB pixels rather than requiring one serialization format.
 const assertColor=async(actual,expected)=>{
  const colors=await page.evaluate(([a,b])=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const context=canvas.getContext('2d',{willReadFrequently:true});
   return [a,b].map(color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return Array.from(context.getImageData(0,0,1,1).data);});
  },[actual,expected]);
  assert.ok(colors[0].every((channel,index)=>Math.abs(channel-colors[1][index])<=1),`Color mismatch: ${actual} vs ${expected}; ${JSON.stringify(colors)}`);
 };

 // WCAG text contrast from computed colors, compositing translucent fills through
 // their actual fixture ancestors instead of assuming an opaque button surface.
 const assertContrast=async(id,label)=>{
  const ratio=await page.locator(id).evaluate(el=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);};
   const over=(fg,bg)=>fg.slice(0,3).map((c,i)=>c*fg[3]/255+bg[i]*(1-fg[3]/255));
   const ancestors=[];for(let node=el;node;node=node.parentElement) ancestors.unshift(node);
   let background=[255,255,255];
   for(const node of ancestors) background=over(rgba(getComputedStyle(node).backgroundColor),background);
   const foreground=over(rgba(getComputedStyle(el).color),background);
   const luminance=rgb=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
   const a=luminance(foreground),b=luminance(background);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  assert.ok(ratio>=4.5,`${label} ${id}: text contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
 };

 for(const order of [[globalCss,themeCss],[themeCss,globalCss]]) {
  for(const [mode,scheme] of [['day','light'],['day','dark'],['night','dark'],['night','light'],['system','light'],['system','dark']]) {
   const resolvedScheme=mode==='system'?scheme:mode==='day'?'light':'dark';
   const label=`${mode}/${scheme}`;
   await page.emulateMedia({colorScheme:scheme});
   await page.setContent(`<style>${order.join('\n')} * { transition:none!important; }</style><button id="public" class="admin-btn-primary">Public</button><button id="public-small" class="admin-btn-icon-sm">Public small</button><div class="admin-form-scope" data-studio-appearance="${mode}"><main><button id="selected" class="admin-btn-secondary admin-choice" aria-pressed="true">Desktop</button><button id="other" class="admin-btn-secondary admin-choice" aria-pressed="false">Mobile</button><button id="studio" class="admin-btn-primary">Studio</button><button id="icon" class="admin-btn-icon">+</button><button id="icon-small" class="admin-btn-icon-sm">+</button><button id="success" class="admin-btn-success">Saved</button>${['neutral','success','warning','error'].map(tone=>`<p id="status-${tone}" class="admin-status admin-status-${tone}">${tone} message</p><span id="badge-${tone}" class="admin-status-badge admin-status-${tone}">${tone}</span>`).join('')}</main></div>`);
   const css=id=>page.locator(id).evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderColor}));
   await page.mouse.move(0,0);
   for(const id of ['#selected','#other','#studio','#success',...['neutral','success','warning','error'].flatMap(tone=>[`#status-${tone}`,`#badge-${tone}`])]) await assertContrast(id,`${label} default`);
   await page.locator('#success').hover();await assertContrast('#success',`${label} hover`);
   const selected=await css('#selected'),other=await css('#other');
   assert.notDeepEqual(selected,other, `${mode}/${scheme}: selected control must remain distinct`);
   await assertColor(selected.border,'rgb(217, 107, 43)');
   await page.locator('#public').hover();await assertColor((await css('#public')).background,'rgba(217, 107, 43, 0.12)');
   await page.locator('#studio').hover();await assertColor((await css('#studio')).background,resolvedScheme==='light'?'rgb(52, 54, 58)':'rgb(38, 38, 41)');
   await assertContrast('#studio',`${label} hover`);
   await page.locator('#other').hover();await assertContrast('#other',`${label} hover`);
   for(const id of ['#icon','#icon-small']) {
    await page.locator(id).hover();await assertColor((await css(id)).background,resolvedScheme==='light'?'rgb(232, 233, 235)':'rgb(38, 38, 41)');
    await page.mouse.down();await assertColor((await css(id)).background,resolvedScheme==='light'?'rgb(218, 221, 223)':'rgb(48, 48, 52)');await page.mouse.up();
   }
   await page.locator('#public-small').hover();await assertColor((await css('#public-small')).background,'rgba(217, 107, 43, 0.08)');
   await page.mouse.down();await assertColor((await css('#public-small')).background,'rgba(217, 107, 43, 0.14)');await page.mouse.up();
  }
 }
 console.log('PASS: computed selected state and scoped public/Studio hovers, Day/Night/System, both stylesheet orders; shared action/status text contrast including explicit opposite OS themes.');
} finally {await browser.close();}
