/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as core from "./core.ts";
import * as policy from "./policy.ts";
import * as webhookCore from "../client-communications/resend-webhook-core.ts";
import * as bounce from "../client-communications/bounce-core.ts";

const secret = "event-test-secret-".repeat(4);
function moduleUnderTest(file:string,mocks:Record<string,unknown>) {
  const source=readFileSync(new URL(file,import.meta.url),"utf8");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,any>={};
  vm.runInNewContext(js,{exports,require:(name:string)=>{if(!(name in mocks))throw new Error(`Unexpected dependency ${name}`);return mocks[name];},process:{env:{AUTH_SECRET:secret}},Date,JSON,console,Buffer},{filename:file});
  return exports;
}
function matches(row:any,where:any):boolean {
  return Object.entries(where || {}).every(([key,value]:[string,any])=>{
    if(key==="OR")return value.some((part:any)=>matches(row,part));
    const actual=row[key];
    if(value && typeof value==="object" && !(value instanceof Date)) {
      if("in" in value)return value.in.includes(actual);
      if("lt" in value)return actual!=null && +actual < +value.lt;
      if("lte" in value)return actual!=null && +actual <= +value.lte;
      if("gt" in value)return actual!=null && +actual > +value.gt;
      return !!actual && matches(actual,value);
    }
    return actual===value;
  });
}
function patch(row:any,data:any){for(const [key,value] of Object.entries(data) as [string,any][]){if(value===undefined)continue;if(value && typeof value==="object" && "increment" in value)row[key]+=value.increment;else if(value && typeof value==="object" && "decrement" in value)row[key]-=value.decrement;else row[key]=value;}}
function fixture(responses=["PENDING"]) {
  const event:any={id:"event",workspaceId:"workspace",status:"SCHEDULED",startsAt:new Date(Date.now()+86400000),title:"Original title"};
  const deliveries:any[]=[{id:"initial",eventId:event.id,stage:"INITIAL",status:"SCHEDULED",scheduledAt:new Date(Date.now()-1000)}];
  const invitations:any[]=responses.map((response,i)=>({id:`invite${i}`,eventId:event.id,clientId:`client${i}`,email:`client${i}@example.com`,response,encryptedToken:core.encrypt(core.newToken(),secret)}));
  const clients:any[]=invitations.map(i=>({id:i.clientId,normalizedEmail:i.email,workspaceId:event.workspaceId,archivedAt:null,emailSubscribed:true,emailStatus:"VALID",bounced:false}));
  const messages:any[]=[];const sends:any[]=[];const suppressions:any[]=[];const preferences:any[]=[];const webhookEvents:any[]=[];const memberships:any[]=[];
  const blocked=new Set<string>();let failSend=false;let dueHook:(()=>void)|undefined;let tokenCount=0;
  const clone=(value:any)=>structuredClone(value);
  const hydrate=(message:any)=>({...message,invitation:invitations.find(i=>i.id===message.invitationId),delivery:{...deliveries.find(d=>d.id===message.deliveryId),event}});
  const update=(rows:any[],args:any)=>{const found=rows.filter(row=>matches(row,args.where));found.forEach(row=>patch(row,args.data));return {count:found.length};};
  const prisma:any={
    monthlySummaryAttempt:{findUnique:async()=>null},
    eventInvitationEvent:{updateMany:async(args:any)=>update([event],args)},
    eventDelivery:{
      findMany:async(args:any)=>{const rows=clone(deliveries.filter(d=>matches(d,args.where)).map(d=>({...d,event})));dueHook?.();dueHook=undefined;return rows;},
      findUnique:async(args:any)=>{const d=args.where.id?deliveries.find(d=>d.id===args.where.id):deliveries.find(d=>matches(d,args.where.eventId_stage));return d?clone({...d,event}):null;},
      update:async(args:any)=>update(deliveries,args),updateMany:async(args:any)=>update(deliveries,args),
    },
    eventInvitation:{findMany:async()=>clone(invitations),findUnique:async(args:any)=>{const i=invitations.find(i=>i.id===args.where.id);return i?clone({...i,event}):null;}},
    communicationClient:{findFirst:async({where}:any)=>{
      const c=clients.find(c=>c.id===where.id);return c && c.workspaceId===where.workspaceMemberships.some.workspaceId && c.archivedAt===null && c.emailSubscribed && c.emailStatus==="VALID" && !c.bounced?clone(c):null;
    },updateMany:async(args:any)=>update(clients,args)},
    eventDeliveryMessage:{
      createMany:async({data}:any)=>{for(const row of data)if(!messages.some(m=>m.deliveryId===row.deliveryId && m.invitationId===row.invitationId))messages.push({...row,id:`message${messages.length}`,status:"PENDING",attempts:0,firstAttemptAt:null,claimedAt:null,encryptedPayload:null});},
      findMany:async({where,take}:any)=>clone(messages.map(hydrate).filter(m=>matches(m,where)).slice(0,take)),
      findFirst:async({where}:any)=>clone(messages.map(hydrate).find(m=>matches(m,where))||null),
      updateMany:async(args:any)=>update(messages,args),
      count:async({where}:any)=>messages.map(hydrate).filter(m=>matches(m,where)).length,
    },
    communicationSuppression:{upsert:async(args:any)=>{suppressions.push(args.create);blocked.add(args.create.normalizedEmail);return args.create;}},
    communicationGroup:{upsert:async()=>({id:"bounce-group"})},
    communicationGroupMembership:{createMany:async(args:any)=>memberships.push(...args.data)},
    resendWebhookEvent:{update:async(args:any)=>webhookEvents.push(args.data)},
    $transaction:async(input:any)=>typeof input==="function"?input(prisma):Promise.all(input),
  };
  const mocks={"@/lib/client-communications/resend-webhook-core":webhookCore,"server-only":{},"node:crypto":crypto,"@/lib/prisma":{prisma},"@/lib/client-communications/bounce-core":bounce,"@/lib/client-communications/preferences":{
    addressIsMarketingEligible:async(email:string)=>!blocked.has(email),createPreferenceToken:async()=>`unsubscribe-${++tokenCount}`,setMarketingPreference:async(input:any)=>preferences.push(input),
  },"@/lib/client-communications/providers/resend":{sendEmail:async(input:any)=>{sends.push(clone(input));if(failSend)throw new Error("timeout after possible acceptance");return {messageId:`provider-${input.idempotencyKey}`};}},"@/lib/site":{getSiteUrl:()=>"https://studio.example.com"},"./core":core,"./policy":policy,"./email":{renderEventEmail:(e:any,stage:string,token:string,unsubscribe:string)=>({subject:e.title,html:`${stage}:${token}:${unsubscribe}:${JSON.stringify({templateKey:e.templateKey,imageUrl:e.imageUrl,emailContent:e.emailContent})}`})}};
  const {processEventDeliveries}=moduleUnderTest("./delivery.ts",mocks);
  const {processEventWebhook}=moduleUnderTest("./webhook.ts",mocks);
  return {event,deliveries,invitations,clients,messages,sends,suppressions,preferences,webhookEvents,memberships,blocked,processEventDeliveries,processEventWebhook,setFailSend:(v:boolean)=>{failSend=v;},setDueHook:(f:()=>void)=>{dueHook=f;},expireLease:()=>messages.forEach(m=>{m.claimedAt=new Date(Date.now()-360000);}),addStage:(stage:string)=>deliveries.push({id:stage,eventId:event.id,stage,status:"SCHEDULED",scheduledAt:new Date(Date.now()-1000)})};
}

