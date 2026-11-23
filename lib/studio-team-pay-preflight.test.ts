import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { createStudioPayBridge, studioPaySinkCheckEnabled, TeamPayBridgeError, UPLOADER_PAY_BRIDGE, type Actor, type Bridge, type PayPreflightChecks } from "./studio-team-pay-bridge.ts";
import { handleStudioPay, handleStudioPayPreflight, STUDIO_ORIGIN } from "./studio-team-pay-review.ts";

const owner: Actor = { userId:"studio-owner", role:"OWNER", email:"example-owner@example.test" };
const admin: Actor = { userId:"studio-admin", role:"ADMIN", email:"example-admin@example.test" };
const check = "/admin/team-pay/preflight";
const clock = () => new Date("2026-11-23T17:00:00Z");
const checks: PayPreflightChecks = {
  configured:true,bridgeReady:true,storeReady:true,enrolledCount:1,expectedEnrolledCount:1,sourceReady:true,
  benchmarkVisitCount:6,benchmarkTaskCount:31,senderConfigured:true,senderVerified:false,ownerRecipientReady:true,
  eligibleReviewerCount:1,writesEnabled:false,emailsEnabled:false,
};
const request = (method="GET",suffix="") => new Request(STUDIO_ORIGIN+check+suffix,{method});
const noBridge: Bridge = async () => assert.fail("preflight reached bridge without permission");

test("preflight is exact fixed scope, owner-only, and never passes a forged scope to Uploader",async()=>{
  const signedOut = await handleStudioPayPreflight(request(),{readActor:async()=>null,bridge:noBridge});
  assert.equal(signedOut.status,303);
  assert.equal(new URL(signedOut.headers.get("location")!,STUDIO_ORIGIN).searchParams.get("next"),check);
  const signedInAdmin = await handleStudioPayPreflight(request(),{readActor:async()=>admin,bridge:noBridge});
  assert.equal(signedInAdmin.status,403);
  assert.equal((await handleStudioPayPreflight(request("PUT"),{readActor:async()=>assert.fail(),bridge:noBridge})).status,405);
  assert.equal((await handleStudioPayPreflight(request("GET","?memberId=other&week=2026-11-09"),{readActor:async()=>assert.fail(),bridge:noBridge})).status,400);
  const head = await handleStudioPayPreflight(request("HEAD"),{readActor:async()=>owner,bridge:noBridge});
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  const valid = await handleStudioPayPreflight(request(),{readActor:async()=>owner,bridge:async(actor,query)=>{
    assert.equal(actor,owner);
    assert.deepEqual(query,{action:"preflight"});
    return {checks};
  }});
  assert.equal(valid.status,200);
  assert.equal(valid.headers.get("Cache-Control"),"private, no-store");
  const html = await valid.text();
  assert.match(html,/Matched: 6 visits \/ 31 tasks/);
  assert.match(html,/sender match does not confirm delivery/i);
  assert.match(html,/Team Pay email dispatch<\/strong><span>Off/);
  assert.doesNotMatch(html,/example-owner|studio-owner|example-admin/);
});

test("a refused or malformed preflight cannot masquerade as a verified empty or matched benchmark",async()=>{
  const unavailable = await handleStudioPayPreflight(request(),{readActor:async()=>owner,bridge:async()=>{
    return {checks:{...checks,sourceReady:false,benchmarkVisitCount:null,benchmarkTaskCount:null}};
  }});
  const missing = await unavailable.text();
  assert.match(missing,/Unavailable \(not an empty week\)/);
  assert.doesNotMatch(missing,/Matched:/);
  const malformed = await handleStudioPayPreflight(request(),{readActor:async()=>owner,bridge:async()=>{
    return {checks:{...checks,sourceReady:false,benchmarkVisitCount:0,benchmarkTaskCount:null}};
  }});
  assert.equal(malformed.status,503);
  const mismatched = await handleStudioPayPreflight(request(),{readActor:async()=>owner,bridge:async()=>{
    return {checks:{...checks,benchmarkTaskCount:30}};
  }});
  assert.match(await mismatched.text(),/Mismatch: 6 visits \/ 30 tasks/);
});

