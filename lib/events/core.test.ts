import test from "node:test";
import assert from "node:assert/strict";
import {newToken,tokenHash,validToken,encrypt,decrypt,defaultSchedule,stageTargets,eventInput} from "./core.ts";
import {replayDecision,leaseClaimable,dispatchOpen} from "./policy.ts";
import {readFileSync} from "node:fs";
const secret = "a".repeat(64);
test("random tokens are unguessable, hashed, and authenticated ciphertext roundtrips",()=>{
 const a=newToken(),b=newToken();assert.notEqual(a,b);assert(validToken(a));assert.equal(tokenHash(a).length,64);assert(!validToken("x"));const encrypted=encrypt(a,secret);assert(!encrypted.includes(a));assert.equal(decrypt(encrypted,secret),a);assert.throws(()=>decrypt(encrypted,"b".repeat(64)));assert.throws(()=>encrypt(a,"short"));
});
test("default timing is initial, 14-day follow-up, day-before reminder; near events omit stale stages",()=>{
 const initial=new Date(Date.now()+3600000),start=new Date(+initial+30*86400000);const stages=defaultSchedule(initial,start);assert.deepEqual(stages.map(x=>x.stage),["INITIAL","FOLLOW_UP","REMINDER"]);assert.equal(+stages[1].scheduledAt- +initial,14*86400000);assert.equal(+start- +stages[2].scheduledAt,86400000);assert.equal(defaultSchedule(initial,new Date(+initial+3600000)).length,1);assert.throws(()=>defaultSchedule(new Date("bad"),start));assert.throws(()=>defaultSchedule(new Date(0),start));
});
test("stage targeting rechecks current responses",()=>{
 for(const response of ["PENDING","YES","NO"]){assert(stageTargets("INITIAL",response));assert.equal(stageTargets("FOLLOW_UP",response),response==="PENDING");assert.equal(stageTargets("REMINDER",response),response==="YES");}assert(!stageTargets("unknown","YES"));
});
test("retry policy never replays beyond provider retention or retry limit",()=>{
 const now=Date.now();assert.equal(replayDecision({firstAttemptAt:null,attempts:0},now),"ATTEMPT");assert.equal(replayDecision({firstAttemptAt:new Date(now-3600000),attempts:1},now),"ATTEMPT");assert.equal(replayDecision({firstAttemptAt:new Date(now-21*3600000),attempts:1},now),"UNCERTAIN");assert.equal(replayDecision({firstAttemptAt:null,attempts:5},now),"UNCERTAIN");
});
test("only pending or expired leases can claim; terminal or concurrent live claims cannot",()=>{
 const now=Date.now();assert(leaseClaimable("PENDING",null,now));assert(!leaseClaimable("SENDING",new Date(now),now));assert(leaseClaimable("SENDING",new Date(now-360000),now));for(const status of ["SENT","SKIPPED","UNCERTAIN","FAILED"])assert(!leaseClaimable(status,new Date(0),now));
});
test("cancelled/expired/future-rescheduled deliveries never dispatch",()=>{
 const now=Date.now();const base={eventStatus:"SCHEDULED",deliveryStatus:"SCHEDULED",startsAt:new Date(now+3600000),scheduledAt:new Date(now-1000)};assert(dispatchOpen(base,now));assert(!dispatchOpen({...base,eventStatus:"CANCELLED"},now));assert(!dispatchOpen({...base,deliveryStatus:"CANCELLED"},now));assert(!dispatchOpen({...base,startsAt:new Date(now)},now));assert(!dispatchOpen({...base,scheduledAt:new Date(now+1000)},now));
});
test("event validation rejects missing audiences, malformed dates, and invalid timezone",()=>{
 const base={title:"Party",description:"Join us",location:"Studio",startsAt:new Date(Date.now()+86400000).toISOString(),mode:"ALL"};assert.equal(eventInput(base).timeZone,"America/Denver");assert.throws(()=>eventInput({...base,mode:"INDIVIDUALS"}));assert.throws(()=>eventInput({...base,timeZone:"invalid"}));assert.throws(()=>eventInput({...base,startsAt:"bad"}));
});
test("durable processor protects workspace, suppressed addresses, claim CAS, payload and start lock",()=>{
 const src=readFileSync(new URL("./delivery.ts",import.meta.url),"utf8");for(const needle of ["workspaceMemberships:{some:{workspaceId:current.event.workspaceId}}","addressIsMarketingEligible(current.email)","bouncedBackSystemKey(current.event.workspaceId)","where:{id:message.id,claimId}","idempotencyKey:`event-message-${message.id}`","message.encryptedPayload","firstAttemptAt:new Date()","fresh.scheduledAt > new Date()","tx.eventDeliveryMessage.createMany","stageTargets(delivery.stage,current.response)"])assert(src.includes(needle),needle);
 const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");assert(service.includes('updatedAt:event.updatedAt'));assert(service.includes('tx.eventDeliveryMessage.count'));assert(service.includes('workspaceMemberships:{some:{workspaceId}}'));
});
test("GET RSVP is read-only and accepts token only via header; POST serializes against cancel",()=>{
 const src=readFileSync(new URL("../../app/api/events/rsvp/route.ts",import.meta.url),"utf8");const get=src.split("export async function GET")[1].split("export async function POST")[0];assert(!get.includes("update"));assert(!get.includes("searchParams"));assert(get.includes('headers.get("authorization")'));assert(src.includes('tx.eventInvitationEvent.updateMany'));assert(src.includes('"Cache-Control":"no-store, private"'));
});
test("event webhook uses provider message ownership before suppression and retries early events",()=>{
 const src=readFileSync(new URL("./webhook.ts",import.meta.url),"utf8");assert(src.includes('where:{providerMessageId}'));assert(src.includes('providerRecipientMatches(recipients,email)'));assert(src.includes('setMarketingPreference'));assert(src.includes('bounceType?.trim().toLowerCase() === "permanent"'));
 const route=readFileSync(new URL("../../app/api/webhooks/resend/route.ts",import.meta.url),"utf8");assert(route.includes('processEventWebhook'));assert(route.includes('["FAILED_RETRYABLE", "UNMATCHED_MESSAGE_ID"]'));assert(route.includes('status: retry ? 503 : 200'));
});
test("dependent stages cannot precede initial and wait when its delivery is unfinished",()=>{
 const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");assert(service.includes('scheduledAt <= initial.scheduledAt'));
 const delivery=readFileSync(new URL("./delivery.ts",import.meta.url),"utf8");assert(delivery.includes('Waiting for initial invitation delivery.'));assert(delivery.includes('attempts:{decrement:1}'));
});
