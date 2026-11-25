import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as nodeModule from "node:module";
import test from "node:test";
import { PHOTO_VA_RECIPIENTS_PATH, studioPhotoVaRecipients } from "./studio-photo-va-recipients.ts";

const secret = "S".repeat(44);
const workspaceId = "studio_workspace";
const now = 1795520000000;
const fixture = { id: "va_active", displayName: " Sample VA ", email: " sample@example.test " };
const calls: unknown[] = [];
function request(raw: string | object, { offset = 0, key = secret, route = PHOTO_VA_RECIPIENTS_PATH, method = "POST", type = "application/json", body = undefined as string | undefined } = {}) {
  const input = typeof raw === "string" ? raw : JSON.stringify(raw);
  const time = String(now / 1000 + offset);
  const signed = createHmac("sha256", key).update(PHOTO_VA_RECIPIENTS_PATH + "\n" + time + "\n" + input).digest("hex");
  return new Request("https://studio.example.test" + route, {
    method, body: method === "POST" ? body ?? input : null,
    headers: { "content-type": type, "x-helios-va-ts": time, "x-helios-va-signature": signed },
  });
}

const options = {
  secret, workspaceId, clock: () => now,
  async listUsers(workspace: string) {
    calls.push(["list", workspace]);
    return [fixture];
  },
  async resolveUser(workspace: string, id: string) {
    calls.push(["resolve", workspace, id]);
    return id === fixture.id ? fixture : null;
  },
};

test("signed list passes scope to storage and returns only id and name", async () => {
  calls.length = 0;
  const result = await studioPhotoVaRecipients(request({ action: "list" }, { offset: -45 }), options);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await result.json(), { recipients: [{ id: "va_active", name: "Sample VA" }] });
  assert.deepEqual(calls, [["list", workspaceId]]);
});

test("signed resolution returns one exact active recipient and fails closed for inactive or unconfigured IDs", async () => {
  calls.length = 0;
  const check = (id: string) => studioPhotoVaRecipients(request({ action: "resolve", id }), options);
  assert.deepEqual(await (await check("va_active")).json(), { recipient: { id: "va_active", name: "Sample VA", email: "sample@example.test" } });
  assert.deepEqual(await (await check("va_inactive")).json(), { recipient: null });
  assert.deepEqual(await (await check("other_studio_user")).json(), { recipient: null });
  assert.deepEqual(calls, [["resolve", workspaceId, "va_active"], ["resolve", workspaceId, "va_inactive"], ["resolve", workspaceId, "other_studio_user"]]);
});

test("rejects unsigned, stale, future, wrong scope, wrong method, modified, oversized and injected requests before storage", async () => {
  calls.length = 0;
  const list = { action: "list" };
  for (const bad of [
    new Request("https://studio.example.test" + PHOTO_VA_RECIPIENTS_PATH, {method:"POST",body:JSON.stringify(list),headers:{"content-type":"application/json"}}),
    request(list, { key: "other secret" }),
    request(list, { offset: -46 }),
    request(list, { offset: 46 }),
    request(list, { method: "GET" }),
    request(list, { type: "text/plain" }),
    request(list, { route: "/api/internal/team-pay-recipients" }),
    request(list, { body: '{"action":"resolve","id":"va_active"}' }),
    request(" ".repeat(257)),
    request({ action: "list", workspaceId: "other_workspace" }),
    request({ action: "resolve", id: "va_active", email: "untrusted@example.test" }),
  ]) {
    const result = await studioPhotoVaRecipients(bad, options);
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), {code:"forbidden"});
  }
  assert.deepEqual(calls, []);
});

test("fails closed for missing workspace, mismatched storage, and database outage", async () => {
  const invalidWorkspace = await studioPhotoVaRecipients(request({action:"list"}), {...options, workspaceId:""});
  assert.equal(invalidWorkspace.status, 403);
  const mismatch = await studioPhotoVaRecipients(request({action:"resolve",id:"va_active"}), {
    ...options, resolveUser: async () => ({...fixture,id:"wrong_id"}),
  });
  assert.deepEqual(await mismatch.json(), {recipient:null});
  const failed = await studioPhotoVaRecipients(request({action:"list"}), {
    ...options, listUsers: async () => { throw Error("Internal detail not for caller."); },
  });
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), {code:"directory_unavailable"});
});

test("actual Next route entry scopes both Prisma queries and does not select email for dropdown", async (t) => {
  let whereList: unknown, whereResolve: unknown;
  const directory = {
    photoVaContact: {
      async findMany(query: unknown) { whereList = query; return [{teamMember:{id:fixture.id,name:fixture.displayName}}]; },
      async findFirst(query: unknown) { whereResolve = query; return {teamMember:{id:fixture.id,name:fixture.displayName},email:fixture.email}; },
    },
  };
  t.mock.method(Date, "now", () => now);
  const fixtureEnv = { PHOTO_VA_BRIDGE_SECRET: secret, PHOTO_VA_WORKSPACE_ID: workspaceId };
  const originalEnv = Object.fromEntries(Object.keys(fixtureEnv).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixtureEnv);
  const prismaUrl = "data:text/javascript,export const prisma=undefined";
  // Node 24 supports synchronous loader hooks; Studio's @types/node 20 does not declare them.
  type Resolve = (specifier: string, context: object) => {url: string; shortCircuit?: boolean};
  type Load = (url: string, context: object) => {format: string; source?: string; shortCircuit?: boolean};
  const registerHooks = (nodeModule as unknown as {
    registerHooks(hooks: {
      resolve(specifier: string, context: object, nextResolve: Resolve): ReturnType<Resolve>;
      load(url: string, context: object, nextLoad: Load): ReturnType<Load>;
    }): {deregister(): void};
  }).registerHooks;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/prisma") return { url: prismaUrl, shortCircuit: true };
      if (specifier === "@/lib/studio-photo-va-recipients") return { url: new URL("./studio-photo-va-recipients.ts", import.meta.url).href, shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === prismaUrl) return { format:"module", source:"export const prisma=globalThis.__photoVaPrismaFixture;", shortCircuit:true };
      return nextLoad(url,context);
    },
  });
  const globals = globalThis as typeof globalThis & {__photoVaPrismaFixture?: typeof directory};
  globals.__photoVaPrismaFixture = directory;
  try {
    const { POST } = await import("../app/api/internal/photo-va-recipients/route.ts");
    const list = await POST(request({action:"list"}));
    assert.deepEqual(await list.json(), {recipients:[{id:"va_active",name:"Sample VA"}]});
    assert.deepEqual(whereList, {
      where:{workspaceId,enabled:true},
      select:{teamMember:{select:{id:true,name:true}}},
      orderBy:[{teamMember:{name:"asc"}},{teamMemberId:"asc"}],
      take:21,
    });
    const resolve = await POST(request({action:"resolve",id:"va_active"}));
    assert.deepEqual(await resolve.json(), {recipient:{id:"va_active",name:"Sample VA",email:"sample@example.test"}});
    assert.deepEqual(whereResolve, {
      where:{workspaceId,enabled:true,teamMemberId:"va_active"},
      select:{teamMember:{select:{id:true,name:true}},email:true},
    });
  } finally {
    hooks.deregister();
    delete globals.__photoVaPrismaFixture;
    for (const [key,value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