test("signed transport denies Admin preflight and shadow writes, forwards only its exact owner action, and rejects extra fields",async()=>{
  const secret = "a".repeat(43), ts = String(Math.floor(clock().getTime()/1000));
  let calls=0;
  const b=createStudioPayBridge({secret,clock:()=>clock().getTime(),env:{TEAM_PAY_WRITES_ENABLED:"false"},fetcher:async(url,init)=>{
    calls++;
    assert.equal(url,UPLOADER_PAY_BRIDGE);
    const body=String(init?.body), h=new Headers(init?.headers);
    assert.deepEqual(JSON.parse(body),{action:"preflight",actorId:owner.userId,actorRole:"OWNER",email:owner.email});
    assert.equal(h.get("x-helios-pay-signature"),createHmac("sha256",secret).update(ts+"\n"+body).digest("hex"));
    assert.equal(init?.credentials,"omit");
    return Response.json(calls===1 ? {checks} : {checks:{...checks,senderAddress:"do-not-echo@example.test"}});
  }});
  await assert.rejects(()=>b(admin,{action:"preflight"}),e=>e instanceof TeamPayBridgeError&&e.status===403);
  await assert.rejects(()=>b(owner,{action:"review",memberId:"fixture-member",weekStart:"2026-11-16",expectedRevision:1,decision:"approve"}),e=>e instanceof TeamPayBridgeError&&e.status===503);
  assert.equal(calls,0);
  assert.deepEqual(await b(owner,{action:"preflight"}),{checks});
  await assert.rejects(()=>b(owner,{action:"preflight"}),e=>e instanceof TeamPayBridgeError&&e.status===503);
  assert.equal(calls,2);
});

test("shadow hides both owner write controls and stops forged POSTs before body parsing or bridge",async()=>{
  const memberId="fixture-photographer", weekStart="2026-11-23";
  for(const status of ["draft","submitted"] as const){
    const week={memberId,weekStart,status,revision:2,ready:true,lines:[]};
    const outcome=await handleStudioPay(new Request(STUDIO_ORIGIN+`/admin/team-pay?week=${weekStart}&memberId=${memberId}`),{
      readActor:async()=>owner,clock,activationWeek:weekStart,bridge:async(_actor,q)=>q.action==="list" ?
        {enrolled:[{id:memberId,name:"Fixture Photographer"}],weeks:[week]} : {week},
    });
    assert.equal(outcome.status,200);
    const html=await outcome.text();
    assert.match(html,/Read-only rollout check/);
    assert.match(html,/Check rollout readiness/);
    assert.doesNotMatch(html,/Approve signed revision|Save weekly draft|<form |Earlier week/);
  }
  for(const action of ["review","save"]){
    const r=await handleStudioPay(new Request(STUDIO_ORIGIN+"/admin/team-pay",{
      method:"POST",headers:{origin:STUDIO_ORIGIN},body:`action=${action}`,
    }),{readActor:async()=>owner,clock,bridge:noBridge});
    assert.equal(r.status,503);
    assert.match(await r.text(),/read.only/);
  }
});

test("activation-aware default never requests a prior or a not-yet-available week",async()=>{
  const current = await handleStudioPay(new Request(STUDIO_ORIGIN+"/admin/team-pay"),{
    readActor:async()=>owner,clock,activationWeek:"2026-11-23",bridge:async(_actor,q)=>{
      assert.deepEqual(q,{action:"list",weekStart:"2026-11-23"});
      return {enrolled:[],weeks:[]};
    },
  });
  assert.equal(current.status,200);
  const future = await handleStudioPay(new Request(STUDIO_ORIGIN+"/admin/team-pay"),{
    readActor:async()=>owner,clock,activationWeek:"2026-11-30",bridge:noBridge,
  });
  assert.equal(future.status,200);
  assert.match(await future.text(),/My Pay opens the week of Nov 30, 2026/);
});

const sinkEnv = {VERCEL_ENV:"production",TEAM_PAY_SINK_CHECK_ENABLED:"true",TEAM_PAY_WRITES_ENABLED:"false",TEAM_PAY_EMAILS_ENABLED:"false"};
const senderAddress = "uploader-mail@example.test";
const sink = (entries: Array<[string,string]> = [["confirmSink","yes"]], origin = STUDIO_ORIGIN, host = STUDIO_ORIGIN) =>
  new Request(host+check,{method:"POST",headers:{origin},body:new URLSearchParams(entries)});

