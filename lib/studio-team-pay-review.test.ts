import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { createStudioPayBridge, TeamPayBridgeError, UPLOADER_PAY_BRIDGE, type Actor, type Bridge } from "./studio-team-pay-bridge.ts";
import { handleStudioPay, STUDIO_ORIGIN } from "./studio-team-pay-review.ts";
import { RECIPIENTS_ACTION_BODY, RECIPIENTS_PATH, teamPayRecipients } from "./studio-team-pay-recipients.ts";

const owner: Actor = { userId:"studio-owner", role:"OWNER", email:"owner@example.test" };
const admin: Actor = { userId:"studio-admin", role:"ADMIN", email:"admin@example.test" };
const clock = () => new Date("2026-11-23T17:00:00Z");
const weekStart = "2026-11-16";
const memberId = "verified-photographer";
const line = { date:"2026-11-17", label:"<x> Completed service", cents:15000, kind:"basic" as const, serviceRef:"123:456" };
const existing = { memberId,weekStart,revision:3,status:"submitted" as const,ready:true,lines:[line] };
const target = `/admin/team-pay?week=${weekStart}&memberId=${memberId}`;
const bridge: Bridge = async (_actor, req) => req.action==="list" ? {enrolled:[{id:memberId,name:"Photographer & team"}],weeks:[existing]} : {week:existing};
const form = (action: string, data: Record<string,string> = {}, origin = STUDIO_ORIGIN) =>
  new Request(STUDIO_ORIGIN+"/admin/team-pay", {
    method:"POST",headers:{origin},body:new URLSearchParams({action,memberId,weekStart,expectedRevision:"3",...data}),
  });
const get = (path=target) => new Request(STUDIO_ORIGIN+path);

test("signed-out exact revision link preserves its authenticated destination without fetching pay data", async()=>{
  const r = await handleStudioPay(get(target+"&revision=3"),{readActor:async()=>null,bridge:async()=>assert.fail("no lookup on unauthenticated link"),clock});
  assert.equal(r.status,303);
  assert.equal(new URL(r.headers.get("location")!,STUDIO_ORIGIN).searchParams.get("next"),target+"&revision=3");
  assert.equal(r.headers.get("cache-control"),"private, no-store");
});

test("admin sees exact protected submission without authority to submit a forged approval",async()=>{
  const opts = {readActor:async()=>admin,bridge,clock};
  const r = await handleStudioPay(get(target+"&revision=3"),opts);
  const html = await r.text();
  assert.match(html,/Awaiting owner approval/);
  assert.match(html,/\$150\.00/);
  assert.match(html,/&lt;x&gt; Completed service/);
  assert.doesNotMatch(html,/<x>|Approve signed revision/);
  const attempt = await handleStudioPay(form("review",{confirmApproval:"yes"}),{...opts,bridge:async()=>assert.fail("read-only admin mutation reached bridge")});
  assert.equal(attempt.status,403);
});

test("owner sees stale notice and stale writer never appears successful",async()=>{
  let writes=0;
  const opts={readActor:async()=>owner,clock,writesEnabled:true,bridge: (async(a,q)=>{
    if(q.action==="review"){writes++; assert.equal(q.expectedRevision,2); throw new TeamPayBridgeError(409);}
    return bridge(a,q);
  }) as Bridge};
  const staleLink = await handleStudioPay(get(target+"&revision=2"),opts);
  const html = await staleLink.text();
  assert.match(html,/no longer current/);
  assert.doesNotMatch(html,/Approve signed revision|Completed service/);
  const stalePost = await handleStudioPay(form("review",{confirmApproval:"yes",expectedRevision:"2"}),opts);
  assert.equal(stalePost.status,409);
  assert.equal(writes,1);
  assert.doesNotMatch(await stalePost.text(),/signed revision is approved/);
});

test("owner posts confirmation only after close and only from Studio origin",async()=>{
  const writes:unknown[]=[];
  const opts={clock,readActor:async()=>owner,writesEnabled:true,bridge:(async(a,q)=>{writes.push(q); return bridge(a,q);}) as Bridge};
  const noCheck=await handleStudioPay(form("review"),opts);
  assert.equal(noCheck.status,422);
  const current=await handleStudioPay(form("review",{weekStart:"2026-11-23",confirmApproval:"yes"}),opts);
  assert.equal(current.status,422);
  const foreign=await handleStudioPay(form("review",{confirmApproval:"yes"},"https://another.heliosrealestatemedia.com"),opts);
  assert.equal(foreign.status,403);
  assert.equal(writes.length,0);
  const approved=await handleStudioPay(form("review",{confirmApproval:"yes"}),opts);
  assert.equal(approved.status,303);
  assert.match(approved.headers.get("location")!,/saved=approved/);
  assert.deepEqual(writes,[{action:"review",memberId,weekStart,expectedRevision:3,decision:"approve"}]);
});

