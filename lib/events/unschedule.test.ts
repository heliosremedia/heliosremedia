/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as core from "./core.ts";

function load(file:string,mocks:Record<string,unknown>) {
  const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,any>={};
  vm.runInNewContext(js,{exports,require:(name:string)=>{if(!(name in mocks))throw new Error(`Unexpected import ${name}`);return mocks[name];},Date,JSON,Error,URL,Buffer,Set,process:{env:{AUTH_SECRET:"a".repeat(64)}}});
  return exports;
}
const next={NextResponse:{json:(data:any)=>({data})}};
const request=(input:any)=>new Request("https://studio.example.test/api/admin/events/event",{method:"PATCH",body:JSON.stringify(input)});
const ctx={params:Promise.resolve({eventId:"event"})};
function fixture() {
  const now=Date.now();
  const event:any={id:"event",workspaceId:"workspace",status:"SCHEDULED",updatedAt:new Date(0),title:"Gathering",description:"Original",location:"Studio",startsAt:new Date(now+40*86400000),endsAt:null,timeZone:"America/Denver",mode:"INDIVIDUALS",clientIds:["client"],groupIds:[],imageUrl:null,templateKey:"CLASSIC",emailContent:{}};
  const deliveries:any[]=core.defaultSchedule(new Date(now+3600000),event.startsAt).map((entry,index)=>({id:`delivery-${index}`,eventId:event.id,status:"SCHEDULED",...entry}));
  const invitations:any[]=[{id:"invitation",eventId:event.id,clientId:"client",email:"original@example.test",tokenHash:"original-hash",encryptedToken:"original-token"}];
  const messages:any[]=[];
  const match=(row:any,where:any):boolean=>Object.entries(where).every(([key,value]:[string,any])=>key==="delivery" ? deliveries.some(delivery=>delivery.id===row.deliveryId && match(delivery,value)) : value instanceof Date ? +row[key]===+value : value && typeof value==="object" ? (value.in ? value.in.includes(row[key]) : value.gt ? row[key]>value.gt : false) : row[key]===value);
  const snapshot=()=>structuredClone({...event,deliveries:deliveries.map(delivery=>({...delivery,messages:messages.filter(message=>message.deliveryId===delivery.id)})),invitations});
  let candidatesRead=0,createdInvitations=0,lockHook:(()=>void)|undefined;
  const prisma:any={
    eventInvitationEvent:{findFirst:async({where}:any)=>match(event,where)?snapshot():null,updateMany:async({where,data}:any)=>{lockHook?.();lockHook=undefined;if(!match(event,where))return{count:0};Object.assign(event,data);return{count:1};}},
    eventDelivery:{findUnique:async({where}:any)=>structuredClone(deliveries.find(delivery=>where.id?delivery.id===where.id:match(delivery,where.eventId_stage))||null),updateMany:async({where,data}:any)=>{const rows=deliveries.filter(delivery=>match(delivery,where));rows.forEach(row=>Object.assign(row,data));return{count:rows.length};},update:async({where,data}:any)=>Object.assign(deliveries.find(delivery=>match(delivery,where)),data),create:async({data}:any)=>{deliveries.push({id:`delivery-${deliveries.length}`,status:"SCHEDULED",...data});}},
    eventDeliveryMessage:{count:async({where}:any)=>messages.filter(message=>match(message,where)).length,updateMany:async()=>({count:0})},
    eventInvitation:{createMany:async({data}:any)=>{createdInvitations+=data.length;invitations.push(...data);}},
    communicationClient:{findMany:async()=>{candidatesRead++;return[{id:"client",normalizedEmail:"new@example.test",displayName:"New"}];}},
  };
  let queue=Promise.resolve();
  prisma.$transaction=async(work:any)=>{const waiting=queue;let release!:()=>void;queue=new Promise<void>(resolve=>{release=resolve;});await waiting;const saved=structuredClone({event,deliveries,invitations,messages});try{return await work(prisma);}catch(error){Object.assign(event,saved.event);deliveries.splice(0,deliveries.length,...saved.deliveries);invitations.splice(0,invitations.length,...saved.invitations);messages.splice(0,messages.length,...saved.messages);throw error;}finally{release();}};
  const service=load("./service.ts",{"server-only":{},"@/lib/client-communications/bounce-core":{bouncedBackSystemKey:()=>"bounce"},"@/lib/prisma":{prisma},"@/lib/auth/session":{getAdminSession:async()=>({role:"OWNER",workspaceId:"workspace"})},"@/lib/client-communications/preferences":{addressIsMarketingEligible:async()=>true},"@/lib/audit":{recordAuditEvent:async()=>{}},"./themes":{safeEventImageUrl:()=>null},"./core":core});
  const route=load("../../app/api/admin/events/[eventId]/route.ts",{"next/server":next,"@/lib/prisma":{prisma},"@/lib/events/service":service,"@/lib/events/core":core,"@/lib/events/api":{eventError:(error:Error)=>({error:error.message})}});
  const emailRoute=load("../../app/api/admin/events/[eventId]/email/route.ts",{"next/server":next,"@/lib/events/service":service,"@/lib/events/core":core,"@/lib/events/api":{eventError:(error:Error)=>({error:error.message})},"@/lib/events/email":{},"@/lib/client-communications/email":{}});
  return {event,deliveries,invitations,messages,service,route,emailRoute,setLockHook:(hook:()=>void)=>{lockHook=hook;},stats:()=>({candidatesRead,createdInvitations})};
}
test("confirmed pause/edit/resume preserves IDs, recipients, tokens and all saved times",async()=>{
  const f=fixture();const original=structuredClone({deliveries:f.deliveries,invitations:f.invitations});
  const pause=await f.route.PATCH(request({action:"unschedule",confirm:true}),ctx);assert.equal(pause.data.event.status,"DRAFT");assert(f.deliveries.every(delivery=>delivery.status==="PAUSED"));
  const edit=await f.route.PATCH(request({description:"Revised wording",startsAt:new Date(+f.event.startsAt+86400000).toISOString()}),ctx);assert.equal(edit.data.event.description,"Revised wording");
  await f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt);
  assert.equal(f.event.status,"SCHEDULED");assert.deepEqual(f.deliveries,original.deliveries);assert.deepEqual(f.invitations,original.invitations);assert.deepEqual(f.stats(),{candidatesRead:0,createdInvitations:0});
});
test("pause requires confirmation and rejects already paused, cancelled and wrong-workspace events",async()=>{
  const f=fixture();assert.match((await f.route.PATCH(request({action:"unschedule"}),ctx)).error,/Confirm/);assert.equal(f.event.status,"SCHEDULED");
  await assert.rejects(f.service.unscheduleEvent("event","other"));await f.service.unscheduleEvent("event","workspace");await assert.rejects(f.service.unscheduleEvent("event","workspace"));
  await f.service.cancelEvent("event","workspace");assert.equal(f.event.status,"CANCELLED");assert(f.deliveries.every(delivery=>delivery.status==="CANCELLED"));await assert.rejects(f.service.unscheduleEvent("event","workspace"));await assert.rejects(f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt));
});
test("any message activity in any stage blocks pause atomically, including pending and failed",async()=>{
  for(const status of ["PENDING","SENDING","SENT","SKIPPED","FAILED","UNCERTAIN"]){const f=fixture();f.messages.push({id:"message",deliveryId:f.deliveries[2].id,status});await assert.rejects(f.service.unscheduleEvent("event","workspace"),/already started/);assert.equal(f.event.status,"SCHEDULED");assert(f.deliveries.every(delivery=>delivery.status==="SCHEDULED"));}
});
test("pause rechecks message activity after acquiring the processor lock",async()=>{
  const f=fixture();f.setLockHook(()=>f.messages.push({id:"racing-message",deliveryId:f.deliveries[0].id,status:"PENDING"}));await assert.rejects(f.service.unscheduleEvent("event","workspace"),/already started/);assert.equal(f.event.status,"SCHEDULED");
});
test("paused drafts reject audience changes but allow equivalent selection order",async()=>{
  const f=fixture();await f.service.unscheduleEvent("event","workspace");
  for(const patch of [{mode:"ALL"},{clientIds:["another"]},{groupIds:["group"]}])assert.match((await f.route.PATCH(request(patch),ctx)).error,/audience/);
  assert.equal((await f.route.PATCH(request({clientIds:["client"],description:"Updated"}),ctx)).data.event.description,"Updated");assert.equal(f.invitations[0].email,"original@example.test");
});
test("explicit schedule updates each saved stage through email route without replacing audience",async()=>{
  const f=fixture();await f.service.unscheduleEvent("event","workspace");const deliveryTimes=Object.fromEntries(f.deliveries.map((delivery,index)=>[delivery.stage,new Date(Date.now()+(index+1)*86400000).toISOString()]));
  const result=await f.emailRoute.POST(request({action:"schedule",stage:"INITIAL",scheduledAt:deliveryTimes.INITIAL,deliveryTimes,confirm:true}),ctx);assert.equal(result.data.event.status,"SCHEDULED");for(const delivery of f.deliveries)assert.equal(delivery.scheduledAt.toISOString(),deliveryTimes[delivery.stage]);assert.equal(f.stats().createdInvitations,0);
});
test("invalid/missing/extra, stale, after-start, or out-of-order stage times fail without mutations",async()=>{
  const f=fixture();await f.service.unscheduleEvent("event","workspace");const base=Object.fromEntries(f.deliveries.map(delivery=>[delivery.stage,delivery.scheduledAt.toISOString()]));
  for(const times of [null,[],{}, {...base,EXTRA:base.INITIAL},{...base,REMINDER:undefined},{...base,FOLLOW_UP:"bad"},{...base,FOLLOW_UP:new Date(0).toISOString()},{...base,FOLLOW_UP:base.INITIAL},{...base,REMINDER:f.event.startsAt.toISOString()},{...base,INITIAL:new Date(+f.deliveries[0].scheduledAt+1000).toISOString()},{...base,FOLLOW_UP:"2031-02-30T10:00:00Z"}]) {await assert.rejects(f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt,times));assert.equal(f.event.status,"DRAFT");assert(f.deliveries.every(delivery=>delivery.status==="PAUSED"));}
  f.deliveries[1].scheduledAt=new Date(0);await assert.rejects(f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt),/Every delivery/);
});
test("fresh activity and stale revision block resume and draft edits",async()=>{
  const f=fixture();await f.service.unscheduleEvent("event","workspace");f.messages.push({id:"message",deliveryId:f.deliveries[0].id,status:"PENDING"});await assert.rejects(f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt),/already started/);assert.equal(f.event.status,"DRAFT");
  assert.match((await f.route.PATCH(request({description:"Unsafe"}),ctx)).error,/already started/);assert.equal(f.event.description,"Original");
  f.messages.length=0;f.setLockHook(()=>{f.event.updatedAt=new Date(+f.event.updatedAt+1);});await assert.rejects(f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt),/changed/);
});
test("new drafts still snapshot eligible recipients and get the default schedule",async()=>{
  const f=fixture();f.event.status="DRAFT";f.deliveries.length=0;f.invitations.length=0;const initial=new Date(Date.now()+3600000);await f.service.scheduleEvent("event","workspace","INITIAL",initial);assert.equal(f.deliveries.length,3);assert.equal(f.invitations[0].email,"new@example.test");assert.deepEqual(f.stats(),{candidatesRead:1,createdInvitations:1});
});
test("pause rejects missing/cancelled initial and unsupported scheduled update stages",async()=>{
 for(const initial of ["CANCELLED","COMPLETED","PAUSED"]){const f=fixture();f.deliveries[0].status=initial;await assert.rejects(f.service.unscheduleEvent("event","workspace"),/untouched initial/);assert.equal(f.event.status,"SCHEDULED");assert.equal(f.deliveries[1].status,"SCHEDULED");}
 const f=fixture();f.deliveries.push({id:"update",eventId:"event",stage:"UPDATE_unknown",status:"SCHEDULED",scheduledAt:f.deliveries[0].scheduledAt});await assert.rejects(f.service.unscheduleEvent("event","workspace"),/untouched initial/);assert.equal(f.event.status,"SCHEDULED");
});
test("concurrent duplicate rescheduling succeeds once and never duplicates invitations",async()=>{
 const f=fixture();await f.service.unscheduleEvent("event","workspace");const results=await Promise.allSettled([f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt),f.service.scheduleEvent("event","workspace","INITIAL",f.deliveries[0].scheduledAt)]);assert.equal(results.filter(result=>result.status==="fulfilled").length,1);assert.equal(f.invitations.length,1);assert.equal(f.deliveries.length,3);assert.equal(f.stats().createdInvitations,0);
});
