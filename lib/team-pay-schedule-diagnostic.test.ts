import assert from "node:assert/strict";
import { test } from "node:test";
import { readHubPayWeek } from "./team-pay-schedule-reader.ts";

const brandId = 7708;
const hubStaffId = 655257;
const otherStaff = 558325;
const weekStart = "2026-11-16";
const weekEnd = "2026-11-22";
const token = "00000000-0000-4000-8000-000000000099";
const privateFields = ["CANARY CLIENT", "CANARY PRIVATE TASK", "PRIVATE-POSTAL", "EXTRA-ORDER-FIELD", "PRIVATE-CARD"];

const local = (date: string, clock = "13:45:00") => date + "T" + clock;
const task = (taskId: number, staff: number | string, shoot: string | null, more: Record<string, unknown> = {}) => ({
  taskId, teamMemberId: staff, shoot, taskStatus: "undone", type: "product", product: privateFields[1],
  productId: 444, parentTaskId: null, privateCard: privateFields[4], ...more,
});
const order = (orderId: number, tasks: unknown[], more: Record<string, unknown> = {}) => ({
  orderId, brandId, status: "incomplete", created: "2026-10-03T11:00:00-06:00", siteId: 1000+orderId,
  clientId: 777, clientName: privateFields[0], unpaid: 220.5, groupName: "Private group", tags: [{name:"Private tag"}],
  location: {address:"10 Fixture Lane",address2:"Suite 5",city:"Fort Collins",region:"CO",postalCode:privateFields[2],geoCode:{lat:40.58,lng:-105.05}},
  extra: privateFields[3], tasks, ...more,
});
type Query = Record<string, unknown>;
function mock(handler: (body: Query, n: number) => Response | Promise<Response>) {
  const requests: Query[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.hd.pics/order-views/search");
    assert.equal(init?.method, "POST", "this documented search is read-only despite using POST");
    assert.equal(init?.redirect, "error", "a credential may not follow a redirect");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("hd-token"), token);
    assert.equal(headers.has("authorization"), false);
    const body = JSON.parse(String(init?.body)) as Query;
    requests.push(body);
    return handler(body, requests.length);
  };
  return { fetcher, requests };
}
const options = (fetcher: typeof fetch) => ({token,brandId,hubStaffId,weekStart,fetcher});
const answer = (data: unknown[], nextOffset?: unknown) => Response.json(nextOffset === undefined ? {data} : {data,nextOffset});
function verifyQuery(body: Query) {
  assert.deepEqual(body.users,[hubStaffId]);
  assert.match(String(body.shootDateFrom),/^2026-11-16(?:T00:00(?::00)?)?$/);
  assert.equal(body.shootDateTo,weekEnd,"the provider documents a date-only end as inclusive for all Sunday appointments");
  for(const key of ["appointmentDateFrom","appointmentDateTo","createDateFrom","createDateTo","paymentDateFrom","paymentDateTo"])
    assert.equal(Object.hasOwn(body,key),false,"no first-appointment, creation or payment filter");
  assert.ok(Number.isSafeInteger(body.quantity));
  assert.ok(Number(body.quantity)>0&&Number(body.quantity)<=100);
}