test("owner can save a specialty review hold, not release it or attribute duplicate/future lines",async()=>{
  const writes:unknown[]=[];
  const opts={clock,readActor:async()=>owner,writesEnabled:true,bridge:(async(a,q)=>{writes.push(q); return bridge(a,q);}) as Bridge};
  const specialty={line_0_date:"2026-11-17",line_0_label:"Twilight",line_0_kind:"real_twilight",line_0_serviceRef:"123:456",line_0_amount:""};
  const release=(fields:Record<string,string>)=>handleStudioPay(form("save",{...specialty,ready:"yes",reconciled:"yes",...fields}),opts);
  assert.equal((await release({})).status,422);
  assert.equal((await release({line_0_amount:"175"})).status,422);
  assert.equal((await release({line_0_amount:"175",line_0_reason:"verified",line_0_date:"2026-11-24"})).status,422);
  const duplicate = {...specialty,line_0_amount:"175",line_0_reason:"verified",line_1_date:"2026-11-18",line_1_label:"duplicate",line_1_kind:"basic",line_1_serviceRef:"123:456",line_1_amount:"150"};
  assert.equal((await release(duplicate)).status,422);
  assert.equal(writes.length,0);
  assert.equal((await handleStudioPay(form("save",specialty),opts)).status,303);
  assert.deepEqual(writes,[{action:"save",memberId,weekStart,expectedRevision:3,lines:[{date:"2026-11-17",label:"Twilight",kind:"real_twilight",serviceRef:"123:456",cents:null}],ready:false,noWork:false,reconciled:false}]);
});

test("empty no-work release requires positive reconciliation, not an absent draft treated as $0",async()=>{
  let submitted: unknown;
  const opts={clock,readActor:async()=>owner,writesEnabled:true,bridge:(async(a,q)=>{submitted=q;return bridge(a,q);}) as Bridge};
  assert.equal((await handleStudioPay(form("save",{ready:"yes",reconciled:"yes"}),opts)).status,422);
  assert.equal((await handleStudioPay(form("save",{ready:"yes",noWork:"yes"}),opts)).status,422);
  assert.equal((await handleStudioPay(form("save",{ready:"yes",noWork:"yes",reconciled:"yes"}),opts)).status,303);
  assert.deepEqual(submitted,{action:"save",memberId,weekStart,expectedRevision:3,lines:[],ready:true,noWork:true,reconciled:true});
});

test("bridge signs and pins exact bytes without crossing cookie or provider data",async()=>{
  const secret="a".repeat(43), ts=String(Math.floor(clock().getTime()/1000));
  const fetcher:typeof fetch=async(url,init)=>{
    assert.equal(url,UPLOADER_PAY_BRIDGE);
    assert.equal(init?.credentials,"omit");
    assert.equal(init?.redirect,"error");
    const h = new Headers(init?.headers), body = String(init?.body);
    assert.equal(h.get("cookie"),null);
    assert.equal(h.get("x-helios-pay-ts"),ts);
    assert.equal(h.get("x-helios-pay-signature"),createHmac("sha256",secret).update(ts+"\n"+body).digest("hex"));
    assert.deepEqual(JSON.parse(body),{action:"get",memberId,weekStart,actorId:owner.userId,actorRole:owner.role,email:owner.email});
    return Response.json({week:existing});
  };
  const b=createStudioPayBridge({secret,clock:()=>clock().getTime(),fetcher});
  assert.deepEqual(await b(owner,{action:"get",memberId,weekStart}),{week:existing});
  await assert.rejects(()=>b(admin,{action:"review",memberId,weekStart,expectedRevision:3,decision:"approve"}),e=>e instanceof TeamPayBridgeError&&e.status===403);
});

