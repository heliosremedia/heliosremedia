import assert from 'node:assert/strict';
import {chromium} from 'playwright';
export async function checkLayoutEditor(url){
 const browser=await chromium.launch({headless:true});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',route=>route.request().url().startsWith(url)&&route.request().method()==='GET'?route.continue():route.abort());
  const move=()=>page.getByRole('button',{name:'Move homepage-navigation down',exact:true});
  const order=()=>page.locator('section[id]').evaluateAll(nodes=>nodes.map(n=>n.id));
  await page.goto(url);await move().click();await page.getByRole('status').filter({hasText:'Confirmed saved'}).waitFor();
  await move().click();await page.getByRole('status').filter({hasText:'Confirmed saved'}).waitFor();assert.equal(await page.evaluate(()=>window.layout.requests[1].headers['x-layout-revision']),'b'.repeat(64));
  for(const mode of ['lost','json','workspace','identity','revision','conflict','timeout','json-timeout']){
   await page.goto(url);await move().waitFor();await page.evaluate(m=>{window.layout.mode=m;},mode);
   await move().evaluate(button=>{button.click();button.click();});await page.getByLabel('Retained homepage drafts').waitFor();
   assert.equal(await page.evaluate(()=>window.layout.requests.length),1);assert.equal((await order())[0],'homepage-media');
   assert.match(await page.getByLabel('Retained homepage drafts').inputValue(),/homepage-media/);
   assert.equal(await page.getByRole('button',{name:'Reload to reconcile'}).isDisabled(),true);
   await page.getByLabel('I have retained all drafts shown above.').check();
   await page.getByRole('button',{name:'Reload to reconcile'}).click();await move().waitFor();assert.equal(await page.evaluate(()=>window.layout.requests.length),0);
  }
  await page.goto(url);await move().waitFor();await page.evaluate(()=>window.layout.mode='timeout');await move().click();await page.evaluate(()=>window.layout.remount());await page.evaluate(()=>window.layout.pending.forEach(f=>f()));await page.waitForTimeout(160);assert.equal((await order())[0],'homepage-navigation');
  await page.evaluate(()=>window.layout.mode='success');await move().click();await page.getByRole('status').filter({hasText:'Confirmed saved'}).waitFor();
  await page.goto(url+'/#homepage-navigation');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.layout.requests.length),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  console.log(`PASS private layout actual component ${width}px ${new Date().toISOString()}: revision, strict receipts, duplicate, uncertainty, retained copy/reload, timeouts, remount; synthetic transport`);await page.close();
 }}finally{await browser.close();}
}
