import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {egressCategories,assertNoEgress} from '../actions/egress.mjs';
// Ordinary login only: no signed-cookie minting, traces, headers or password artifacts.
export async function qualifyOwners(bindings,passwords,bypass,{browserType=chromium}={}){
 const browser=await browserType.launch({headless:true}),results=[];
 try{for(let i=0;i<bindings.length;i++){
  const {workspaceId:id,hostname}=bindings[i],other=bindings[1-i].workspaceId,origin='https://'+hostname;
  const ctx=await browser.newContext({extraHTTPHeaders:{'x-vercel-skip-toolbar':'1',...(bypass?{'x-vercel-protection-bypass':bypass}:{})}});
  try{
   const blocked=[];await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin){blocked.push(egressCategories(u.href,route.request().resourceType()));return route.abort();}return route.continue();});
   const denied=await ctx.request.get(origin+'/admin/studio',{maxRedirects:0,timeout:30000});assert.equal(denied.status(),307);
   const wrong=await ctx.request.post(origin+'/api/admin/auth/login',{data:{email:id+'@example.test',password:passwords[1-i]},maxRedirects:0,timeout:30000});assert.equal(wrong.status(),401);
   const page=await ctx.newPage(),errors=[];page.on('pageerror',()=>errors.push('pageerror'));
   await page.goto(origin+'/login?next=%2Fadmin%2Fstudio',{waitUntil:'networkidle',timeout:60000});
   await page.getByLabel('Email',{exact:true}).fill(id+'@example.test');await page.getByLabel('Password',{exact:true}).fill(passwords[i]);await page.getByRole('button',{name:'Enter workspace',exact:true}).click();
   await page.getByRole('heading',{name:'Command Center',exact:true}).waitFor({timeout:60000});assert.equal(errors.length,0);
   for(const width of [390,1440]){
    await page.setViewportSize({width,height:900});await page.reload({waitUntil:'networkidle',timeout:60000});await page.getByRole('heading',{name:'Command Center',exact:true}).waitFor();
    assert.equal(errors.length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
   }
   const own=await ctx.request.get(origin+'/api/admin/projects/'+id+'-project/media',{maxRedirects:0,timeout:30000});assert.equal(own.status(),200);
   const foreign=await ctx.request.get(origin+'/api/admin/projects/'+other+'-project/media',{maxRedirects:0,timeout:30000});assert.equal(foreign.status(),404);
   const logout=await ctx.request.post(origin+'/api/admin/auth/logout',{maxRedirects:0,timeout:30000});assert.equal(logout.status(),200);
   assert.equal((await ctx.request.get(origin+'/admin/studio',{maxRedirects:0,timeout:30000})).status(),307);
   const again=await ctx.request.post(origin+'/api/admin/auth/login',{data:{email:id+'@example.test',password:passwords[i]},maxRedirects:0,timeout:30000});assert.equal(again.status(),200);
   assert.equal((await ctx.request.get(origin+'/admin/studio',{maxRedirects:0,timeout:30000})).status(),200);
   assert.equal((await ctx.request.post(origin+'/api/admin/auth/logout',{maxRedirects:0,timeout:30000})).status(),200);
   assertNoEgress(blocked);results.push({workspace:id,ordinaryBrowserPasswordLogin:true,incorrectPasswordDenied:401,ownedProject:200,foreignProject:404,refreshPersistsSession:true,logoutClearsSession:true,storedPasswordReLogin:true,widths:[390,1440],externalBrowserRequests:0});
  }finally{await ctx.close();}
 }}finally{await browser.close();}
 return results;
}
