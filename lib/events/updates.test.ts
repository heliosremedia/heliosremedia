/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as updates from "./updates-core.ts";
import * as themes from "./themes.ts";
import * as personalization from "./personalization.ts";
import * as emailFormat from "../client-communications/email-format.ts";
import * as preferenceRules from "../client-communications/preference-rules.ts";

const requestId = "143ee54a-1fa2-4e22-b629-ef2861b5b0b4";
const secondId = "243ee54a-1fa2-4e22-b629-ef2861b5b0b4";
const copy = {subject:"A quick update, {{FIRST_NAME}}",body:"Partners are welcome. Please update your RSVP.",audience:"ALL_INVITED" as const};
function load(file: string, mocks: Record<string, unknown>) {
  const js = ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(js,{exports,require:(name:string)=>{if(!(name in mocks))throw new Error(`Unexpected import ${name}`);return mocks[name];},Date,JSON,Error,URL,Buffer,console,process:{env:{}},TextDecoder},{filename:file});
  return exports;
}
const next = {NextResponse:{json:(data:unknown,options?:any)=>({data,status:options?.status || 200,headers:options?.headers})}};
const api = load("./api.ts",{"next/server":next});
const site = {getSiteUrl:()=>"https://studio.example.com"};
const campaign = load("../client-communications/email.ts",{"server-only":{},"@/lib/site":site,"@/lib/newsletters/presentation":{},"./providers/resend":{},"./email-format":emailFormat});
const email = load("./email.ts",{"server-only":{},"@/lib/site":site,"@/lib/client-communications/email":campaign,"./themes":themes,"./personalization":personalization});
const updateEmail = load("./updates-email.ts",{"server-only":{},"./email":email,"./updates-core":updates});
const baseEvent = () => ({id:"event",workspaceId:"workspace",status:"SCHEDULED",updatedAt:new Date(0),startsAt:new Date(Date.now()+3*86400000),title:"Holiday gathering",description:"Original description",location:"The studio",timeZone:"America/Denver",emailContent:{INITIAL:{subject:"Original initial",body:"Original initial"},FOLLOW_UP:{subject:"Original follow-up",body:"Original follow-up"},REMINDER:{subject:"Original reminder",body:"Original reminder"}}});
const request = (data:unknown,headers?:Record<string,string>) => new Request("https://studio.example.com/api/admin/events/event/updates",{method:"POST",headers,body:JSON.stringify(data)});

