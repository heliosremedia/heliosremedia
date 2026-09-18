import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,symlink,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {DATABASE,PRIOR,CANDIDATE,requireIsolatedDatabase,requireLoopback} from './safety.mjs';
import {readHost} from '../restoration/http.mjs';
import {checkHomepageRollback} from '../check-homepage-rollback.mjs';
const root=process.cwd();
const candidateRevision=process.argv.includes('--restored-fixture')?'a0b018af4947cf52466534220eb2e725c8f239d2':CANDIDATE;
assert.equal((await readdir(root)).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0,'No runtime environment files permitted');
requireIsolatedDatabase(process.env.PACKET9_DATABASE_URL);
const scratch=await mkdtemp(join(tmpdir(),'helios-packet9-'));const children=[];const logs=new Map();let proxy,browser,driver;
const bundle=join(root,'scripts/rehearsal/application/driver.generated.mjs');
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CI:process.env.CI,NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:DATABASE,DIRECT_URL:DATABASE,PACKET9_DATABASE_URL:DATABASE,AUTH_SECRET:'packet9-isolated-synthetic-session-secret-only',STUDIO_V2_TENANT_CONTEXT_ENABLED:'true',R2_ACCOUNT_ID:'synthetic',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET_NAME:'synthetic',R2_PUBLIC_URL:'http://127.0.0.1:1/assets',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1',LEGACY_PUBLIC_HOSTS:'never.example.test'};
// No inherited provider/deployment credentials. All subprocesses receive only this allowlist.
async function command(cmd,args,cwd=root){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env,stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>out+=b);p.on('error',reject);p.on('exit',code=>code===0?resolve(out):reject(Error(cmd+' failed: '+out.slice(-9000))));});}
async function archive(ref,dest){await mkdir(dest,{recursive:true});await new Promise((resolve,reject)=>{const git=spawn('git',['archive',ref],{cwd:root});const tar=spawn('tar',['-x','-C',dest]);git.stdout.pipe(tar.stdin);git.on('error',reject);tar.on('error',reject);let gitCode;git.on('close',c=>{gitCode=c;});tar.on('close',c=>c===0&&(gitCode===0||gitCode===undefined)?resolve():reject(Error('archive failed')));});}
async function copy(dest,path){await mkdir(dirname(join(dest,path)),{recursive:true});await copyFile(join(root,path),join(dest,path));}
async function prepare(name,revision){
 const dir=join(scratch,name);await archive(revision,dir);
 assert.equal((await readdir(dir)).filter(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example').length,0,'Historical copy must not contain runtime environments');
 const manifest=JSON.parse(await readFile('scripts/rehearsal/homepage-writer-bundle.json','utf8'));
 if(name==='prior')assert.equal(checkHomepageRollback(dir).safe,false,'raw historical writer must fail');
 for(const {path} of manifest.files)await copy(dir,path);
 assert.equal(checkHomepageRollback(dir).safe,true);
 assert.equal(await readFile(join(dir,'prisma/schema.prisma'),'utf8'),await readFile('prisma/schema.prisma','utf8'),'schema must be identical');
 await symlink(join(root,'node_modules'),join(dir,'node_modules'),'dir');
 // Generated client is untracked, so copy it explicitly.
 const {cp}=await import('node:fs/promises');await cp(join(root,'app/generated'),join(dir,'app/generated'),{recursive:true});
 await writeFile(join(dir,'lib/prisma.ts'),`import {PrismaPg} from '@prisma/adapter-pg';import {PrismaClient} from '@/app/generated/prisma/client';export const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});`);
 const fonts=await readFile(join(dir,'app/layout.tsx'),'utf8');await writeFile(join(dir,'app/layout.tsx'),fonts.replace('import { Cormorant_Garamond, Inter } from "next/font/google";', 'const Cormorant_Garamond = (_options: unknown) => ({variable:""}); const Inter = (_options: unknown) => ({variable:""});'));
 await writeFile(join(dir,'lib/content-image-storage.ts'),`export async function verifyContentImage(key:string|null){if(!key)return;if(!key.startsWith('workspaces/a/homepage-work-cards/'))throw Error('Synthetic provider refuses foreign key');}export async function deleteContentImage(_key:string|null){throw Error('Storage deletion forbidden in rehearsal');}`);
 // Test-only state endpoint uses real auth, scoped queries and actual revision helpers, never a bypass.
 await mkdir(join(dir,'app/api/rehearsal-state'),{recursive:true});
 await writeFile(join(dir,'app/api/rehearsal-state/route.ts'),`import {NextResponse} from 'next/server';import {prisma} from '@/lib/prisma';import {getAdminSession} from '@/lib/auth/session';import {curationSnapshot} from '@/lib/homepage-curation-write';import {homepageLayoutRevision} from '@/lib/homepage-layout-revision';import {normalizeHomepageCurationPreferences} from '@/lib/homepage-curation-layout';export async function GET(){const s=await getAdminSession();if(!s)return NextResponse.json({error:'denied'},{status:401});const u=await prisma.adminUser.findUniqueOrThrow({where:{id:s.userId}});return NextResponse.json({projects:await curationSnapshot(prisma,s.workspaceId,'projects'),cards:await curationSnapshot(prisma,s.workspaceId,'work-cards'),cardRows:await prisma.homepageWorkCard.findMany({where:{service:{workspaceId:s.workspaceId}}}),settings:await prisma.siteSettings.findUnique({where:{workspaceId:s.workspaceId},select:{businessName:true}}),preferences:normalizeHomepageCurationPreferences(u.homepageCurationPreferences),storedPreferences:u.homepageCurationPreferences,layoutRevision:homepageLayoutRevision(u.id,u.workspaceId,u.homepageCurationPreferences)});}`);
 return dir;
}
async function start(name,dir,port){
 const mode=process.argv.includes('--dev')?'dev':'start';
 if(mode==='start'){console.log('Building full isolated '+name+' application');console.log((await command(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],dir)).slice(-2000));}
 const p=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),mode,...(mode==='dev'?['--webpack']:[]),'--hostname','127.0.0.1','--port',String(port)],{cwd:dir,env:{...env,NODE_ENV:mode==='dev'?'development':'production'},stdio:['ignore','pipe','pipe']});children.push(p);logs.set(p,'');const capture=b=>logs.set(p,(logs.get(p)+b).slice(-15000));p.stdout.on('data',capture);p.stderr.on('data',capture);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('startup timeout '+name)),90000);const check=()=>{if(/Ready in/.test(logs.get(p))){clearTimeout(timeout);resolve();}};p.stdout.on('data',check);p.on('exit',c=>{clearTimeout(timeout);reject(Error('application exited '+c));});p.on('error',reject);});return requireLoopback('http://127.0.0.1:'+port);
}
try{
 await command(process.execPath,['node_modules/prisma/build/index.js','generate']);
 await build({entryPoints:['scripts/rehearsal/application/driver.ts'],outfile:bundle,bundle:true,platform:'node',format:'esm',packages:'external'});
 if(process.argv.includes('--prepare-only')){console.log('PASS generated Prisma driver bundle and safety preparation; database/application not executed');}
 else{
  Object.assign(process.env,{PACKET9_DATABASE_URL:DATABASE,AUTH_SECRET:env.AUTH_SECRET});driver=await import(pathToFileURL(bundle));
  if(process.argv.includes('--restored-fixture')){
   assert.equal(process.env.PACKET10_REHEARSAL,'isolated-only');
   assert.equal(await driver.prisma.workspace.count(),2);
   assert.equal(await driver.prisma.legalDocument.count(),2);
   assert.equal(await driver.prisma.blogPost.count(),2);
   console.log('Using explicitly restored Packet10 fixture; no db push or reseeding');
  }else{
  const tables=await driver.prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public'");assert.equal(tables.length,0,'Refuse any populated database');
  console.log('PostgreSQL version:',await driver.prisma.$queryRawUnsafe('SELECT version()'));
  await command(process.execPath,['node_modules/prisma/build/index.js','db','push']);
  const registry=await readFile('prisma/migrations/20260911235500_workspace_asset_registry/migration.sql','utf8');
  const fn=registry.indexOf('CREATE FUNCTION'),trigger=registry.indexOf('CREATE TRIGGER');await driver.prisma.$executeRawUnsafe(registry.slice(fn,trigger));await driver.prisma.$executeRawUnsafe(registry.slice(trigger));
  await driver.seed();
  }
  assert.equal((await command('git',['rev-parse',PRIOR+':prisma/migrations'])).trim(),(await command('git',['rev-parse',CANDIDATE+':prisma/migrations'])).trim(),'Rehearsed source revisions must share migration history');
  const prior=await prepare('prior',PRIOR),candidate=await prepare('candidate',candidateRevision);
  const targets={prior:await start('prior',prior,45181),candidate:await start('candidate',candidate,45182)};let active='prior';
  proxy=createServer(async(req,res)=>{try{const target=targets[active];const name=active;const url=new URL(req.url,'http://127.0.0.1');assert.equal(url.origin,'http://127.0.0.1');const headers={};for(const [k,v] of Object.entries(req.headers))if(!['host','connection','content-length'].includes(k)&&!k.startsWith('x-forwarded'))headers[k]=v;const chunks=[];for await(const chunk of req)chunks.push(chunk);const upstream=await fetch(target+url.pathname+url.search,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual',signal:AbortSignal.timeout(120000)});res.statusCode=upstream.status;upstream.headers.forEach((v,k)=>{if(!['content-encoding','content-length','transfer-encoding','connection'].includes(k))res.setHeader(k,v);});res.setHeader('x-rehearsal-target',name);res.end(Buffer.from(await upstream.arrayBuffer()));}catch(error){res.statusCode=502;res.end(String(error));}});
  await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+proxy.address().port;
  const switchTo=name=>{assert.ok(name in targets);active=name;};
  if(process.argv.includes('--restored-fixture')){
   const headers={cookie:driver.cookie()};
   const locations=await fetch(origin+'/admin/locations',{headers});assert.equal(locations.status,200);const html=await locations.text();assert.match(html,/Location a/);assert.doesNotMatch(html,/Location b/);
   const settings=await fetch(origin+'/admin/settings',{headers});assert.equal(settings.status,200);const legal=await settings.text();assert.match(legal,/Synthetic legal a/);assert.doesNotMatch(legal,/Synthetic legal b/);
   const before=JSON.stringify(await driver.prisma.locationPage.findUnique({where:{id:'lb'}}));assert.equal((await fetch(origin+'/api/admin/locations?locationId=lb',{method:'DELETE',headers})).status,404);assert.equal(JSON.stringify(await driver.prisma.locationPage.findUnique({where:{id:'lb'}})),before);
   for(const [host,id] of [['127.0.0.1','a'],['localhost','b']]){const {status,text}=await readHost(targets.candidate,host);assert.equal(status,200);assert.ok(text.includes('REHEARSAL COMPANY '+id));assert.ok(!text.includes('REHEARSAL COMPANY '+(id==='a'?'b':'a')));}
   console.log('PASS restored actual admin legal/location reads, foreign removal denial and two public host settings scopes');
  }
  await driver.exercise(origin,switchTo);
  const asset=await driver.prisma.workspaceAsset.findFirstOrThrow();await assert.rejects(driver.prisma.workspaceAsset.update({where:{id:asset.id},data:{workspaceId:'b'}}));
  if(!process.argv.includes('--http-only')){
   const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
   for(const [width,loaded] of [[390,'prior'],[1440,'prior'],[390,'candidate'],[1440,'candidate']]){
    const context=await browser.newContext({viewport:{width,height:1000}});const token=driver.cookie().split('=').slice(1).join('=');await context.addCookies([{name:'helios_admin_session',value:token,url:origin}]);
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();switchTo(loaded);await page.goto(origin+'/admin/homepage#our-work');
    const cards=page.locator('#our-work');const title=cards.getByLabel('Card title',{exact:true}).first();await title.waitFor();
    let acknowledge,arrive;const arrived=new Promise(r=>arrive=r),held=new Promise(r=>acknowledge=r);let mutations=0,delay=true;
    await page.route('**/api/admin/homepage-work-cards',async route=>{mutations++;const response=await route.fetch();if(delay){arrive();await held;}await route.fulfill({response});});
    await title.fill('Retain across routing');switchTo(loaded==='prior'?'candidate':'prior');await cards.getByRole('button',{name:'Save card',exact:true}).first().click();await arrived;
    await title.fill('Newer edit while response held');switchTo('prior');delay=false;acknowledge();await cards.getByText('Submitted change saved ✓',{exact:true}).waitFor();assert.equal(await title.inputValue(),'Newer edit while response held');assert.equal(mutations,1);
    switchTo('prior');const state=await(await fetch(origin+'/api/rehearsal-state',{headers:{cookie:driver.cookie()}})).json();await fetch(origin+'/api/admin/homepage-work-cards',{method:'PATCH',headers:{cookie:driver.cookie(),'x-curation-revision':state.cards.revision,'x-curation-request':'other-tab'},body:JSON.stringify({action:'reorder',cardIds:state.cards.ids.slice().reverse()})});
    await title.fill('Unsaved after rollback');await cards.getByRole('button',{name:'Save card',exact:true}).first().click();await cards.getByLabel('Retained homepage drafts',{exact:true}).waitFor();await page.waitForTimeout(150);assert.equal(mutations,2);assert.match(await cards.getByLabel('Retained homepage drafts',{exact:true}).inputValue(),/Unsaved after rollback/);
    await cards.getByLabel('I have retained all drafts shown above.').check();await cards.getByRole('button',{name:'Reload to reconcile'}).click();await title.waitFor();assert.notEqual(await title.inputValue(),'Unsaved after rollback');assert.equal(mutations,2);
    console.log('PASS actual authenticated local application Chromium '+width+'px: '+loaded+'-loaded browser saves after routing switch; rollback stale conflict retains copy and reload reads DB');await context.close();
   }
  }
  console.log('PASS Packet 9 generated Prisma/PostgreSQL and two real Next application processes through local routing; zero data restoration');
 }
}catch(error){for(const [p,log] of logs)console.error('isolated application '+p.pid+' diagnostics: '+log.slice(-8000));throw error;}
finally{await browser?.close();if(proxy)await new Promise(r=>proxy.close(r));for(const p of children)p.kill('SIGTERM');await Promise.all(children.map(p=>p.exitCode!==null?Promise.resolve():new Promise(r=>{p.once('exit',r);setTimeout(()=>{p.kill('SIGKILL');r();},5000).unref();})));await driver?.prisma.$disconnect();await rm(bundle,{force:true});await rm(scratch,{recursive:true,force:true});}
