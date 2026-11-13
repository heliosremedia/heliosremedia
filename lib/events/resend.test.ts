/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as core from "./resend-core.ts";
import { readEventUpdateBody } from "./updates-core.ts";
const requestId="12345678-1234-4234-9234-123456789abc",otherId="12345678-1234-4234-9234-123456789abd";
function load(file:string,mocks:Record<string,unknown>) {
 const source=readFileSync(new URL(file,import.meta.url),"utf8"),exports:any={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>{assert(name in mocks,`Unexpected dependency ${name}`);return mocks[name];},Date,Error,JSON});return exports;
}
function fixture() {
 const event:any={id:"event",workspaceId:"workspace",title:"Holiday",status:"SCHEDULED",startsAt:new Date(Date.now()+86400000)};
 const invitations:any[]=[{id:"invite0",eventId:"event",clientId:"client0",email:"guest@example.com",response:"YES",additionalGuests:3,encryptedToken:"original-token"}];
 const clients:any[]=[{id:"client0",normalizedEmail:"guest@example.com",eligible:true}];
 const deliveries:any[]=[{id:"initial",eventId:"event",stage:"INITIAL",status:"COMPLETED",scheduledAt:new Date(Date.now()-3600000),messages:[{invitationId:"invite0",status:"SENT",sentAt:new Date(Date.now()-3600000)}]}];
 let eligible=true;const clone=(v:any)=>structuredClone(v);
 const snapshot=()=>clone({...event,deliveries});
 const getEvent=async(id:string,workspaceId:string)=>{if(id!==event.id||workspaceId!==event.workspaceId)throw new Error("Event not found.");return snapshot();};
 const prisma:any={
  eventInvitationEvent:{updateMany:async({where}:any)=>({count:where.id===event.id&&where.workspaceId===event.workspaceId?1:0}),findFirst:async({where}:any)=>where.id===event.id&&where.workspaceId===event.workspaceId?snapshot():null},
  eventInvitation:{findFirst:async({where}:any)=>clone(invitations.find(i=>i.id===where.id&&i.eventId===where.eventId&&event.workspaceId===where.event.workspaceId)||null)},
  communicationClient:{findFirst:async({where}:any)=>{assert.equal(where.workspaceMemberships.some.workspaceId,"workspace");assert.equal(where.emailSubscribed,true);assert.equal(where.emailStatus,"VALID");assert.equal(where.archivedAt,null);assert.deepEqual(where.groupMemberships.none.group.systemKey,"bounce-workspace");return clone(clients.find(c=>c.id===where.id&&c.eligible)||null);}},
  eventDelivery:{create:async({data}:any)=>{const row={id:`resend${deliveries.length}`,status:"SCHEDULED",messages:[],...data};deliveries.push(row);return clone(row);}},
 };
 let previous=Promise.resolve();prisma.$transaction=async(work:any)=>{const waiting=previous;let done!:()=>void;previous=new Promise<void>(r=>{done=r;});await waiting;const before=clone(deliveries);try{return await work(prisma);}catch(e){deliveries.splice(0,deliveries.length,...before);throw e;}finally{done();}};
 const service=load("./resend-service.ts",{"server-only":{},"@/lib/prisma":{prisma},"@/lib/client-communications/bounce-core":{bouncedBackSystemKey:(w:string)=>`bounce-${w}`},"@/lib/client-communications/preferences":{addressIsMarketingEligible:async()=>eligible},"./service":{getEvent},"./resend-core":core});
 const input={invitationId:"invite0",recipientEmail:"guest@example.com",requestId};
 return {event,invitations,clients,deliveries,input,queue:(data=input,workspace="workspace")=>service.queueInvitationResend("event",workspace,data),setEligible:(value:boolean)=>{eligible=value;}};
}
test("resend stage accepts exactly one invitation and UUID, never group selectors",()=>{
 const stage=core.resendStage("invite0",requestId);assert.equal(core.resendInvitationId(stage),"invite0");
 for(const id of [null,[],"", "*", "a_b", "a".repeat(101)])assert.throws(()=>core.resendStage(id,requestId));
 for(const key of [null,"bad","12345678-1234-1234-9234-123456789abc"])assert.throws(()=>core.resendStage("invite0",key));
 for(const stage of ["INITIAL","RESEND_malformed","RESEND_*_"+requestId])assert.equal(core.resendInvitationId(stage),null);
});
test("queue creates a single-target delivery and preserves original invitations, RSVP and schedule",async()=>{
 const f=fixture();const original=structuredClone({invites:f.invitations,deliveries:f.deliveries});const result=await f.queue();
 assert.equal(result.replayed,false);assert.equal(f.deliveries.length,2);assert.equal(core.resendInvitationId(f.deliveries[1].stage),"invite0");
 assert.deepEqual(f.invitations,original.invites);assert.deepEqual(f.deliveries[0],original.deliveries[0]);
});
test("same request replays safely; different concurrent clicks and refresh retries do not duplicate",async()=>{
 const f=fixture();const same=await Promise.all([f.queue(),f.queue()]);assert.equal(f.deliveries.length,2);assert.deepEqual(same.map(x=>x.replayed),[false,true]);
 await assert.rejects(()=>f.queue({...f.input,requestId:otherId}),/queued|review/);assert.equal(f.deliveries.length,2);
 f.deliveries[1].status="COMPLETED";f.deliveries[1].messages=[{invitationId:"invite0",status:"SENT",sentAt:new Date()}];
 await assert.rejects(()=>f.queue({...f.input,requestId:otherId}),/10 minutes/);
 f.deliveries[1].scheduledAt=new Date(Date.now()-core.RESEND_COOLDOWN_MS-1000);f.deliveries[1].messages[0].sentAt=new Date(Date.now()-core.RESEND_COOLDOWN_MS-1000);
 await f.queue({...f.input,requestId:otherId});assert.equal(f.deliveries.length,3);
 const g=fixture();const concurrent=await Promise.allSettled([g.queue(),g.queue({...g.input,requestId:otherId})]);assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);assert.equal(g.deliveries.length,2);
});
test("a replay never reactivates cancelled or uncertain work",async()=>{
 const f=fixture();await f.queue();f.deliveries[1].status="CANCELLED";await f.queue();assert.equal(f.deliveries[1].status,"CANCELLED");
 f.deliveries[1].status="FAILED";f.deliveries[1].scheduledAt=new Date(0);f.deliveries[1].messages=[{status:"UNCERTAIN",invitationId:"invite0"}];
 await assert.rejects(()=>f.queue({...f.input,requestId:otherId}),/review/);assert.equal(f.deliveries.length,2);
});
test("cross-workspace, wrong guest/address, closed events, initial uncertainty and suppression fail closed",async()=>{
 const changes=[
  (f:any)=>{f.event.status="CANCELLED";},(f:any)=>{f.event.status="DRAFT";},(f:any)=>{f.event.startsAt=new Date(0);},
  (f:any)=>{f.deliveries[0].messages[0].status="SENDING";},(f:any)=>{f.deliveries[0].messages[0].status="UNCERTAIN";},
  (f:any)=>{f.clients[0].eligible=false;},(f:any)=>{f.clients[0].normalizedEmail="changed@example.com";},(f:any)=>f.setEligible(false),
 ];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(()=>f.queue());assert.equal(f.deliveries.length,1);}
 const f=fixture();await assert.rejects(()=>f.queue(f.input,"other"),/Event not found/);
 await assert.rejects(()=>f.queue({...f.input,invitationId:"foreign"}),/guest not found/);
 await assert.rejects(()=>f.queue({...f.input,recipientEmail:"other@example.com"}),/Recipient changed/);assert.equal(f.deliveries.length,1);
});
test("resend endpoint authenticates, requires exact confirmation, and does not call email provider",async()=>{
 let role="OWNER",queued=0,audits=0;
 const route=load("../../app/api/admin/events/[eventId]/resend/route.ts",{"next/server":{NextResponse:{json:(data:any,options:any)=>Response.json(data,options)}},"@/lib/events/service":{eventAdmin:async()=>{if(role!=="OWNER")throw new Error("Administrator access required.");return {workspaceId:"workspace"};},auditEvent:async()=>{audits++;}},"@/lib/events/updates-core":{readEventUpdateBody},"@/lib/events/resend-core":core,"@/lib/events/resend-service":{queueInvitationResend:async(id:string,workspace:string,input:any)=>{assert.equal(id,"event");assert.equal(workspace,"workspace");assert.equal(input.invitationId,"invite0");queued++;return {event:{id},replayed:false};}}});
 const post=(input:any)=>route.POST(new Request("https://studio.test/api/admin/events/event/resend",{method:"POST",body:JSON.stringify(input)}),{params:Promise.resolve({eventId:"event"})});
 assert.equal((await post({invitationId:"invite0"})).status,400);assert.equal(queued,0);
 role="VIEWER";assert.equal((await post({confirm:true,invitationId:"invite0"})).status,403);assert.equal(queued,0);
 role="OWNER";const response=await post({confirm:true,invitationId:"invite0"});assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");assert.equal(queued,1);assert.equal(audits,1);assert.match((await response.json()).message,/queued.*only/);
});