test("real processor sends initial exactly once across repeated and concurrent cron invocations",async()=>{
 const f=fixture();await Promise.all([f.processEventDeliveries(),f.processEventDeliveries()]);await f.processEventDeliveries();assert.equal(f.sends.length,1);assert.equal(f.messages.length,1);assert.equal(f.messages[0].status,"SENT");assert.equal(f.deliveries[0].status,"COMPLETED");
});
test("real processor stops cancelled/expired events and a schedule moved after due query",async()=>{
 for(const change of ["cancel","expire","reschedule"]){const f=fixture();f.setDueHook(()=>{if(change==="cancel")f.event.status="CANCELLED";else if(change==="expire")f.event.startsAt=new Date(0);else f.deliveries[0].scheduledAt=new Date(Date.now()+3600000);});await f.processEventDeliveries();assert.equal(f.sends.length,0,change);assert.equal(f.messages.length,0,change);}
});
test("real processor rechecks subscription, status, archival, workspace, bounce group, suppression and address",async()=>{
 const changes=[(f:any)=>{f.clients[0].emailSubscribed=false;},(f:any)=>{f.clients[0].emailStatus="BOUNCED";},(f:any)=>{f.clients[0].archivedAt=new Date();},(f:any)=>{f.clients[0].workspaceId="other";},(f:any)=>{f.clients[0].bounced=true;},(f:any)=>{f.blocked.add(f.invitations[0].email);},(f:any)=>{f.clients[0].normalizedEmail="changed@example.com";}];
 for(const change of changes){const f=fixture();change(f);await f.processEventDeliveries();assert.equal(f.sends.length,0);assert.equal(f.messages[0].status,"SKIPPED");}
});
test("real initial/follow-up/reminder sequence targets current RSVP responses",async()=>{
 const f=fixture(["PENDING","PENDING","PENDING"]);await f.processEventDeliveries();assert.equal(f.sends.length,3);f.invitations[1].response="YES";f.invitations[2].response="NO";f.addStage("FOLLOW_UP");await f.processEventDeliveries();assert.equal(f.sends.length,4);assert.equal(f.sends[3].to,"client0@example.com");f.invitations[0].response="NO";f.addStage("REMINDER");await f.processEventDeliveries();assert.equal(f.sends.length,5);assert.equal(f.sends[4].to,"client1@example.com");
});
test("real timeout retry preserves frozen payload and key, live lease blocks retry",async()=>{
 const f=fixture();f.setFailSend(true);await f.processEventDeliveries();assert.equal(f.messages[0].status,"SENDING");assert(f.messages[0].encryptedPayload);assert(f.messages[0].firstAttemptAt);await f.processEventDeliveries();assert.equal(f.sends.length,1);f.event.title="Changed after timeout";f.event.templateKey="CHRISTMAS";f.event.imageUrl="https://media.example.com/new.png";f.event.emailContent={INITIAL:{body:"Changed after send"}};f.expireLease();f.setFailSend(false);await f.processEventDeliveries();assert.equal(f.sends.length,2);assert.deepEqual(f.sends[1],f.sends[0]);assert.equal(f.messages[0].status,"SENT");
});
test("real timeout beyond idempotency window becomes UNCERTAIN without resending",async()=>{
 const f=fixture();f.setFailSend(true);await f.processEventDeliveries();f.expireLease();f.messages[0].firstAttemptAt=new Date(Date.now()-21*3600000);await f.processEventDeliveries();assert.equal(f.sends.length,1);assert.equal(f.messages[0].status,"UNCERTAIN");assert.equal(f.deliveries[0].status,"FAILED");
});
test("real retry rechecks changed response and suppressions rather than replaying obsolete payload",async()=>{
 const f=fixture();await f.processEventDeliveries();f.addStage("FOLLOW_UP");f.setFailSend(true);await f.processEventDeliveries();assert.equal(f.sends.length,2);f.invitations[0].response="YES";f.expireLease();await f.processEventDeliveries();assert.equal(f.sends.length,2);assert.equal(f.messages[1].status,"SKIPPED");
});
test("real webhook suppresses trusted complaint and permanent bounce, not unknown or mismatched recipients",async()=>{
 for(const status of ["COMPLAINED","BOUNCED"]){const f=fixture();await f.processEventDeliveries();const id=f.messages[0].providerMessageId;assert.equal(await f.processEventWebhook("unknown","missing",status,[f.invitations[0].email],"permanent"),false);assert.equal(f.suppressions.length,0);await assert.rejects(()=>f.processEventWebhook("mismatch",id,status,["other@example.com"],"permanent"));assert.equal(f.suppressions.length,0);assert.equal(await f.processEventWebhook("trusted",id,status,[f.invitations[0].email],"permanent"),true);assert.equal(f.suppressions.length,1);assert.equal(f.preferences[0].status,status==="COMPLAINED"?"UNSUBSCRIBED":"SUPPRESSED");assert.equal(f.webhookEvents[0].workspaceId,"workspace");f.addStage("FOLLOW_UP");await f.processEventDeliveries();assert.equal(f.sends.length,1);}
});
test("real webhook does not permanently suppress a transient bounce",async()=>{
 const f=fixture();await f.processEventDeliveries();assert.equal(await f.processEventWebhook("temporary",f.messages[0].providerMessageId,"BOUNCED",[f.invitations[0].email],"transient"),true);assert.equal(f.suppressions.length,0);assert.equal(f.preferences.length,0);
});
test("real follow-up waits safely for unfinished initial then sends after recovery",async()=>{
 const f=fixture();f.setFailSend(true);await f.processEventDeliveries();f.addStage("FOLLOW_UP");await f.processEventDeliveries();assert.equal(f.sends.length,1);assert.equal(f.messages[1].status,"PENDING");assert.equal(f.messages[1].attempts,0);f.setFailSend(false);f.expireLease();await f.processEventDeliveries();assert.equal(f.sends.length,3);assert.equal(f.messages[0].status,"SENT");assert.equal(f.messages[1].status,"SENT");
});
test("real retry ceiling holds uncertain delivery without another provider call",async()=>{
 const f=fixture();f.setFailSend(true);await f.processEventDeliveries();f.expireLease();f.messages[0].attempts=5;await f.processEventDeliveries();assert.equal(f.sends.length,1);assert.equal(f.messages[0].status,"UNCERTAIN");
});

test("real processor follows up with Maybe invitees but does not send attendance reminders",async()=>{
 const f=fixture(["MAYBE"]);await f.processEventDeliveries();assert.equal(f.sends.length,1);f.addStage("FOLLOW_UP");await f.processEventDeliveries();assert.equal(f.sends.length,2);f.addStage("REMINDER");await f.processEventDeliveries();assert.equal(f.sends.length,2);
});
