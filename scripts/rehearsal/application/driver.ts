import assert from 'node:assert/strict';
import {PrismaClient} from '../../../app/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {createSessionToken,SESSION_COOKIE} from '../../../lib/auth/token';
import {DATABASE,requireIsolatedDatabase} from './safety.mjs';
export const prisma=new PrismaClient({adapter:new PrismaPg({connectionString:requireIsolatedDatabase(process.env.PACKET9_DATABASE_URL)})});
export async function seed(){
 const tables=await prisma.$queryRawUnsafe<{n:number}[]>('SELECT count(*)::int n FROM "Workspace"');assert.equal(tables[0].n,0,'fixture must be empty');
 for(const id of ['a','b']){
  await prisma.workspace.create({data:{id,name:'Synthetic '+id,slug:'synthetic-'+id}});
  await prisma.adminUser.create({data:{id:'u'+id,email:id+'@example.test',displayName:'Synthetic '+id,role:'OWNER',workspaceId:id,disciplines:[],sessionVersion:1}});
  await prisma.workspaceMembership.create({data:{workspaceId:id,userId:'u'+id,role:'OWNER',status:'ACTIVE'}});
  await prisma.siteSettings.create({data:{id:'settings-'+id,workspaceId:id,businessName:'REHEARSAL COMPANY '+id}});
  await prisma.project.create({data:{id:'p'+id,workspaceId:id,title:'Project '+id,slug:'synthetic-project-'+id,status:'PUBLISHED'}});
  await prisma.homepageProject.create({data:{id:'hp'+id,projectId:'p'+id,titleOverride:'Initial '+id}});
  for(let i=1;i<=2;i++){
   await prisma.service.create({data:{id:'s'+id+i,workspaceId:id,name:'Service '+id+i,slug:'service-'+id+i}});
   await prisma.homepageWorkCard.create({data:{id:'c'+id+i,serviceId:'s'+id+i,displayOrder:i-1,titleOverride:'Card '+id+i}});
  }
 }
 await prisma.workspaceDomain.create({data:{workspaceId:'a',hostname:'127.0.0.1',purpose:'PUBLIC_SITE',status:'ACTIVE'}});
 console.log('PASS generated Prisma seeded two isolated companies, settings, memberships, projects and cards');
}
export function cookie(id='a'){return SESSION_COOKIE+'='+createSessionToken({userId:'u'+id,email:id+'@example.test',displayName:'Synthetic '+id,role:'OWNER',sessionVersion:1});}
export async function exercise(origin:string,switchTo:(name:string)=>void|Promise<void>){
 const request=async(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>{
  const r=await fetch(origin+path,{method,headers:{cookie:cookie(),...headers},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(120000)});return r;
 };
 const state=async()=>{const r=await request('/api/rehearsal-state');assert.equal(r.status,200);return r.json();};
 const write=async(scope:string,revision:string,body:unknown)=>request('/api/admin/homepage-'+scope,'PATCH',body,{'x-curation-revision':revision,'x-curation-request':crypto.randomUUID()});
 const layout=async(revision:string,preferences:unknown)=>request('/api/admin/homepage-layout','PATCH',preferences,{'x-layout-revision':revision,'x-layout-request':crypto.randomUUID(),'x-layout-workspace':'a'});
 assert.equal((await fetch(origin+'/api/rehearsal-state')).status,401);assert.equal((await fetch(origin+'/api/admin/homepage-projects',{method:'PATCH',body:'{}'})).status,401);
 const originalB=JSON.stringify(await prisma.homepageProject.findUnique({where:{id:'hpb'}}));
 for(const mode of ['prior','candidate','prior','candidate']){
  await switchTo(mode);
  const admin=await request('/admin/homepage');assert.equal(admin.status,200);assert.equal(admin.headers.get('x-rehearsal-target'),mode);assert.match(await admin.text(),/Homepage curation/);
  const publicPage=await request('/');assert.equal(publicPage.status,200);assert.equal(publicPage.headers.get('x-rehearsal-target'),mode);assert.match(await publicPage.text(),/REHEARSAL COMPANY a/);
  const before=await state();assert.equal(before.settings.businessName,'REHEARSAL COMPANY a');
  const attempts=await Promise.all(['one','two'].map(title=>write('projects',before.projects.revision,{placementId:'hpa',titleOverride:mode+' '+title})));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  const after=await state();assert.notEqual(after.projects.revision,before.projects.revision);
  assert.equal((await write('projects',before.projects.revision,{placementId:'hpa',active:false})).status,409);
  assert.equal((await request('/api/admin/homepage-projects','PATCH',{placementId:'hpa',active:false})).status,409);
  assert.equal((await write('projects',after.projects.revision,{placementId:'hpb',titleOverride:'Foreign'})).status,404);
  const order=after.cards.ids.slice().reverse();
  const reorders=await Promise.all([write('work-cards',after.cards.revision,{action:'reorder',cardIds:order}),write('work-cards',after.cards.revision,{action:'reorder',cardIds:after.cards.ids})]);assert.deepEqual(reorders.map(r=>r.status).sort(),[200,409]);
  const pref={order:after.preferences.order.slice().reverse(),collapsed:[]};
  const layouts=await Promise.all([layout(after.layoutRevision,pref),layout(after.layoutRevision,after.preferences)]);assert.deepEqual(layouts.map(r=>r.status).sort(),[200,409]);
  const committed=await state();assert.notEqual(committed.layoutRevision,after.layoutRevision);assert.ok(committed.storedPreferences.layoutGeneration);
  assert.equal((await request('/api/admin/homepage-layout','PATCH',pref)).status,409);
  assert.equal(JSON.stringify((await state()).storedPreferences),JSON.stringify(committed.storedPreferences));
  console.log('PASS real Next HTTP '+mode+': public/admin routing, reads, project/order/layout parallel 200+409, stale/headerless/foreign rejection');
 }
 // Real preparation and attachment routes; object existence is synthetic.
 const assetBaseline=await prisma.workspaceAsset.count();
 const before=await state();const prepared=await request('/api/admin/homepage-work-cards/presign','POST',{cardId:'ca1',kind:'image',fileType:'image/webp',fileSize:10},{'x-curation-revision':before.cards.revision,'x-curation-request':'prepare'});assert.equal(prepared.status,200);const upload=await prepared.json();
 const body={cardId:'ca1',serviceId:'sa1',mediaMode:'IMAGE',imageStorageKey:upload.media.key,imageUrl:upload.media.url};
 const attachments=await Promise.all([write('work-cards',before.cards.revision,body),write('work-cards',before.cards.revision,{...body,titleOverride:'Concurrent attachment'})]);assert.deepEqual(attachments.map(r=>r.status).sort(),[200,409]);const attached=attachments.find(r=>r.status===200)!;assert.equal((await attached.json()).media.image.assetId,upload.media.assetId);
 console.log('PASS independent attachment writers: one200, one409, one prepared asset');
 await switchTo('prior');const readback=await state();assert.equal(readback.cardRows.find((r:{id:string})=>r.id==='ca1').imageStorageKey,upload.media.key);
 assert.equal((await request('/api/admin/homepage-work-cards','PATCH',body)).status,409);
 await switchTo('candidate');assert.equal((await write('work-cards',readback.cards.revision,{...body,titleOverride:'After rollback'})).status,200);
 assert.equal(await prisma.workspaceAsset.count(),assetBaseline+1);
 assert.equal(JSON.stringify(await prisma.homepageProject.findUnique({where:{id:'hpb'}})),originalB);
 // Force a second-row database failure and prove that the first positional update rolls back.
 const ordering=await state();assert.equal((await write('work-cards',ordering.cards.revision,{action:'reorder',cardIds:['ca2','ca1']})).status,200);
 const atomic=await state();
 await prisma.$executeRawUnsafe(`CREATE FUNCTION packet9_reorder_fault() RETURNS trigger AS $$ BEGIN IF NEW.id='ca2' THEN RAISE EXCEPTION 'isolated second-row fault'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
 await prisma.$executeRawUnsafe(`CREATE TRIGGER packet9_reorder_fault BEFORE UPDATE ON "HomepageWorkCard" FOR EACH ROW EXECUTE FUNCTION packet9_reorder_fault()`);
 try{assert.equal((await write('work-cards',atomic.cards.revision,{action:'reorder',cardIds:['ca1','ca2']})).status,500);const unchanged=await state();assert.equal(unchanged.cards.revision,atomic.cards.revision);assert.deepEqual(unchanged.cards.ids,atomic.cards.ids);}
 finally{await prisma.$executeRawUnsafe('DROP TRIGGER packet9_reorder_fault ON "HomepageWorkCard"');await prisma.$executeRawUnsafe('DROP FUNCTION packet9_reorder_fault()');}
 console.log('PASS PostgreSQL second-row reorder fault rolled back first update and revision');
 // Hold a real parent row on an independent connection. The route waits, then sees the committed transfer.
 const prior=await state();let release!:()=>void,locked!:()=>void;const ready=new Promise<void>(r=>locked=r);const gate=new Promise<void>(r=>release=r);
 const transfer=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Project" WHERE id='pa' FOR UPDATE`;locked();await gate;await tx.project.update({where:{id:'pa'},data:{workspaceId:'b'}});},{timeout:15000});
 await ready;let settled=false;const pending=write('projects',prior.projects.revision,{placementId:'hpa',titleOverride:'Must not cross'}).then(r=>{settled=true;return r;});await new Promise(r=>setTimeout(r,300));assert.equal(settled,false);release();await transfer;assert.equal((await pending).status,409);
 console.log('PASS independent PostgreSQL parent lock blocked the route, committed transfer caused409; no stale cross-company write');
 await prisma.project.update({where:{id:'pa'},data:{workspaceId:'a'}});
 const health=await prisma.$queryRawUnsafe<{deadlocks:bigint}[]>('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()');assert.equal(Number(health[0].deadlocks),0);console.log('PASS PostgreSQL reports zero deadlocks for this bounded rehearsal');
 console.log('PASS candidate → compatible rollback → candidate: canonical registry attachment retained; no schema rollback or data restoration');
 return {request,state,write};
}
export {DATABASE};
