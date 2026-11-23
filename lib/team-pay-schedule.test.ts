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

import { teamPayScheduleCapability } from "./team-pay-schedule-capability.ts";
const capabilityPath="https://preview.example/admin/team-pay-schedule-check";
const previewEnv={
  VERCEL_ENV:"preview",
  VERCEL_GIT_COMMIT_REF:"team-pay-schedule-bridge-preview-20261123",
  HDPH_SUMMARY_BRAND_ID:String(brandId),
  HDPH_SUMMARY_WORKSPACE_ID:"helios-default-workspace",
  HDPH_V3_TOKEN:token,
};
const owner={id:"cmrpuopf3000023oa12gui7th",role:"OWNER",workspaceId:"helios-default-workspace"};
const verifiedVisits=[
  {orderId:11,date:"2026-11-20",minute:825,staffId:hubStaffId,taskIds:[502,506],anchors:["11:502","11:506"],address:"10 Private Home",city:"Fort Collins",timeLabel:"1:45 PM",timeRange:"1:45 PM"},
  {orderId:51,date:weekEnd,minute:495,staffId:hubStaffId,taskIds:[12],anchors:["51:12"],address:"11 Private Home",city:"Fort Collins",timeLabel:"8:15 AM",timeRange:"8:15 AM"},
];

test("the authorized exact-preview capability is fixed to one cohort and emits only counts and public boundaries", async () => {
  let reads=0;
  const response=await teamPayScheduleCapability(new Request(capabilityPath),{
    env:previewEnv,readActor:async()=>owner,
    readWeek:async request=>{
      reads++;
      assert.equal(request.token,token);
      assert.equal(request.brandId,brandId);
      assert.equal(request.hubStaffId,hubStaffId);
      assert.equal(request.weekStart,weekStart);
      return {state:"ready",visits:verifiedVisits};
    },
  });
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control")??"",/no-store/i);
  assert.equal(reads,1);
  const body=await response.text();
  assert.deepEqual(JSON.parse(body),{state:"ready",week:{from:weekStart,through:weekEnd},visitCount:2,taskCount:3});
  assert.doesNotMatch(body,/Private Home|655257|11:502|00000000-0000-4000-8000/);
});

test("the preview gate rejects unauthorized role/scope, changed query and non-GET before any provider read", async () => {
  const checks=[
    {request:new Request(capabilityPath),env:{...previewEnv,VERCEL_ENV:"production"},actor:owner},
    {request:new Request(capabilityPath),env:{...previewEnv,VERCEL_GIT_COMMIT_REF:"some-other-preview"},actor:owner},
    {request:new Request(capabilityPath+"?userId="+otherStaff),env:previewEnv,actor:owner},
    {request:new Request(capabilityPath,{method:"POST"}),env:previewEnv,actor:owner},
    {request:new Request(capabilityPath),env:previewEnv,actor:null},
    {request:new Request(capabilityPath),env:previewEnv,actor:{...owner,id:"other-owner"}},
    {request:new Request(capabilityPath),env:previewEnv,actor:{...owner,role:"ADMIN"}},
    {request:new Request(capabilityPath),env:previewEnv,actor:{...owner,workspaceId:"wrong-workspace"}},
  ];
  for(const c of checks) {
    let reads=0;
    const res=await teamPayScheduleCapability(c.request,{
      env:c.env,readActor:async()=>c.actor,
      readWeek:async()=>{reads++;return {state:"ready",visits:verifiedVisits};},
    });
    assert.equal(reads,0);
    assert.ok(res.status>=300&&res.status<500,"owner-scoped preview checks never return successful counts for bad inputs");
    assert.doesNotMatch(await res.text(),/visitCount|taskCount|Private Home|655257/);
  }
});