test("matches exact Austin tasks on a later visit of an older order, not the first appointment, another photographer or another brand", async () => {
  const io = mock(body => {
    verifyQuery(body);
    return answer([
      order(11,[
        task(501,otherStaff,local("2026-11-01")),
        task(508,otherStaff,local("2026-11-20")), // exact date and clock, wrong photographer
        task(502,hubStaffId,local("2026-11-20")),
        task(506,String(hubStaffId),local("2026-11-20"),{taskStatus:"done"}),
        task(503,hubStaffId,local("2026-11-15")),
        task(504,hubStaffId,local("2026-11-23")),
        task(505,hubStaffId,null),
      ]),
      order(12,[task(601,hubStaffId,local("2026-11-21"))],{brandId:brandId+1}),
      order(13,[task(701,hubStaffId,local("2026-11-15")), task(702,otherStaff,local("2026-11-21"))]),
      order(14,[task(801,hubStaffId,local(weekEnd,"23:59:00"))],{orderId:"14",brandId:String(brandId)}),
    ]);
  });
  const result = await readHubPayWeek(options(io.fetcher));
  assert.equal(io.requests.length,1);
  assert.equal(result.state,"ready");
  assert.deepEqual(result.visits.map(v=>({id:v.orderId,staff:v.staffId,date:v.date,minute:v.minute,tasks:[...v.taskIds].sort((a,b)=>a-b)})),[
    {id:11,staff:hubStaffId,date:"2026-11-20",minute:825,tasks:[502,506]},
    {id:14,staff:hubStaffId,date:weekEnd,minute:1439,tasks:[801]},
  ]);
  assert.deepEqual([...result.visits[0].anchors].sort(),["11:502","11:506"]);
  const exposed = JSON.stringify(result);
  for(const secret of [token,...privateFields]) assert.ok(!exposed.includes(secret));
  for(const hit of result.visits) {
    assert.equal(hit.city,"Fort Collins");
    assert.match(hit.address,/10 Fixture Lane/);
    assert.ok(hit.timeLabel);
    for(const forbidden of ["raw","clientId","clientName","geoCode","unpaid","brandId","product","taskStatus","created","confirmationDate"])
      assert.equal(Object.hasOwn(hit,forbidden),false);
  }
});

test("distinguishes a genuine empty week from a denied key or malformed/incomplete result", async () => {
  const good = mock(()=>answer([]));
  const forbidden = mock(()=>Response.json({error:"PRIVATE UPSTREAM DETAILS", echoedToken:token},{status:403}));
  const malformed = mock(()=>Response.json({unexpected:[]}));
  const empty = await readHubPayWeek(options(good.fetcher));
  assert.equal(empty.state,"ready");
  assert.deepEqual(empty.visits,[]);
  for(const io of [forbidden,malformed]){
    const bad = await readHubPayWeek(options(io.fetcher));
    assert.equal(bad.state,"unavailable");
    assert.deepEqual(bad.visits,[]);
    assert.doesNotMatch(JSON.stringify(bad),/PRIVATE UPSTREAM DETAILS|echoedToken/);
  }
});

test("follows a monotone pagination cursor and includes matching tasks from both pages", async () => {
  const match = (id: number, date: string) => order(id,[task(5000+id,hubStaffId,local(date))]);
  const io = mock((body,num)=>{
    verifyQuery(body);
    const quantity = Number(body.quantity);
    if(num===1) {
      const ignored = Array.from({length:quantity-1},(_,i)=>order(100+i,[task(10000+i,otherStaff,local(weekStart))]));
      return answer([match(3,weekStart),...ignored],quantity);
    }
    assert.equal(body.offset,quantity);
    return answer([match(4,weekEnd)]);
  });
  const result = await readHubPayWeek(options(io.fetcher));
  assert.equal(result.state,"ready");
  assert.equal(io.requests.length,2);
  assert.deepEqual(result.visits.map(v=>v.orderId),[3,4]);
});

test("a later page refusal or repeated cursor never exposes already-read partial visits", async () => {
  for (const kind of ["denied","loop"] as const) {
    const io = mock((body,num)=>{
      const n=Number(body.quantity);
      if(num===1) {
        const seed = order(5,[task(100,hubStaffId,local(weekStart))]);
        const ignored = Array.from({length:n-1},(_,i)=>order(100+i,[task(200+i,otherStaff,local(weekStart))]));
        return answer([seed,...ignored],n);
      }
      if(kind==="denied") return new Response(null,{status:403});
      return answer([],Number(body.offset));
    });
    const result = await readHubPayWeek(options(io.fetcher));
    assert.equal(result.state,"unavailable");
    assert.deepEqual(result.visits,[]);
    assert.equal(io.requests.length,2);
  }
});

