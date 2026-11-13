/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as cryptoCore from "./core.ts";
import * as guests from "./guest-counts.ts";
import { readEventUpdateBody } from "./updates-core.ts";
const secret="shared-event-test-secret".repeat(3);
function load(file:string,mocks:Record<string,unknown>) {
 const exports:any={};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(key:string)=>{assert(key in mocks,`Unexpected dependency ${key}`);return mocks[key];},process:{env:{AUTH_SECRET:secret}},Date,Error,JSON});return exports;
}
const shareCore=load("./share-core.ts",{"./guest-counts":guests});
function fixture() {
 const event:any={id:"event",workspaceId:"workspace",status:"SCHEDULED",startsAt:new Date(Date.now()+86400000),endsAt:null,timeZone:"America/Denver",title:"Mixer",description:"Join us",location:"Studio",templateKey:"CLASSIC",clientIds:["private"],emailContent:{private:"copy"}};
 const links:any[]=[],invitations:any[]=[];let beforeLock:(()=>void)|undefined;
 const clone=(v:any)=>structuredClone(v);
 const prisma:any={
  eventInvitationEvent:{updateMany:async({where}:any)=>{beforeLock?.();beforeLock=undefined;return {count:where.id===event.id&&(!where.workspaceId||where.workspaceId===event.workspaceId)&&event.status==="SCHEDULED"&&event.startsAt>new Date()?1:0};}},
  eventShareLink:{findUnique:async({where,include}:any)=>{const link=links.find(l=>where.eventId?l.eventId===where.eventId:l.tokenHash===where.tokenHash);return link?clone({...link,...(include?{event}:{})}):null;},create:async({data}:any)=>{const link={id:"share",...data};links.push(link);return clone(link);}},
  eventInvitation:{findFirst:async({where}:any)=>clone(invitations.find(i=>i.eventId===where.eventId&&where.OR.some((part:any)=>part.email?part.email===i.email:part.tokenHash===i.tokenHash))||null),count:async({where}:any)=>invitations.filter(i=>i.eventId===where.eventId&&i.source===where.source&&(!where.createdAt||i.createdAt>where.createdAt.gt)).length,create:async({data}:any)=>{const row={id:`guest${invitations.length}`,createdAt:new Date(),...data};invitations.push(row);return {response:row.response,additionalGuests:row.additionalGuests};}},
 };
 let previous=Promise.resolve();prisma.$transaction=async(work:any)=>{const waiting=previous;let done!:()=>void;previous=new Promise<void>(r=>done=r);await waiting;const before=clone({links,invitations});try{return await work(prisma);}catch(e){links.splice(0,links.length,...before.links);invitations.splice(0,invitations.length,...before.invitations);throw e;}finally{done();}};
 const service=load("./share-service.ts",{"server-only":{},"@/lib/prisma":{prisma},"./core":cryptoCore,"./share-core":shareCore,"@/lib/site":{getSiteUrl:()=>"https://studio.test"},"./themes":{normalizeEventTemplateKey:(k:string)=>k,safeEventImageUrl:()=>null,safeEventVenueUrl:()=>null}});
 return {event,links,invitations,service,setBeforeLock:(fn:()=>void)=>{beforeLock=fn;},link:()=>service.getOrCreateEventShareLink("event","workspace")};
}
const tokenFrom=(url:string)=>new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
const input=(token:string)=>({token,registrationToken:cryptoCore.newToken(),name:"New Guest",email:"guest@example.com",response:"YES",additionalGuests:2});
test("admin creates one private event capability, scoped and stable without exposing personal RSVP tokens",async()=>{
 const f=fixture();const [a,b]=await Promise.all([f.link(),f.link()]);assert.equal(a,b);assert.equal(f.links.length,1);assert.equal(f.invitations.length,0);assert.equal(new URL(a).pathname,"/events/invite");assert.equal(new URL(a).search,"");assert(cryptoCore.validToken(tokenFrom(a)));
 await assert.rejects(()=>f.service.getOrCreateEventShareLink("event","other"));assert.equal(f.links.length,1);
 f.event.status="DRAFT";await assert.rejects(f.link);f.event.status="CANCELLED";await assert.rejects(f.link);
});
test("public event lookup is credential-bound, closed-event safe and a strict allowlist",async()=>{
 const f=fixture(),token=tokenFrom(await f.link());const publicEvent=await f.service.getSharedEvent(token);
 assert.deepEqual(Object.keys(publicEvent).sort(),["title","description","location","startsAt","endsAt","timeZone","templateKey","imageUrl","imageAlt","venueUrl"].sort());
 for(const bad of [null,"",cryptoCore.newToken()])await assert.rejects(()=>f.service.getSharedEvent(bad));
 f.event.status="CANCELLED";await assert.rejects(()=>f.service.getSharedEvent(token));f.event.status="SCHEDULED";f.event.startsAt=new Date(0);await assert.rejects(()=>f.service.getSharedEvent(token));
});
test("new guest RSVP preserves existing guests, counts and stored personal token without marketing enrollment",async()=>{
 const f=fixture(),token=tokenFrom(await f.link()),data=input(token);data.email=" New@Example.COM ";const result=await f.service.registerSharedGuest(data);
 assert.equal(f.invitations.length,1);const guest=f.invitations[0];assert.equal(guest.email,"new@example.com");assert.equal(guest.displayName,"New Guest");assert.equal(guest.source,"SHARED_LINK");assert.equal(guest.response,"YES");assert.equal(guest.additionalGuests,2);assert.equal(cryptoCore.decrypt(guest.encryptedToken,secret),data.registrationToken);assert.notEqual(tokenFrom(result.rsvpUrl),token);assert.equal(tokenFrom(result.rsvpUrl),data.registrationToken);
 const original=structuredClone(guest);const replay=await f.service.registerSharedGuest({...data,response:"NO",additionalGuests:0});assert.equal(replay.response,"YES");assert.deepEqual(f.invitations[0],original);
});
test("existing email and concurrent registration never overwrite or reveal another guest's token or RSVP",async()=>{
 const f=fixture(),token=tokenFrom(await f.link()),data=input(token);await f.service.registerSharedGuest(data);const before=structuredClone(f.invitations);
 await assert.rejects(()=>f.service.registerSharedGuest({...data,registrationToken:cryptoCore.newToken()}),(e:any)=>e.status===409&&!e.message.includes(data.registrationToken));assert.deepEqual(f.invitations,before);
 f.invitations[0].source="EMAIL";await assert.rejects(()=>f.service.registerSharedGuest(data),(e:any)=>e.status===409);
 const g=fixture(),t=tokenFrom(await g.link()),first=input(t),second={...first,registrationToken:cryptoCore.newToken()};const results=await Promise.allSettled([g.service.registerSharedGuest(first),g.service.registerSharedGuest(second)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(g.invitations.length,1);
 const h=fixture(),ht=tokenFrom(await h.link()),request=input(ht);await Promise.all([h.service.registerSharedGuest(request),h.service.registerSharedGuest(request)]);assert.equal(h.invitations.length,1);
});
test("invalid input, cancellation races, shared credential reuse and registration limits fail closed",async()=>{
 const f=fixture(),token=tokenFrom(await f.link()),data=input(token);
 for(const changes of [{name:""},{name:"x\nY"},{email:"bad"},{response:"PENDING"},{additionalGuests:100},{additionalGuests:1.5},{registrationToken:token},{registrationToken:"bad"}])await assert.rejects(()=>f.service.registerSharedGuest({...data,...changes}));assert.equal(f.invitations.length,0);
 f.setBeforeLock(()=>{f.event.status="CANCELLED";});await assert.rejects(()=>f.service.registerSharedGuest(data));assert.equal(f.invitations.length,0);
 const g=fixture(),t=tokenFrom(await g.link());for(let i=0;i<30;i++)g.invitations.push({eventId:"event",source:"SHARED_LINK",email:`${i}@example.com`,createdAt:new Date()});await assert.rejects(()=>g.service.registerSharedGuest(input(t)),(e:any)=>e.status===429);
 assert.equal(shareCore.shareRegistrationInput({...data,response:"NO",additionalGuests:4}).additionalGuests,0);
});
test("share routes are admin-scoped, no-store and diagnostic-safe; public body is bounded",async()=>{
 let role="OWNER",calls=0;const next={NextResponse:{json:(data:any,options:any)=>Response.json(data,options)}};
 const admin=load("../../app/api/admin/events/[eventId]/share-link/route.ts",{"next/server":next,"@/lib/events/service":{eventAdmin:async()=>{if(role!=="OWNER")throw new Error("Administrator access required.");return {workspaceId:"workspace"};}},"@/lib/events/share-core":shareCore,"@/lib/events/share-service":{getOrCreateEventShareLink:async(id:string,workspace:string)=>{assert.equal(id,"event");assert.equal(workspace,"workspace");calls++;return "https://studio.test/events/invite#token=test";}}});
 const ctx={params:Promise.resolve({eventId:"event"})};role="VIEWER";assert.equal((await admin.POST(new Request("https://studio.test"),ctx)).status,403);assert.equal(calls,0);role="OWNER";const response=await admin.POST(new Request("https://studio.test"),ctx);assert.match(response.headers.get("cache-control")!,/no-store/);assert.equal(calls,1);
 const api=load("../../app/api/events/invite/route.ts",{"next/server":next,"@/lib/events/share-core":shareCore,"@/lib/events/share-service":{getSharedEvent:async(token:string)=>{assert.equal(token,"safe");return {title:"Mixer"};},registerSharedGuest:async()=>{throw new Error("DATABASE password private-token");}},"@/lib/events/updates-core":{readEventUpdateBody}});
 const get=await api.GET(new Request("https://studio.test",{headers:{Authorization:"Bearer safe"}}));assert.equal((await get.json()).event.title,"Mixer");
 const bad=await api.POST(new Request("https://studio.test",{method:"POST",body:JSON.stringify({})}));assert.doesNotMatch(JSON.stringify(await bad.json()),/password|private-token/);
 const huge=await api.POST(new Request("https://studio.test",{method:"POST",body:"x".repeat(65537)}));assert.equal(huge.status,400);
});

test("shared invitation credentials stay out of analytics and admin event snapshots",()=>{
 const analytics=readFileSync(new URL("../../app/components/SiteAnalytics.tsx",import.meta.url),"utf8");assert.match(analytics,/pathname === "\/events\/invite"/);
 const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");const shape=service.split("export const eventInclude =")[1].split("as const")[0];assert(!shape.includes("shareLink"));assert(!shape.includes("encryptedToken"));assert(!shape.includes("tokenHash"));
 const admin=readFileSync(new URL("../../app/admin/events/EventStudio.tsx",import.meta.url),"utf8");assert(admin.includes('<CopyEventLink key={selected.id}'));assert(admin.indexOf('<CopyEventLink')>admin.indexOf('{selected.title}</h2>'));
});
