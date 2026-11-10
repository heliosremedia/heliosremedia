/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as core from "./core.ts";
import * as themes from "./themes.ts";
import * as guestCounts from "./guest-counts.ts";

function fixture() {
  const token = core.newToken();
  const event = {id:"event",workspaceId:"private-workspace",title:"Holiday party",description:"Join us",location:"Studio",startsAt:new Date(Date.now()+86400000),endsAt:null,timeZone:"America/Denver",status:"SCHEDULED",templateKey:"CHRISTMAS",imageUrl:null,imageAlt:null,venueUrl:null};
  const invitation: any = {id:"invitation",eventId:event.id,event,clientId:"private-client",email:"private@example.com",displayName:"Private client",tokenHash:core.tokenHash(token),encryptedToken:"private-encrypted-token",response:"PENDING",additionalGuests:0,respondedAt:null};
  const calls: any[] = [];
  let beforeTransaction: (() => void) | null = null;
  let missingInsideTransaction = false;
  let failWrite = false;
  let queue = Promise.resolve();
  const active = (where: any) => event.id === where.id && event.status === where.status && event.startsAt > where.startsAt.gt;
  const tx = {
    eventInvitationEvent: {updateMany: async ({where,data}: any) => {
      calls.push({method:"lock",where,data});
      return {count: active(where) ? 1 : 0};
    }},
    eventInvitation: {
      findUnique: async ({where,select}: any) => {
        calls.push({method:"readCurrent",where,select});
        assert.equal(where.id, invitation.id);
        return missingInsideTransaction ? null : {additionalGuests:invitation.additionalGuests};
      },
      update: async ({where,data,select}: any) => {
        calls.push({method:"save",where,data,select});
        assert.equal(where.id, invitation.id);
        if (failWrite) throw new Error("Temporary database failure");
        Object.assign(invitation,data);
        return {response:invitation.response,additionalGuests:invitation.additionalGuests};
      },
    },
  };
  const prisma = {
    eventInvitation: {findFirst: async ({where}: any) => {
      calls.push({method:"resolve",where});
      if (where.tokenHash !== invitation.tokenHash || event.status !== where.event.status || event.startsAt <= where.event.startsAt.gt) return null;
      return {...invitation,event:{...event}};
    }},
    $transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => {
      // Model serialized event-row locks so concurrent requests cannot read
      // the same stale guest count after acquiring their lock.
      const run = queue.then(async () => {
        const hook = beforeTransaction;
        beforeTransaction = null;
        hook?.();
        return callback(tx);
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  const mocks: Record<string, any> = {
    "next/server": {NextResponse:{json:(body:unknown,options:ResponseInit={})=>Response.json(body,options)}},
    "@/lib/prisma": {prisma},
    "@/lib/events/core": core,
    "@/lib/events/themes": themes,
    "@/lib/events/guest-counts": guestCounts,
  };
  const exports: Record<string, (request: Request) => Promise<Response>> = {};
  const code = ts.transpileModule(readFileSync(new URL("../../app/api/events/rsvp/route.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:(id:string)=>{
    if (!(id in mocks)) throw new Error(`Unexpected dependency ${id}`);
    return mocks[id];
  },process:{env:{}},Date});
  const url = "https://studio.example.com/api/events/rsvp";
  return {
    token,event,invitation,calls,
    beforeTransaction(hook: () => void) { beforeTransaction = hook; },
    removeInvitationInsideTransaction() { missingInsideTransaction = true; },
    failWrite() { failWrite = true; },
    get: (headers: HeadersInit = {authorization:`Bearer ${token}`}, suffix = "") => exports.GET(new Request(url+suffix,{headers})),
    post: (input: unknown) => exports.POST(new Request(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)})),
    rawPost: (body: string) => exports.POST(new Request(url,{method:"POST",body})),
  };
}

function assertPrivate(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}

test("GET returns the saved guest count without writing or exposing client/token data", async () => {
  const f = fixture();
  f.invitation.response = "YES";
  f.invitation.additionalGuests = 3;
  const response = await f.get();
  assert.equal(response.status,200);
  assertPrivate(response);
  const body = await response.json();
  assert.equal(body.response,"YES");
  assert.equal(body.additionalGuests,3);
  assert.deepEqual(Object.keys(body).sort(),["additionalGuests","event","response","success"]);
  assert.doesNotMatch(JSON.stringify(body),/private-|tokenHash|encryptedToken|clientId|workspaceId/);
  assert.deepEqual(f.calls.map(call=>call.method),["resolve"]);
  delete f.invitation.additionalGuests;
  assert.equal((await (await f.get()).json()).additionalGuests,0);
});

test("GET authenticates only the bearer header, never a query token", async () => {
  const f = fixture();
  for (const [headers,suffix] of [[{},`?token=${f.token}`],[{authorization:"Bearer invalid"},""],[{authorization:`Bearer ${core.newToken()}`},""]] as const) {
    const response = await f.get(headers,suffix);
    assert.equal(response.status,404);
    assertPrivate(response);
  }
  assert.equal((await f.get({authorization:`bearer ${f.token}`})).status,200);
  assert.equal(f.invitation.response,"PENDING");
});

test("POST persists zero, one and multiple guests, and GET restores the saved party", async () => {
  const f = fixture();
  for (const answer of ["YES","MAYBE"]) {
    for (const additionalGuests of [0,1,3,99]) {
      const response = await f.post({token:f.token,response:answer,additionalGuests,email:"ignored@example.com",eventId:"other-event"});
      assert.equal(response.status,200);
      assertPrivate(response);
      const body = await response.json();
      assert.equal(body.response,answer);
      assert.equal(body.additionalGuests,additionalGuests);
      assert.equal(f.invitation.additionalGuests,additionalGuests);
      assert.equal(f.invitation.email,"private@example.com");
      assert.equal(f.invitation.eventId,"event");
      assert(f.invitation.respondedAt instanceof Date);
      assert.equal((await (await f.get()).json()).additionalGuests,additionalGuests);
    }
  }
  const writes = f.calls.filter(call=>call.method==="save");
  assert.equal(writes.length,8);
  for (const write of writes) assert.deepEqual(Object.keys(write.data).sort(),["additionalGuests","respondedAt","response"]);
});

test("No clears guests and a later old-client Yes does not restore the cancelled party", async () => {
  const f = fixture();
  f.invitation.additionalGuests = 5;
  f.invitation.response = "YES";
  const response = await f.post({token:f.token,response:"NO",additionalGuests:9});
  assert.equal(response.status,200);
  assert.equal((await response.json()).additionalGuests,0);
  assert.equal(f.invitation.additionalGuests,0);
  await f.post({token:f.token,response:"YES"});
  assert.equal(f.invitation.additionalGuests,0);
});

test("legacy omitted counts preserve Yes/Maybe guest counts but explicit zero clears them", async () => {
  const f = fixture();
  assert.equal((await (await f.post({token:f.token,response:"YES"})).json()).additionalGuests,0);
  f.invitation.additionalGuests = 4;
  for (const answer of ["MAYBE","YES"]) {
    const body = await (await f.post({token:f.token,response:answer})).json();
    assert.equal(body.additionalGuests,4);
    assert.equal(f.invitation.additionalGuests,4);
  }
  await f.post({token:f.token,response:"YES",additionalGuests:0});
  assert.equal(f.invitation.additionalGuests,0);
  f.invitation.additionalGuests = 4;
  await f.post({token:f.token,response:"NO"});
  assert.equal(f.invitation.additionalGuests,0);
});

test("an old cached client re-reads the latest count after the event lock, not token resolution", async () => {
  const f = fixture();
  f.invitation.additionalGuests = 1;
  f.beforeTransaction(()=>{ f.invitation.additionalGuests = 7; });
  const response = await f.post({token:f.token,response:"MAYBE"});
  assert.equal((await response.json()).additionalGuests,7);
  assert.deepEqual(f.calls.map(call=>call.method),["resolve","lock","readCurrent","save"]);
});

test("concurrent new and legacy clients preserve the latest committed guest count", async () => {
  const f = fixture();
  const [first,second] = await Promise.all([
    f.post({token:f.token,response:"YES",additionalGuests:6}),
    f.post({token:f.token,response:"MAYBE"}),
  ]);
  assert.equal((await first.json()).additionalGuests,6);
  assert.equal((await second.json()).additionalGuests,6);
  assert.equal(f.invitation.additionalGuests,6);
  assert.equal(f.invitation.response,"MAYBE");
});

test("malformed guest counts return 400 with no lookup or write for every response", async () => {
  for (const answer of ["YES","NO","MAYBE"]) {
    for (const additionalGuests of [-1,1.5,100,"2","",null,true,false,[],{},Number.MAX_SAFE_INTEGER]) {
      const f = fixture();
      const response = await f.post({token:f.token,response:answer,additionalGuests});
      assert.equal(response.status,400,`${answer}: ${JSON.stringify(additionalGuests)}`);
      assertPrivate(response);
      assert.match((await response.json()).error,/whole number/);
      assert.equal(f.calls.length,0);
    }
  }
});

test("malformed bodies and invalid responses cannot write an RSVP", async () => {
  const f = fixture();
  for (const body of [null,[],"YES",42,{}, {token:f.token,response:"PENDING"},{token:f.token,response:["YES"]}]) {
    const response = await f.post(body);
    assert.equal(response.status,400);
    assertPrivate(response);
  }
  const response = await f.rawPost('{"response":');
  assert.equal(response.status,400);
  assertPrivate(response);
  assert.equal(f.calls.length,0);
});

test("invalid tokens, cancelled events and expired events cannot read or write guests", async () => {
  for (const change of ["invalid","unknown","cancelled","expired"]) {
    const f = fixture();
    if (change==="cancelled") f.event.status="CANCELLED";
    if (change==="expired") f.event.startsAt=new Date(0);
    const token = change==="invalid" ? "bad" : change==="unknown" ? core.newToken() : f.token;
    for (const response of [await f.get({authorization:`Bearer ${token}`}),await f.post({token,response:"YES",additionalGuests:2})]) {
      assert.equal(response.status,404,change);
      assertPrivate(response);
    }
    assert.equal(f.calls.some(call=>call.method==="save"),false);
  }
});

test("cancellation or expiry between lookup and lock returns 410 without saving guests", async () => {
  for (const change of ["cancelled","expired"]) {
    const f = fixture();
    f.beforeTransaction(()=>{
      if (change==="cancelled") f.event.status="CANCELLED";
      else f.event.startsAt=new Date(0);
    });
    const response = await f.post({token:f.token,response:"YES",additionalGuests:2});
    assert.equal(response.status,410,change);
    assertPrivate(response);
    assert.deepEqual(f.calls.map(call=>call.method),["resolve","lock"]);
    assert.equal(f.invitation.response,"PENDING");
    assert.equal(f.invitation.additionalGuests,0);
  }
});

test("a removed invitation and failed write never return a false successful guest count", async () => {
  const missing = fixture();
  missing.removeInvitationInsideTransaction();
  const response = await missing.post({token:missing.token,response:"YES",additionalGuests:2});
  assert.equal(response.status,410);
  assertPrivate(response);
  assert.equal(missing.calls.some(call=>call.method==="save"),false);
  const failing = fixture();
  failing.failWrite();
  const failure = await failing.post({token:failing.token,response:"YES",additionalGuests:2});
  assert.equal(failure.status,400);
  assertPrivate(failure);
  assert.equal((await failure.json()).success,false);
  assert.equal(failing.invitation.additionalGuests,0);
});