test("the capability never reports an unavailable provider as an empty verified week", async () => {
  const request=new Request(capabilityPath);
  const common={env:previewEnv,readActor:async()=>owner};
  const denied=await teamPayScheduleCapability(request,{
    ...common,readWeek:async()=>({state:"unavailable",visits:[]}),
  });
  const good=await teamPayScheduleCapability(request,{
    ...common,readWeek:async()=>({state:"ready",visits:[]}),
  });
  assert.deepEqual(await good.json(),{state:"ready",week:{from:weekStart,through:weekEnd},visitCount:0,taskCount:0});
  const bad=await denied.json();
  assert.equal(bad.state,"source_unavailable");
  assert.notEqual(bad.visitCount,0);
  assert.notEqual(bad.taskCount,0);
  assert.doesNotMatch(JSON.stringify(bad),/Private Home|655257|00000000-0000-4000-8000/);
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

import { createHmac } from "node:crypto";
import { studioTeamPaySchedule, STUDIO_TEAM_PAY_SCHEDULE_PATH } from "./team-pay-schedule-service.ts";
const fixtureMember = "01234567-aaaa-bbbb-cccc-0123456789ab";
const unrelatedMember = "01234567-aaaa-bbbb-cccc-0123456789ac";
const serviceSecret = "test-bridge-secret-fixtures-only-HnBeFX9tC9Qff0SL2PJ4";
const serviceClock = new Date("2026-11-23T16:10:00Z");
const serviceEnv={
  ...previewEnv,
  TEAM_PAY_STUDIO_SCHED_ENABLED:"true",
  TEAM_PAY_BRIDGE_SECRET:serviceSecret,
  TEAM_PAY_WORKSPACE_ID:"helios-default-workspace",
  PORTAL_TEAM_HDPH_TIME_ZONE:"America/Denver",
  PORTAL_TEAM_HDPH_STAFF_MAP:JSON.stringify({[fixtureMember]:hubStaffId}),
};
const serviceBody=JSON.stringify({action:"team-pay-schedule",memberId:fixtureMember,weekStart});
function signedRequest({path=STUDIO_TEAM_PAY_SCHEDULE_PATH,signPath=STUDIO_TEAM_PAY_SCHEDULE_PATH,body=serviceBody,
  signedBody=body,stamp=String(Math.floor(+serviceClock/1000)),secret=serviceSecret}:{
    path?:string;signPath?:string;body?:string;signedBody?:string;stamp?:string;secret?:string;
  }={}){
  const signature=createHmac("sha256",secret).update(signPath+"\n"+stamp+"\n"+signedBody).digest("hex");
  return new Request("https://studio.example"+path,{method:"POST",body,headers:{
    "Content-Type":"application/json",
    "x-helios-pay-ts":stamp,"x-helios-pay-signature":signature,
  }});
}

test("the signed service authenticates transcripts and resolves the exact Studio-side member mapping", async()=>{
  let pending=0;
  const res=await studioTeamPaySchedule(signedRequest(),{
    env:serviceEnv,clock:()=>serviceClock,
    readWeek:async req=>{
      pending++;
      assert.equal(req.token,token);
      assert.equal(req.brandId,brandId);
      assert.equal(req.hubStaffId,hubStaffId);
      assert.equal(req.weekStart,weekStart);
      return {state:"ready",visits:verifiedVisits};
    },
  });
  assert.equal(res.status,200);
  assert.equal(pending,1);
  assert.match(res.headers.get("cache-control")??"",/no-store/i);
  const body=await res.text();
  assert.deepEqual(JSON.parse(body),{state:"ready",week:{from:weekStart,through:weekEnd},visits:verifiedVisits});
  assert.ok(!body.includes(token)&&!body.includes(serviceSecret));
});

test("disabled, modified, expired, wrong-purpose or out-of-scope service calls never touch the provider",async()=>{
  const invalidCases=[
    {options:{},env:{...serviceEnv,TEAM_PAY_STUDIO_SCHED_ENABLED:"false"},status:404},
    {options:{secret:serviceSecret+"wrong"},env:serviceEnv,status:403},
    {options:{signPath:"/api/internal/team-pay-recipients"},env:serviceEnv,status:403},
    {options:{path:STUDIO_TEAM_PAY_SCHEDULE_PATH+"?memberId="+unrelatedMember},env:serviceEnv,status:403},
    {options:{stamp:String(Math.floor(+serviceClock/1000)-46)},env:serviceEnv,status:403},
    {options:{body:serviceBody.replace(fixtureMember,unrelatedMember),signedBody:serviceBody},env:serviceEnv,status:403},
    {options:{body:serviceBody.replace(fixtureMember,unrelatedMember)},env:serviceEnv,status:403},
    {options:{body:JSON.stringify({...JSON.parse(serviceBody),hubStaffId:otherStaff})},env:serviceEnv,status:403},
    {options:{body:JSON.stringify({...JSON.parse(serviceBody),action:"a".repeat(700)})},env:serviceEnv,status:403},
    {options:{body:serviceBody.replace(weekStart,"2026-11-30")},env:serviceEnv,status:400},
    {options:{body:serviceBody.replace(weekStart,"2026-04-27")},env:serviceEnv,status:400},
    {options:{},env:{...serviceEnv,PORTAL_TEAM_HDPH_STAFF_MAP:JSON.stringify({[fixtureMember]:hubStaffId,[unrelatedMember]:hubStaffId})},status:403},
    {options:{},env:{...serviceEnv,HDPH_SUMMARY_WORKSPACE_ID:"wrong"},status:503},
  ];
  for(const c of invalidCases){
    let pending=0;
    const res=await studioTeamPaySchedule(signedRequest(c.options),{
      env:c.env,clock:()=>serviceClock,
      readWeek:async()=>{pending++;return {state:"ready",visits:verifiedVisits};},
    });
    assert.equal(res.status,c.status);
    assert.equal(pending,0);
    assert.doesNotMatch(await res.text(),/Private Home|655257|test-bridge-secret|00000000-0000-4000-8000/);
  }
});