test("conflicting copies of a stable order/task anchor do not become two payable visit candidates", async () => {
  const io=mock(()=>answer([
    order(5,[task(100,hubStaffId,local(weekStart,"09:00:00")),task(100,hubStaffId,local(weekEnd,"09:30:00"))]),
  ]));
  const result=await readHubPayWeek(options(io.fetcher));
  assert.equal(result.state,"unavailable");
  assert.deepEqual(result.visits,[]);
});

test("rejects an invalid non-Monday date before any call, rather than shifting the pay week", async () => {
  const io=mock(()=>assert.fail("invalid week must never reach the provider"));
  const result=await readHubPayWeek({...options(io.fetcher),weekStart:"2026-11-17"});
  assert.equal(result.state,"unavailable");
  assert.deepEqual(result.visits,[]);
  assert.equal(io.requests.length,0);
});

test("keeps two minutes on the same order/date separate but combines multiple tasks for the same appointment", async () => {
  const io = mock(()=>answer([order(51,[
    task(10,hubStaffId,local(weekStart,"08:15:00.000")),
    task(12,hubStaffId,local(weekStart,"08:15:00"),{type:"package"}),
    task(11,hubStaffId,local(weekStart,"16:40:00"),{taskStatus:"done"}),
    task(90,otherStaff,local(weekStart,"08:15:00")),
    task(91,0,local(weekStart,"16:40:00")),
  ])]));
  const result=await readHubPayWeek(options(io.fetcher));
  assert.equal(result.state,"ready");
  assert.deepEqual(result.visits.map(v=>[v.orderId,v.date,v.minute,[...v.taskIds].sort((a,b)=>a-b)]),[
    [51,weekStart,495,[10,12]],[51,weekStart,1000,[11]],
  ]);
});
test("an endlessly paginated search is capped and its partial data cannot release any week", async()=>{
  const io=mock((body) => {
    const offset=Number(body.offset??0), quantity=Number(body.quantity);
    return answer(Array.from({length:quantity},(_,i)=>order(100+offset+i,[task(1000+offset+i,i===0?hubStaffId:otherStaff,local(weekStart))])),offset+quantity);
  });
  const result=await readHubPayWeek(options(io.fetcher));
  assert.equal(result.state,"unavailable");
  assert.deepEqual(result.visits,[]);
  assert.ok(io.requests.length>1&&io.requests.length<=5);
});

test("a current local appointment with a missing or offset-bearing clock is not converted or treated as no work", async()=>{
  for(const malformed of [weekStart,weekStart+"T13:45:00-07:00"]){
    const io=mock(()=>answer([order(102,[task(800,hubStaffId,malformed)])]));
    const result=await readHubPayWeek(options(io.fetcher));
    assert.equal(result.state,"unavailable");
    assert.deepEqual(result.visits,[]);
  }
});


import {teamPayScheduleCapability,TARGET,EXPIRES_AT} from "./team-pay-schedule-capability.ts";
const canonical="https://www.heliosrealestatemedia.com";
const branch="team-pay-count-diagnostic-preview-20261123";
const preview="https://studio-git-diagnostic.example.test";
const diagnosticOwner={id:"cmrpuopf3000023oa12gui7th",role:"OWNER",workspaceId:"helios-default-workspace"};
const accepted=new Date("2026-11-24T00:00:00.000Z");
const config={VERCEL_ENV:"production",HDPH_V3_TOKEN:"isolated-fixture",HDPH_SUMMARY_WORKSPACE_ID:"helios-default-workspace",HDPH_SUMMARY_BRAND_ID:"7708"};
const at=()=>accepted;
const nope=()=>assert.fail("Provider/actor must not be called in this case");
const request=(origin=canonical,path=TARGET,method="GET")=>new Request(origin+path,{method});