test("update stages are strict, repeatable UUID keys; original stages cannot be spoofed",()=>{
  assert.equal(updates.eventUpdateStage(requestId),`UPDATE_${requestId}`);
  assert(updates.isEventUpdateStage(updates.eventUpdateStage(secondId)));
  for(const value of ["INITIAL","UPDATE_",`UPDATE_${requestId}junk`,"UPDATE_fake"]) assert(!updates.isEventUpdateStage(value));
  for(const value of [undefined,"INITIAL",requestId.replace("-4e22-","-0e22-")]) assert.throws(()=>updates.eventUpdateStage(value));
});
test("update copy is required, bounded, header-safe and audience must be explicitly selected",()=>{
  assert.deepEqual(updates.eventUpdateInput(copy),copy);
  for(const bad of [null,[],{...copy,subject:""},{...copy,body:" "},{...copy,subject:"a".repeat(201)},{...copy,body:"b".repeat(3001)},{...copy,subject:"Hi\nBcc:other@example.com"},{...copy,subject:"Hi\u2028Bcc"},{...copy,body:"nul\u0000"},{...copy,audience:""},{...copy,audience:"ALL_CLIENTS"},{...copy,body:{html:"evil"}}]) assert.throws(()=>updates.eventUpdateInput(bad));
  assert.throws(()=>updates.eventUpdateCopy({stage:"INITIAL",updateSubject:copy.subject,updateBody:copy.body,updateAudience:copy.audience}));
});
test("all-invited deliberately includes Yes/No while response audiences fail closed",()=>{
  for(const response of ["YES","NO","MAYBE","PENDING"]) assert(updates.eventUpdateTargets("ALL_INVITED",response));
  for(const response of ["YES","NO","MAYBE","PENDING"]) {
    assert.equal(updates.eventUpdateTargets("YES",response),response==="YES");
    assert.equal(updates.eventUpdateTargets("PENDING_OR_MAYBE",response),response==="PENDING" || response==="MAYBE");
  }
  assert(!updates.eventUpdateTargets(undefined,"YES"));assert(!updates.eventUpdateTargets("ALL_INVITED","unknown"));
});
test("body reader bounds streamed bytes and rejects malformed structures",async()=>{
  assert.deepEqual(await updates.readEventUpdateBody(request(copy)),copy);
  await assert.rejects(updates.readEventUpdateBody(request(copy,{"content-length":"65537"})),/too large/);
  await assert.rejects(updates.readEventUpdateBody(request({body:"x".repeat(65537)})),/too large/);
  for(const value of [null,[],"text"]) await assert.rejects(updates.readEventUpdateBody(request(value)),/valid event update/);
  await assert.rejects(updates.readEventUpdateBody(new Request("https://example.test",{method:"POST",body:"{"})),/valid event update/);
});
test("delivery dates reject normalization and timezone ambiguity",()=>{
  assert.equal(updates.eventUpdateDate("2031-06-01T10:00:00Z").toISOString(),"2031-06-01T10:00:00.000Z");
  for(const value of [null,"bad","2031-02-30T10:00:00Z","2031-06-01T10:00:00"])assert.throws(()=>updates.eventUpdateDate(value));
});
test("update renderer reuses every theme and original RSVP token without mutating three-stage copy",()=>{
  for(const templateKey of themes.EVENT_TEMPLATE_KEYS) {
    const event = {...baseEvent(),templateKey};const original = JSON.stringify(event.emailContent);
    const preview = updateEmail.renderEventUpdate(event,copy);
    assert.equal(preview.subject,"A quick update, Alex");assert(preview.html.includes("Partners are welcome"));assert(preview.html.includes("The studio"));
    assert.equal((preview.html.match(/aria-disabled="true"/g)||[]).length,3);assert(!preview.html.includes("/events/rsvp"));
    const live = updateEmail.renderEventUpdate(event,copy,"original-token","unsubscribe",{recipientFirstName:"<Sam>"});
    assert.equal(live.subject,"A quick update, <Sam>");assert(live.html.includes("token=original-token"));assert(live.html.includes("unsubscribe?token=unsubscribe"));
    assert.equal(JSON.stringify(event.emailContent),original);
  }
});

