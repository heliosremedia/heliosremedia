import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {check} from './diagnostics.mjs';
import {syntheticCookie} from '../hosted-session.ts';
export function revision(workspaceId,rows){return createHash('sha256').update(JSON.stringify([workspaceId,'projects',[...rows].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>[r.id,r.projectId,r.displayOrder,new Date(r.updatedAt).toISOString()])])).digest('hex');}
export async function qualifyHTTP(db,bindings,secret,bypass,browserType=chromium){
 process.env.AUTH_SECRET=secret;const browser=await browserType.launch({headless:true});const results=[];
 try{for(const {workspaceId:id,hostname} of bindings){
  const other=id==='packet16-a'?'packet16-b':'packet16-a';const origin='https://'+hostname;
  const user=(await db.query('SELECT * FROM "AdminUser" WHERE id=$1',[id+'-owner'])).rows[0];
  const membership=(await db.query('SELECT * FROM "WorkspaceMembership" WHERE "userId"=$1 AND "workspaceId"=$2',[user.id,id])).rows[0];
  const cookie=syntheticCookie({workspaceId:id,hostname,allowedHosts:bindings.map(b=>b.hostname),user,membership});
  const context=await browser.newContext({extraHTTPHeaders:{'x-vercel-skip-toolbar':'1',...(bypass?{'x-vercel-protection-bypass':bypass}:{})}});
  try{
   const publicResponse=await context.request.get(origin+'/',{maxRedirects:0,timeout:30000});check('HTTP_PUBLIC_STATUS',()=>assert.equal(publicResponse.status(),200));
   const publicHTML=await publicResponse.text();assert.ok(publicHTML.includes('Synthetic '+id));assert.ok(!publicHTML.includes('Synthetic '+other));
   const anonymous=await context.request.patch(origin+'/api/admin/homepage-projects',{data:{},maxRedirects:0,timeout:30000});check('HTTP_ANONYMOUS_STATUS',()=>assert.equal(anonymous.status(),401));
   await context.addCookies([cookie]);
   const admin=await context.request.get(origin+'/admin/homepage',{maxRedirects:0,timeout:30000});check('HTTP_ADMIN_STATUS',()=>assert.equal(admin.status(),200));
   const html=await admin.text();assert.ok(html.includes(id+'-placement'));assert.ok(!html.includes(other+'-placement'));
   const snapshot=async()=> (await db.query('SELECT h.* FROM "HomepageProject" h JOIN "Project" p ON p.id=h."projectId" WHERE p."workspaceId"=$1 ORDER BY h.id',[id])).rows;
   const before=await snapshot(),rev=revision(id,before);assert.equal(before.length,1);
   const untouched=(await db.query('SELECT * FROM "HomepageProject" WHERE id=$1',[other+'-placement'])).rows;
   const patch=(placementId,r,title)=>context.request.patch(origin+'/api/admin/homepage-projects',{headers:{'x-curation-revision':r,'x-curation-request':randomUUID()},data:{placementId,titleOverride:title},maxRedirects:0,timeout:30000});
   assert.equal((await patch(other+'-placement',rev,'Forbidden')).status(),404);
   const races=await Promise.all(['one','two'].map(v=>patch(id+'-placement',rev,'Synthetic hosted '+v)));
   assert.deepEqual(races.map(r=>r.status()).sort(),[200,409]);
   const ack=(await races.find(r=>r.status()===200).json()).acknowledgement;
   const after=await snapshot();assert.equal(ack.workspaceId,id);assert.equal(ack.previousRevision,rev);assert.equal(ack.revision,revision(id,after));assert.notEqual(ack.revision,rev);
   assert.equal((await patch(id+'-placement',rev,'Stale')).status(),409);
   assert.deepEqual((await db.query('SELECT * FROM "HomepageProject" WHERE id=$1',[other+'-placement'])).rows,untouched);
   const blocked=[];await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin){blocked.push(u.hostname);return route.abort();}return route.continue();});
   for(const width of [390,1440]){const page=await context.newPage();await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',()=>errors.push('pageerror'));
    const response=await page.goto(origin+'/admin/homepage',{waitUntil:'networkidle',timeout:60000});check('HTTP_BROWSER_STATUS',()=>assert.equal(response?.status(),200));await page.getByRole('heading',{name:'Homepage curation',exact:true}).waitFor();assert.equal(errors.length,0);await page.close();}
   check('HTTP_BROWSER_EGRESS',()=>assert.equal(blocked.length,0,'Unexpected browser egress blocked'));results.push({workspace:id,publicRead:true,adminRead:true,foreignWrite:404,concurrent:[200,409],stale:409,widths:[390,1440],externalRequests:0});
  }finally{await context.close();}
 }}finally{await browser.close();delete process.env.AUTH_SECRET;}
 return results;
}
