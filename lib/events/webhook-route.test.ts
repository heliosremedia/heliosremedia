/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as core from "../client-communications/resend-webhook-core.ts";
import * as bounce from "../client-communications/bounce-core.ts";
const signingKey=Buffer.from("test-webhook-signature-key-only");
function load(file:string,mocks:Record<string,any>){const exports:any={};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:(id:string)=>{if(!(id in mocks))throw new Error(`Unexpected dependency ${id}`);return mocks[id];},process:{env:{RESEND_WEBHOOK_SECRET:`whsec_${signingKey.toString("base64")}`}},Date,Buffer,Error,console:{error(){},warn(){}}});return exports;}
function harness(){
 const receipts=new Map<string,any>();const events:any[]=[];const monthly:any[]=[];const suppressions:any[]=[];const preferences:any[]=[];const clients:any[]=[];const memberships:any[]=[];let lookupFailure=false;
 const prisma:any={
  resendWebhookEvent:{findUnique:async({where}:any)=>receipts.get(where.providerEventId)||null,create:async({data}:any)=>{receipts.set(data.providerEventId,{...data});return data;},update:async({where,data}:any)=>{Object.assign(receipts.get(where.providerEventId),data);return receipts.get(where.providerEventId);},updateMany:async({where,data}:any)=>{const row=receipts.get(where.providerEventId);if(row)Object.assign(row,data);return {count:row?1:0};}},
  campaignRecipient:{findMany:async()=>[]},referralCommunication:{findFirst:async()=>null},emailCampaign:{findUnique:async()=>null},
  eventDeliveryMessage:{findMany:async({where}:any)=>{if(lookupFailure)throw new Error("Database temporarily offline");return events.filter(e=>e.providerMessageId===where.providerMessageId);}},
  monthlySummaryAttempt:{findUnique:async({where}:any)=>monthly.find(m=>m.providerMessageId===where.providerMessageId)||null},
  communicationClient:{updateMany:async(args:any)=>{clients.push(args);return {count:1};}},
  communicationSuppression:{upsert:async({create}:any)=>{suppressions.push(create);return create;}},
  communicationGroup:{upsert:async()=>({id:"bounce-group"})},communicationGroupMembership:{createMany:async({data}:any)=>memberships.push(...data)},
  $transaction:async(ops:any)=>Promise.all(ops),
 };
 const mocks:any={"server-only":{},"node:crypto":crypto,"next/server":{NextResponse:{json:(body:any,options:any={})=>new Response(JSON.stringify(body),{status:options.status||200})}},"@/lib/prisma":{prisma},"@/lib/client-communications/preferences":{setMarketingPreference:async(input:any)=>preferences.push(input)},"@/lib/client-communications/bounces":{processPermanentBounce:async()=>{}},"@/lib/client-communications/bounce-core":bounce,"@/lib/client-communications/resend-webhook-core":core};
 mocks["@/lib/events/webhook"]=load("./webhook.ts",mocks);
 const {POST}=load("../../app/api/webhooks/resend/route.ts",mocks);
 function request(id:string,messageId:string,type="email.delivered",to=["client@example.com"],bounceType="permanent",valid=true){const body=JSON.stringify({type,data:{email_id:messageId,to,bounce:{type:bounceType}}});const timestamp=Math.floor(Date.now()/1000).toString();const sig=crypto.createHmac("sha256",signingKey).update(`${id}.${timestamp}.${body}`).digest("base64");return new Request("https://studio.example.com/api/webhooks/resend",{method:"POST",body,headers:{"svix-id":id,"svix-timestamp":timestamp,"svix-signature":`v1,${valid?sig:"invalid"}`}});}
 function addEvent(providerMessageId="provider-event"){events.push({providerMessageId,invitation:{clientId:"client",email:"client@example.com"},delivery:{event:{workspaceId:"workspace"}}});}
 function addMonthly(providerMessageId="provider-monthly",kind="LIVE",recipientEmail="client@example.com"){monthly.push({providerMessageId,kind,recipientEmail,status:"SENT",completedAt:new Date(0),payload:{immutable:true},report:{workspaceId:"workspace",clientId:"client",recipientEmail:"client@example.com"}});}
 return {POST,request,receipts,events,monthly,suppressions,preferences,clients,memberships,addEvent,addMonthly,setLookupFailure:(v:boolean)=>{lookupFailure=v;}};
}
test("signed unknown/test provider IDs retry only within immutable ten-minute receipt grace then terminate",async()=>{
 for(const message of ["unknown-message","untracked-test-message"]){const h=harness();const call=()=>h.POST(h.request("receipt",message));assert.equal((await call()).status,503);const original=h.receipts.get("receipt").receivedAt;assert.equal((await call()).status,503);assert.equal(h.receipts.get("receipt").receivedAt,original);h.receipts.get("receipt").receivedAt=new Date(Date.now()-11*60000);const finalFirst=h.receipts.get("receipt").receivedAt;assert.equal((await call()).status,200);assert.equal(h.receipts.get("receipt").processingStatus,"UNMATCHED_FINAL");assert.equal((await call()).status,200);assert.equal(h.receipts.get("receipt").receivedAt,finalFirst);assert.equal(h.suppressions.length,0);}
});
test("signed early-persistence retry resolves after stored event provider ID arrives",async()=>{
 const h=harness();assert.equal((await h.POST(h.request("early","provider-event"))).status,503);h.addEvent();assert.equal((await h.POST(h.request("early","provider-event"))).status,200);assert.equal(h.receipts.get("early").processingStatus,"PROCESSED");assert.equal(h.receipts.get("early").clientId,"client");
});
test("signed known monthly receipt preserves immutable attempt and processes complaint/permanent bounce",async()=>{
 for(const kind of ["LIVE","MANUAL","RESEND"]) for(const type of ["email.delivered","email.complained","email.bounced"]){const h=harness();h.addMonthly("provider-monthly",kind);const before=structuredClone(h.monthly);assert.equal((await h.POST(h.request("monthly","provider-monthly",type))).status,200);assert.deepEqual(h.monthly,before);assert.equal(h.receipts.get("monthly").processingStatus,"PROCESSED");assert.equal(h.receipts.get("monthly").workspaceId,"workspace");assert.equal(h.receipts.get("monthly").clientId,"client");assert.equal(h.suppressions.length,type==="email.delivered"?0:1);if(type!=="email.delivered")assert.equal(h.preferences[0].email,"client@example.com");}
});
test("monthly internal test recipient never acquires report client's identity",async()=>{
 for(const type of ["email.complained","email.bounced","email.suppressed"]) { const h=harness();h.addMonthly("test-monthly","TEST","admin@example.com");assert.equal((await h.POST(h.request("test","test-monthly",type,["admin@example.com"]))).status,200);assert.equal(h.receipts.get("test").clientId,null);assert.equal(h.receipts.get("test").processingStatus,"PROCESSED_TEST");assert.equal(h.suppressions.length,0);assert.equal(h.preferences.length,0);assert.equal(h.memberships.length,0);assert.equal(h.clients.length,0); }
});
test("signed recipient mismatch and ambiguous event/monthly ownership terminate without suppression",async()=>{
 for(const kind of ["mismatch","duplicate-event","cross-family"]){const h=harness();h.addEvent();if(kind==="duplicate-event")h.addEvent();if(kind==="cross-family")h.addMonthly("provider-event");const req=()=>h.request("bad","provider-event","email.complained",[kind==="mismatch"?"other@example.com":"client@example.com"]);assert.equal((await h.POST(req())).status,200);assert.equal(h.receipts.get("bad").processingStatus,"REJECTED_PERMANENT");assert.equal((await h.POST(req())).status,200);assert.equal(h.suppressions.length,0);assert.equal(h.preferences.length,0);}
});
test("signed transient processing failure remains retryable then succeeds",async()=>{
 const h=harness();h.addEvent();h.setLookupFailure(true);assert.equal((await h.POST(h.request("retry","provider-event"))).status,503);assert.equal(h.receipts.get("retry").processingStatus,"FAILED_RETRYABLE");h.setLookupFailure(false);assert.equal((await h.POST(h.request("retry","provider-event"))).status,200);assert.equal(h.receipts.get("retry").processingStatus,"PROCESSED");
});
test("invalid signature never creates a receipt or suppression",async()=>{
 const h=harness();h.addMonthly();assert.equal((await h.POST(h.request("invalid","provider-monthly","email.complained",undefined,undefined,false))).status,401);assert.equal(h.receipts.size,0);assert.equal(h.suppressions.length,0);
});
test("monthly snapshot mismatch and unknown complaint sharing a client email cannot associate by address",async()=>{
 const h=harness();h.addMonthly("monthly-mismatch","LIVE","different@example.com");assert.equal((await h.POST(h.request("mismatch","monthly-mismatch","email.complained",["different@example.com"]))).status,200);assert.equal(h.receipts.get("mismatch").processingStatus,"REJECTED_PERMANENT");h.addEvent();assert.equal((await h.POST(h.request("unknown-complaint","unknown-id","email.complained"))).status,503);assert.equal(h.suppressions.length,0);assert.equal(h.preferences.length,0);assert.equal(h.clients.length,0);
});