function fixture(responses = ["YES","NO","MAYBE","PENDING"]) {
  const event = baseEvent();
  const deliveries:any[] = ["INITIAL","FOLLOW_UP","REMINDER"].map((stage,index)=>({id:`original-${index}`,eventId:event.id,stage,status:index ? "SCHEDULED" : "COMPLETED",scheduledAt:new Date(Date.now()+(index-1)*3600000),updateSubject:null,updateBody:null,updateAudience:null}));
  const invitations:any[] = responses.map((response,index)=>({eventId:event.id,workspaceId:event.workspaceId,clientId:`client${index}`,email:`client${index}@example.com`,response,sent:true}));
  const clients = invitations.map(invitation=>({id:invitation.clientId,normalizedEmail:invitation.email,eligible:true,workspaceId:event.workspaceId,archivedAt:null as Date|null,emailSubscribed:true,emailStatus:"VALID",bounced:false}));
  const blocked = new Set<string>();const preferences=new Map<string,string>();const suppressions:{normalizedEmail:string;releasedAt:Date|null}[]=[];
  const messages:any[]=[];const reads:any[]=[];const readModels:string[]=[];let lockHook: (()=>void) | undefined;
  const recordRead=(model:string,args:any)=>{reads.push(args);readModels.push(model);};
  const clone = (value:any)=>structuredClone(value);
  const getEvent = async(id:string,workspaceId:string)=>{if(id!==event.id || workspaceId!==event.workspaceId) throw new Error("Event not found.");return clone({...event,deliveries});};
  const prisma:any = {
    eventInvitation:{findMany:async(args:any)=>{recordRead("eventInvitation",args);return clone(invitations.filter(invitation=>invitation.sent && invitation.eventId===args.where.eventId && invitation.workspaceId===args.where.event.workspaceId));}},
    communicationClient:{findMany:async(args:any)=>{recordRead("communicationClient",args);return clone(clients.filter(client=>client.eligible && args.where.id.in.includes(client.id) && client.workspaceId===args.where.workspaceMemberships.some.workspaceId && client.archivedAt===args.where.archivedAt && client.emailSubscribed===args.where.emailSubscribed && client.emailStatus===args.where.emailStatus && !client.bounced));}},
    marketingEmailPreference:{findMany:async(args:any)=>{recordRead("marketingEmailPreference",args);return [...preferences].filter(([address])=>args.where.normalizedEmail.in.includes(address)).map(([normalizedEmail,status])=>({normalizedEmail,status}));}},
    communicationSuppression:{findMany:async(args:any)=>{recordRead("communicationSuppression",args);return [...suppressions,...[...blocked].map(normalizedEmail=>({normalizedEmail,releasedAt:null}))].filter(suppression=>args.where.normalizedEmail.in.includes(suppression.normalizedEmail) && suppression.releasedAt===args.where.releasedAt).map(({normalizedEmail})=>({normalizedEmail}));}},
    eventInvitationEvent:{updateMany:async({where,data}:any)=>{
      lockHook?.();lockHook=undefined;
      if(where.id!==event.id || where.workspaceId!==event.workspaceId || (where.status && where.status!==event.status) || (where.updatedAt && +where.updatedAt!==+event.updatedAt) || (where.startsAt && !(event.startsAt>where.startsAt.gt))) return {count:0};
      Object.assign(event,data);return {count:1};
    }},
    eventDelivery:{findUnique:async({where}:any)=>clone(deliveries.find(delivery=>where.id ? delivery.id===where.id : delivery.eventId===where.eventId_stage.eventId && delivery.stage===where.eventId_stage.stage)||null),create:async({data}:any)=>{const item={id:`update${deliveries.length}`,status:"SCHEDULED",...data};deliveries.push(item);return clone(item);},updateMany:async({where,data}:any)=>{const found=deliveries.filter(delivery=>delivery.id===where.id && delivery.eventId===where.eventId && delivery.status===where.status);found.forEach(delivery=>Object.assign(delivery,data));return {count:found.length};}},
    eventDeliveryMessage:{updateMany:async({where,data}:any)=>{messages.filter(message=>message.deliveryId===where.deliveryId && message.status===where.status).forEach(message=>Object.assign(message,data));}},
  };
  let previous = Promise.resolve();
  prisma.$transaction = async(work:any)=>{const waiting=previous;let done!:()=>void;previous=new Promise<void>(resolve=>{done=resolve;});await waiting;try{return await work(prisma);}finally{done();}};
  const service = load("./updates-service.ts",{"server-only":{},"@/lib/prisma":{prisma},"@/lib/client-communications/bounce-core":{bouncedBackSystemKey:(id:string)=>`bounce-${id}`},"@/lib/client-communications/preference-rules":preferenceRules,"./service":{getEvent},"./updates-core":updates});
  const input = {...copy,requestId,scheduledAt:new Date(Date.now()+3600000).toISOString()};
  return {event,deliveries,invitations,clients,blocked,preferences,suppressions,messages,reads,readModels,prisma,service,input,setLockHook:(hook:()=>void)=>{lockHook=hook;}};
}
test("audience count is bounded to sent original invitations and rechecks response, address and marketing eligibility",async()=>{
  const f=fixture();assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED"),4);
  assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","YES"),1);
  assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","PENDING_OR_MAYBE"),2);
  f.invitations[0].sent=false;f.clients[1].eligible=false;f.clients[2].normalizedEmail="changed@example.com";f.blocked.add(f.invitations[3].email);
  assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED"),0);
  assert.equal(f.reads[0].where.event.workspaceId,"workspace");assert.equal(f.reads[0].where.messages.some.status,"SENT");assert.equal(f.reads[0].where.messages.some.delivery.stage,"INITIAL");
  assert.equal(f.reads[1].where.workspaceMemberships.some.workspaceId,"workspace");assert.equal(f.reads[1].where.emailSubscribed,true);assert.equal(f.reads[1].where.emailStatus,"VALID");assert.equal(f.reads[1].where.groupMemberships.none.group.systemKey,"bounce-workspace");
});
test("1,000-recipient audience counts use four bounded reads instead of per-recipient eligibility queries",async()=>{
  const f=fixture(Array.from({length:1000},()=>"PENDING"));
  for(let index=0;index<1000;index++){
    const email=f.invitations[index].email;
    if(index%4===0)f.preferences.set(email,"UNSUBSCRIBED");
    if(index%4===1)f.suppressions.push({normalizedEmail:email,releasedAt:null});
    if(index%4===2)f.suppressions.push({normalizedEmail:email,releasedAt:new Date(0)});
  }
  assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED"),500);
  assert.deepEqual(f.readModels,["eventInvitation","communicationClient","marketingEmailPreference","communicationSuppression"]);
  for(const query of f.reads.slice(2)){assert.equal(query.where.normalizedEmail.in.length,1000);assert.equal(new Set(query.where.normalizedEmail.in).size,1000);assert.equal(query.where.workspaceId,undefined);}
  assert.equal(f.reads[3].where.releasedAt,null);
  assert.deepEqual(Object.keys(f.reads[2].select).sort(),["normalizedEmail","status"]);assert.deepEqual(Object.keys(f.reads[3].select),["normalizedEmail"]);
});
test("bulk eligibility preserves every preference status, missing preferences and active versus released suppressions",async()=>{
  const states=[undefined,"SUBSCRIBED","UNSUBSCRIBED","SUPPRESSED","PENDING_CONFIRMATION","UNKNOWN"];
  for(const status of states)for(const suppression of ["none","active","released","released-and-active"]){
    const f=fixture(["YES"]),email=f.invitations[0].email;
    if(status)f.preferences.set(email,status);
    if(suppression.includes("released"))f.suppressions.push({normalizedEmail:email,releasedAt:new Date(0)});
    if(suppression.includes("active"))f.suppressions.push({normalizedEmail:email,releasedAt:null});
    const expected=preferenceRules.marketingStatusAllowsSend(status) && !suppression.includes("active");
    assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","YES"),expected?1:0,`${status || "missing"} / ${suppression}`);
  }
});
test("bulk eligibility retains workspace/client/sent-initial constraints and short-circuits empty audiences",async()=>{
  const changes=[(f:ReturnType<typeof fixture>)=>{f.invitations[0].sent=false;},(f:ReturnType<typeof fixture>)=>{f.invitations[0].workspaceId="other";},(f:ReturnType<typeof fixture>)=>{f.clients[0].workspaceId="other";},(f:ReturnType<typeof fixture>)=>{f.clients[0].archivedAt=new Date();},(f:ReturnType<typeof fixture>)=>{f.clients[0].emailSubscribed=false;},(f:ReturnType<typeof fixture>)=>{f.clients[0].emailStatus="BOUNCED";},(f:ReturnType<typeof fixture>)=>{f.clients[0].bounced=true;},(f:ReturnType<typeof fixture>)=>{f.clients[0].normalizedEmail="changed@example.com";},(f:ReturnType<typeof fixture>)=>{f.invitations[0].response="NO";}];
  for(const change of changes){const f=fixture(["YES"]);change(f);assert.equal(await f.service.eventUpdateAudienceCount("event","workspace","YES"),0);assert(f.readModels.length<=2);assert(!f.readModels.includes("marketingEmailPreference"));assert(!f.readModels.includes("communicationSuppression"));}
  const empty=fixture([]);assert.equal(await empty.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED"),0);assert.deepEqual(empty.readModels,["eventInvitation"]);
  const scoped=fixture(["YES","NO"]);scoped.clients[1].normalizedEmail="changed@example.com";scoped.preferences.set("unrelated@example.com","UNSUBSCRIBED");await scoped.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED");
  for(const query of scoped.reads.slice(2))assert.deepEqual(Array.from(query.where.normalizedEmail.in),["client0@example.com"]);
});
test("bulk eligibility read failures abort counting and do not assume recipients are eligible",async()=>{
  for(const model of ["marketingEmailPreference","communicationSuppression"]){const f=fixture();f.prisma[model].findMany=async()=>{throw new Error("Eligibility read failed");};await assert.rejects(f.service.eventUpdateAudienceCount("event","workspace","ALL_INVITED"),/Eligibility read failed/);}
});
test("new and repeated update schedules leave original three rows unchanged and dedupe concurrent requests",async()=>{
  const f=fixture(),original=structuredClone(f.deliveries);
  const results=await Promise.all([f.service.scheduleEventUpdate("event","workspace",f.input),f.service.scheduleEventUpdate("event","workspace",f.input)]);
  assert.equal(f.deliveries.length,4);assert.deepEqual(f.deliveries.slice(0,3),original);assert.equal(results.filter(result=>result.replayed).length,1);
  assert.equal(f.deliveries[3].updateAudience,"ALL_INVITED");assert.equal(f.deliveries[3].updateBody,copy.body);
  await f.service.scheduleEventUpdate("event","workspace",{...f.input,requestId:secondId});assert.equal(f.deliveries.length,5);assert.deepEqual(f.deliveries.slice(0,3),original);
});
test("replays fail closed on changed copy/audience/time or cancelled delivery and never reactivate",async()=>{
  const f=fixture();await f.service.scheduleEventUpdate("event","workspace",f.input);
  for(const change of [{body:"Different"},{subject:"Different"},{audience:"YES"},{scheduledAt:new Date(+new Date(f.input.scheduledAt)+60000).toISOString()}])await assert.rejects(f.service.scheduleEventUpdate("event","workspace",{...f.input,...change}),/different details/);
  f.deliveries[3].status="COMPLETED";assert.equal((await f.service.scheduleEventUpdate("event","workspace",f.input)).replayed,true);assert.equal(f.deliveries[3].status,"COMPLETED");
  f.deliveries[3].status="CANCELLED";await assert.rejects(f.service.scheduleEventUpdate("event","workspace",f.input),/cancelled/);assert.equal(f.deliveries.length,4);
});
test("concurrent conflicting requests cannot overwrite a saved update and cancellation wins the schedule lock",async()=>{
  const f=fixture();const results=await Promise.allSettled([f.service.scheduleEventUpdate("event","workspace",f.input),f.service.scheduleEventUpdate("event","workspace",{...f.input,body:"Conflicting copy"})]);
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);assert.equal(results.filter(result=>result.status==="rejected").length,1);assert.equal(f.deliveries.length,4);assert.equal(f.deliveries[3].updateBody,copy.body);
  const cancelled=fixture();cancelled.setLockHook(()=>{cancelled.event.status="CANCELLED";});await assert.rejects(cancelled.service.scheduleEventUpdate("event","workspace",cancelled.input),/Event changed/);assert.equal(cancelled.deliveries.length,3);
});
test("schedule guards workspace, event state, future timing, initial delivery and empty audiences",async()=>{
  for(const change of ["workspace","cancelled","expired","past","after-event","before-initial","initial-cancelled","empty"]){
    const f=fixture();let workspace="workspace";
    if(change==="workspace")workspace="other";if(change==="cancelled")f.event.status="CANCELLED";if(change==="expired")f.event.startsAt=new Date(0);if(change==="past")f.input.scheduledAt=new Date(0).toISOString();if(change==="after-event")f.input.scheduledAt=new Date(+f.event.startsAt+1).toISOString();if(change==="before-initial")f.deliveries[0].scheduledAt=new Date(+new Date(f.input.scheduledAt)+1);if(change==="initial-cancelled")f.deliveries[0].status="CANCELLED";if(change==="empty")f.invitations.forEach(invitation=>invitation.sent=false);
    await assert.rejects(f.service.scheduleEventUpdate("event",workspace,f.input));assert.equal(f.deliveries.length,3,change);
  }
});
test("cancellation touches only selected update and pending messages, never original deliveries or accepted payloads",async()=>{
  const f=fixture();await f.service.scheduleEventUpdate("event","workspace",f.input);await f.service.scheduleEventUpdate("event","workspace",{...f.input,requestId:secondId});
  const original=structuredClone(f.deliveries.slice(0,3)),id=f.deliveries[3].id;
  f.messages.push({deliveryId:id,status:"PENDING"},{deliveryId:id,status:"SENDING",encryptedPayload:"frozen"},{deliveryId:id,status:"SENT"},{deliveryId:f.deliveries[4].id,status:"PENDING"});
  await f.service.cancelEventUpdate("event","workspace",id);await f.service.cancelEventUpdate("event","workspace",id);
  assert.deepEqual(f.deliveries.slice(0,3),original);assert.equal(f.deliveries[3].status,"CANCELLED");assert.equal(f.deliveries[4].status,"SCHEDULED");assert.deepEqual(f.messages.map(message=>message.status),["SKIPPED","SENDING","SENT","PENDING"]);assert.equal(f.messages[1].encryptedPayload,"frozen");
  await assert.rejects(f.service.cancelEventUpdate("event","workspace","original-1"),/not found/);await assert.rejects(f.service.cancelEventUpdate("event","other",id),/not found/);
});