test("the exact canonical production read checks owner, fixed week and staff, returns counts only and ignores private fields",async()=>{
 let reads=0;
 const r=await teamPayScheduleCapability(request(),{env:config,clock:at,readActor:async()=>diagnosticOwner,readWeek:async opts=>{
  reads++;
  assert.deepEqual(opts,{token:"isolated-fixture",brandId:7708,hubStaffId:655257,weekStart:"2026-11-16"});
  return {state:"ready",visits:[{orderId:51,date:"2026-11-16",minute:0,staffId:655257,taskIds:[1,2],
   anchors:["51:1","51:2"],address:"private fixture",city:"",timeLabel:"12:00 AM",timeRange:"12:00 AM"}]};
 }});
 assert.equal(reads,1);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.deepEqual(await r.json(),{state:"ready",week:{from:"2026-11-16",through:"2026-11-22"},visitCount:1,taskCount:2});
});
test("auth redirect preserves exact path; unrelated host, Preview branch, methods and query fail before read",async()=>{
 const env={...config,VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:branch};
 const signedOut=await teamPayScheduleCapability(request(preview),{env,clock:at,readActor:async()=>null,readWeek:nope});
 assert.equal(signedOut.status,303);assert.equal(signedOut.headers.get("location"),"/login?next=%2Fadmin%2Fteam-pay-schedule-check");
 for(const [req,e,status] of [
  [request("https://old-production-alias.example.test"),config,404],
  [request(preview),{...env,VERCEL_GIT_COMMIT_REF:"some-other-branch"},404],
  [request(canonical,TARGET+"?week=2027-01-04"),config,400],
  [request(canonical,TARGET,"HEAD"),config,405],
  [request(canonical,TARGET,"POST"),config,405],
 ] as const)assert.equal((await teamPayScheduleCapability(req,{env:e,clock:at,readActor:nope,readWeek:nope})).status,status);
});
test("generic Studio admin, another workspace or wrong owner cannot read even when authenticated",async()=>{
 for(const denied of [{...diagnosticOwner,role:"ADMIN"},{...diagnosticOwner,workspaceId:"different"},{...diagnosticOwner,id:"other-owner"}]){
  assert.equal((await teamPayScheduleCapability(request(),{env:config,clock:at,readActor:async()=>denied,readWeek:nope})).status,403);
 }
});
test("the endpoint is expired at the exact cutoff, and drops results when auth or upstream crosses expiry",async()=>{
 const exact=new Date(EXPIRES_AT);
 assert.equal((await teamPayScheduleCapability(request(),{env:config,clock:()=>exact,readActor:nope,readWeek:nope})).status,404);
 let clockTick=new Date(+exact-1);
 const lateAuth=await teamPayScheduleCapability(request(),{env:config,clock:()=>clockTick,readActor:async()=>{clockTick=exact;return diagnosticOwner;},readWeek:nope});
 assert.equal(lateAuth.status,404);
 clockTick=new Date(+exact-1);
 const lateHub=await teamPayScheduleCapability(request(),{env:config,clock:()=>clockTick,readActor:async()=>diagnosticOwner,
  readWeek:async()=>{clockTick=exact;return {state:"ready",visits:[]};}});
 assert.equal(lateHub.status,404);assert.deepEqual(await lateHub.json(),{state:"not_found"});
});
test("missing config or provider refusal is not a verified empty week",async()=>{
 const base={clock:at,readActor:async()=>diagnosticOwner};
 const e=await teamPayScheduleCapability(request(),{...base,env:{...config,HDPH_V3_TOKEN:undefined},readWeek:nope});
 assert.equal(e.status,503);assert.equal((await e.json()).visitCount,null);
 const fail=await teamPayScheduleCapability(request(),{...base,env:config,readWeek:async()=>({state:"unavailable",visits:[]})});
 assert.equal(fail.status,503);assert.equal((await fail.json()).taskCount,null);
 const zero=await teamPayScheduleCapability(request(),{...base,env:config,readWeek:async()=>({state:"ready",visits:[]})});
 assert.equal(zero.status,200);assert.equal((await zero.json()).visitCount,0);
});