test("synthetic test is explicit owner-only same-origin POST; GET cannot reach a send",async()=>{
  let posts = 0, probes = 0;
  const b: Bridge = async(actor,q)=>{
    assert.equal(actor,owner);
    if(q.action==="preflight"){probes++;return {checks};}
    assert.deepEqual(q,{action:"mail-sink-check"});
    posts++;
    return {sinkAccepted:true,senderAddress};
  };
  const enabled = {readActor:async()=>owner,bridge:b,sinkCheckEnabled:true};
  const preview = await handleStudioPayPreflight(request(),enabled);
  assert.equal(preview.headers.get("Referrer-Policy"),"same-origin");
  assert.match(preview.headers.get("Content-Security-Policy") ?? "", /form-action 'self'; frame-ancestors 'none'/);
  const html=await preview.text();
  assert.match(html,/Run synthetic test/);
  assert.match(html,/does not send email to staff, owners, or customers/);
  assert.doesNotMatch(html,/example-owner|example-admin|delivered@|uploader-mail@/);
  assert.equal(posts,0);assert.equal(probes,1);
  const blocked = async (r:Request, actor:Actor|null, enabled=true) =>
    handleStudioPayPreflight(r,{readActor:async()=>actor,bridge:noBridge,sinkCheckEnabled:enabled});
  assert.equal((await blocked(sink(),owner,false)).status,503);
  assert.equal((await blocked(sink(),admin)).status,403);
  assert.equal((await blocked(sink(),null)).status,403);
  assert.equal((await blocked(sink([]),owner)).status,422);
  assert.equal((await blocked(sink([["confirmSink","yes"],["recipient","customer@example.test"]]),owner)).status,422);
  assert.equal((await blocked(sink([["confirmSink","yes"],["confirmSink","yes"]]),owner)).status,422);
  assert.equal((await blocked(sink(undefined,"https://other.example.test"),owner)).status,403);
  assert.equal((await blocked(sink(undefined,"null"),owner)).status,403);
  assert.equal((await blocked(new Request(STUDIO_ORIGIN+check,{method:"POST",body:new URLSearchParams({confirmSink:"yes"})}),owner)).status,403);
  assert.equal((await blocked(sink(undefined,STUDIO_ORIGIN,"https://alternate.example.test"),owner)).status,403);
  const accepted=await handleStudioPayPreflight(sink(),enabled);
  assert.equal(accepted.status,200);
  const acceptedHtml = await accepted.text();
  assert.match(acceptedHtml,/accepted the synthetic test request\. No team or customer email was sent/);
  assert.match(acceptedHtml,/Verified From mailbox: <strong>uploader-mail@example\.test<\/strong>/);
  assert.doesNotMatch(acceptedHtml,/delivered@|example-owner|example-admin/);
  assert.match(accepted.headers.get("Cache-Control") ?? "",/private, no-store/);
  assert.equal(accepted.headers.get("Referrer-Policy"),"no-referrer");
  const readOnly=await handleStudioPayPreflight(request(),{...enabled,sinkCheckEnabled:false});
  assert.equal(readOnly.headers.get("Referrer-Policy"),"no-referrer");
  assert.doesNotMatch(await readOnly.text(),/<form/);
  assert.equal(posts,1);
  const rejected=await handleStudioPayPreflight(sink(),{...enabled,bridge:async()=>({sinkAccepted:false})});
  assert.equal(rejected.status,503);
  assert.doesNotMatch(await rejected.text(),/accepted the synthetic|Verified From mailbox|uploader-mail@/);
});

test("sink transport requires Production, the dedicated flag and both writes/email off",async()=>{
  assert.equal(studioPaySinkCheckEnabled(sinkEnv),true);
  let calls=0;
  for(const env of [
    {...sinkEnv,VERCEL_ENV:"preview"},{...sinkEnv,TEAM_PAY_SINK_CHECK_ENABLED:"false"},
    {...sinkEnv,TEAM_PAY_WRITES_ENABLED:"true"},{...sinkEnv,TEAM_PAY_EMAILS_ENABLED:"true"},
  ]) {
    assert.equal(studioPaySinkCheckEnabled(env),false);
    const noSink=createStudioPayBridge({env,secret:"b".repeat(43),fetcher:async()=>assert.fail("sink must not reach Uploader")});
    await assert.rejects(()=>noSink(owner,{action:"mail-sink-check"}),e=>e instanceof TeamPayBridgeError&&e.status===503);
  }
  const results = [
    {sinkAccepted:true,senderAddress},
    {sinkAccepted:false},
    {sinkAccepted:true,senderAddress,recipient:"do-not-echo"},
    {sinkAccepted:true},
    {sinkAccepted:false,senderAddress},
    {sinkAccepted:true,senderAddress:"Helios <user@example.test>"},
    {sinkAccepted:true,senderAddress:"UPLOADER-MAIL@example.test"},
    {sinkAccepted:true,senderAddress:senderAddress+"\n"},
    {sinkAccepted:true,senderAddress:[senderAddress]},
  ];
  const b=createStudioPayBridge({env:sinkEnv,secret:"b".repeat(43),fetcher:async(_url,init)=>{
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)),{action:"mail-sink-check",actorId:owner.userId,actorRole:"OWNER",email:owner.email});
    return Response.json(results[calls-1]);
  }});
  await assert.rejects(()=>b(admin,{action:"mail-sink-check"}),e=>e instanceof TeamPayBridgeError&&e.status===403);
  assert.equal(calls,0);
  assert.deepEqual(await b(owner,{action:"mail-sink-check"}),{sinkAccepted:true,senderAddress});
  assert.deepEqual(await b(owner,{action:"mail-sink-check"}),{sinkAccepted:false});
  for(const _ of results.slice(2)) {
    await assert.rejects(()=>b(owner,{action:"mail-sink-check"}),e=>e instanceof TeamPayBridgeError&&e.status===503);
  }
});