function route(admin=async()=>({workspaceId:"workspace"})) {
  const calls:any[]=[];
  const service={eventAdmin:admin,getEvent:async(id:string,workspace:string)=>{calls.push(["get",id,workspace]);if(workspace!=="workspace")throw new Error("Event not found.");return baseEvent();},auditEvent:async(...args:any[])=>calls.push(["audit",...args])};
  const backend={eventUpdateAudienceCount:async(...args:any[])=>{calls.push(["count",...args]);return 4;},scheduleEventUpdate:async(...args:any[])=>{calls.push(["schedule",...args]);return {event:baseEvent(),replayed:false};},cancelEventUpdate:async(...args:any[])=>{calls.push(["cancel",...args]);return baseEvent();}};
  const handler=load("../../app/api/admin/events/[eventId]/updates/route.ts",{"next/server":next,"@/lib/events/service":service,"@/lib/events/api":api,"@/lib/events/updates-core":updates,"@/lib/events/updates-email":updateEmail,"@/lib/events/updates-service":backend,"@/lib/client-communications/email":{sendTestCampaign:async(...args:any[])=>calls.push(["send",...args])}});
  return {calls,handler,backend};
}
const ctx={params:Promise.resolve({eventId:"event"})};
test("preview route renders unsaved copy with no write, audit, send, invitation token or audience mutation",async()=>{
  const r=route();const result=await r.handler.POST(request({...copy,action:"preview"}),ctx);
  assert.equal(result.status,200);assert.equal(result.data.subject,"A quick update, Alex");assert.equal(result.data.audienceCount,4);assert.equal(result.headers["Cache-Control"],"no-store");assert.deepEqual(r.calls.map(call=>call[0]),["get","count"]);assert(!result.data.html.includes("/events/rsvp"));
});
test("update route rejects unauthenticated/wrong-workspace calls, oversized bodies and missing action-time confirmation",async()=>{
  const denied=route(async()=>{throw new Error("Administrator access required.");});assert.equal((await denied.handler.POST(request({...copy,action:"preview"}),ctx)).status,403);assert.equal(denied.calls.length,0);
  const other=route(async()=>({workspaceId:"other"}));assert.equal((await other.handler.POST(request({...copy,action:"preview"}),ctx)).status,404);
  for(const action of ["test","schedule","cancel","unknown"]){const r=route();assert.equal((await r.handler.POST(request({...copy,action}),ctx)).status,400);assert.deepEqual(r.calls.map(call=>call[0]),["get"]);}
  const oversized=route();assert.equal((await oversized.handler.POST(request({...copy,action:"preview",extra:"x".repeat(65536)}),ctx)).status,400);assert.deepEqual(oversized.calls.map(call=>call[0]),["get"]);
});
test("explicit tests only use chosen address and disabled links, scheduling/cancellation only call scoped backend",async()=>{
  const r=route();const result=await r.handler.POST(request({...copy,action:"test",confirm:true,testEmail:"OWNER@example.com"}),ctx);assert.equal(result.status,200);
  const send=r.calls.find(call=>call[0]==="send")[1];assert.equal(send.to,"owner@example.com");assert(!send.html.includes("/events/rsvp"));assert.equal(send.source,"test");
  for(const action of ["schedule","cancel"]){const task=route();const result=await task.handler.POST(request({...copy,action,confirm:true,requestId,scheduledAt:new Date(Date.now()+3600000).toISOString(),deliveryId:"chosen-update"}),ctx);assert.equal(result.status,200);assert.deepEqual(task.calls.map(call=>call[0]),["get",action,"audit"]);assert.equal(task.calls[1][1],"event");assert.equal(task.calls[1][2],"workspace");}
});
test("idempotency conflicts return HTTP 409 and exact replay never repeats the schedule audit",async()=>{
  const conflict=route();conflict.backend.scheduleEventUpdate=async()=>{throw new updates.EventUpdateConflict("This update request was already used with different details.");};
  const result=await conflict.handler.POST(request({...copy,action:"schedule",confirm:true}),ctx);assert.equal(result.status,409);assert.match(result.data.error,/different details/);assert.deepEqual(conflict.calls.map(call=>call[0]),["get"]);
  const replay=route();replay.backend.scheduleEventUpdate=async()=>({event:baseEvent(),replayed:true});const existing=await replay.handler.POST(request({...copy,action:"schedule",confirm:true}),ctx);assert.equal(existing.status,200);assert.match(existing.data.message,/already saved/);assert.deepEqual(replay.calls.map(call=>call[0]),["get"]);
});
test("admin serialization selects party counts but never invitation tokens or encrypted delivery payloads",async()=>{
  let query:any;
  const service=load("./service.ts",{"server-only":{},"@/lib/prisma":{prisma:{eventInvitationEvent:{findFirst:async(args:any)=>{query=args;return {id:"event",invitations:[{response:"YES",additionalGuests:2}]};}}}},"@/lib/client-communications/bounce-core":{},"@/lib/auth/session":{},"@/lib/client-communications/preferences":{},"@/lib/audit":{},"./themes":themes,"./core":{}});
  const event=await service.getEvent("event","workspace");assert.equal(event.invitations[0].additionalGuests,2);assert.equal(query.include.invitations.select.additionalGuests,true);assert.equal(query.include.invitations.select.encryptedToken,undefined);assert.equal(query.include.invitations.select.tokenHash,undefined);assert.equal(query.include.deliveries.include.messages.select.encryptedPayload,undefined);assert.equal(query.where.workspaceId,"workspace");
});