test("recipients route rejects wrong scope and stale requests before touching the workspace roster",async()=>{
  const secret="b".repeat(43), now=clock().getTime(), ts=String(Math.floor(now/1000));
  let reads=0;
  const opts={secret,workspaceId:"private-workspace",ownerId:owner.userId,clock:()=>now,fetchRoster:async(workspace:string)=>{
    reads++;assert.equal(workspace,"private-workspace");
    return [{id:owner.userId,email:owner.email,role:owner.role},{id:admin.userId,email:admin.email,role:admin.role}];
  }};
  const req=(stamp=ts,scope=RECIPIENTS_PATH,body=RECIPIENTS_ACTION_BODY)=>{
    const sig=createHmac("sha256",secret).update(scope+"\n"+stamp+"\n"+body).digest("hex");
    return new Request(STUDIO_ORIGIN+RECIPIENTS_PATH,{method:"POST",body,headers:{"content-type":"application/json","x-helios-pay-ts":stamp,"x-helios-pay-signature":sig}});
  };
  assert.equal((await teamPayRecipients(req(ts,"/team-portal/internal/v1"),opts)).status,403);
  assert.equal((await teamPayRecipients(req(String(Number(ts)-46)),opts)).status,403);
  assert.equal((await teamPayRecipients(req(ts,RECIPIENTS_PATH,"{}"),opts)).status,403);
  assert.equal(reads,0);
  const r=await teamPayRecipients(req(),opts);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(await r.json(),{admins:[{id:owner.userId,email:owner.email,role:owner.role}]});
  const designated=await teamPayRecipients(req(),{...opts,adminIds:JSON.stringify([admin.userId])});
  assert.deepEqual(await designated.json(),{admins:[{id:owner.userId,email:owner.email,role:owner.role},{id:admin.userId,email:admin.email,role:admin.role}]});
  const wrongOwner=await teamPayRecipients(req(),{...opts,ownerId:'Other-owner'});
  assert.equal(wrongOwner.status,503);
  assert.equal(reads,3);
});

test("bridge refuses to present a merely successful HTTP status as exact approval or draft receipt", async () => {
  const b = createStudioPayBridge({secret:"a".repeat(43),env:{TEAM_PAY_WRITES_ENABLED:"true"},fetcher:async()=>Response.json({week:existing})});
  await assert.rejects(
    ()=>b(owner,{action:"review",memberId,weekStart,expectedRevision:3,decision:"approve"}),
    e=>e instanceof TeamPayBridgeError && e.status===503,
  );
  await assert.rejects(
    ()=>b(owner,{action:"save",memberId,weekStart,expectedRevision:3,lines:[line],ready:false,noWork:false,reconciled:false}),
    e=>e instanceof TeamPayBridgeError && e.status===503,
  );
  const exact = createStudioPayBridge({secret:"a".repeat(43),env:{TEAM_PAY_WRITES_ENABLED:"true"},fetcher:async()=>Response.json({week:{...existing,status:"approved"}})});
  const receipt = await exact(owner,{action:"review",memberId,weekStart,expectedRevision:3,decision:"approve"});
  assert.ok("week" in receipt && receipt.week?.status==="approved");
});

test("assignments load on explicit request and show only escaped, scoped references beside the review", async () => {
  let calls=0;
  const opts={clock,readActor:async()=>admin,bridge:(async(a,q)=>{
    if(q.action!=="sources") return bridge(a,q);
    calls++;
    assert.deepEqual(q,{action:"sources",memberId,weekStart});
    return {source:{state:"ready",visits:[{date:"2026-11-17",address:"<private property>",timeLabel:"11:30 AM",refs:["12:34","12:56"]}]}};
  }) as Bridge};
  const plain=await handleStudioPay(get(target),opts);
  assert.match(await plain.text(),/Load assignments/);
  assert.equal(calls,0);
  const r=await handleStudioPay(get(target+"&source=1&revision=3"),opts);
  const html=await r.text();
  assert.match(html,/scheduled assignments, not proof of attendance or pay/);
  assert.match(html,/&lt;private property&gt;/);
  assert.match(html,/<code>12:34<\/code>, <code>12:56<\/code>/);
  assert.doesNotMatch(html,/<private property>|Approve signed revision/);
  assert.equal(calls,1);
  const stale=await handleStudioPay(get(target+"&source=1&revision=2"),opts);
  assert.doesNotMatch(await stale.text(),/HDPhotoHub assignments/);
  assert.equal(calls,1);
});

test("source failure never presents a no-work week or prevents exact owner approval", async () => {
  const opts={clock,readActor:async()=>owner,writesEnabled:true,bridge:(async(a,q)=>{
    if(q.action==="sources") throw new TeamPayBridgeError(503);
    return bridge(a,q);
  }) as Bridge};
  const html=await (await handleStudioPay(get(target+"&source=1"),opts)).text();
  assert.match(html,/Assignments are unavailable/);
  assert.doesNotMatch(html,/No eligible work was confirmed/);
  assert.match(html,/Approve signed revision/);
});

test("source bridge fails closed on malformed visit or out-of-week response",async()=>{
  const b=createStudioPayBridge({secret:"a".repeat(43),fetcher:async()=>Response.json({
    source:{state:"ready",visits:[{date:"2026-11-24",address:"Other week",timeLabel:"3PM",refs:["12:34"]}]},
  })});
  await assert.rejects(()=>b(owner,{action:"sources",memberId,weekStart}),e=>e instanceof TeamPayBridgeError&&e.status===503);
});
