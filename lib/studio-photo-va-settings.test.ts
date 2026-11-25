import assert from "node:assert/strict";
import test from "node:test";
import { canManagePhotoVaContacts, readPhotoVaContactForm } from "./studio-photo-va-settings.ts";

test("a verified owner may set up their own workspace before bridge configuration", () => {
  const owner = {role:"OWNER",workspaceId:"home_studio",userId:"owner"};
  assert.equal(canManagePhotoVaContacts(owner,"home_studio"),true);
  assert.equal(canManagePhotoVaContacts(owner,"other_studio"),false);
  assert.equal(canManagePhotoVaContacts(owner,undefined),true);
  assert.equal(canManagePhotoVaContacts(owner,""),false);
  assert.equal(canManagePhotoVaContacts({...owner,workspaceId:"invalid workspace"},undefined),false);
  assert.equal(canManagePhotoVaContacts(null,"home_studio"),false);
  for (const role of ["ADMIN","EDITOR","VIEWER"]) {
    assert.equal(canManagePhotoVaContacts({...owner,role},"home_studio"),false);
  }
});

test("mail-only settings normalize one email, validate stable identity, and permit disabling with no email", () => {
  const form = new FormData();
  form.set("teamMemberId","stable_profile_id");
  form.set("intent","enable");
  form.set("email"," SAMPLE@EXAMPLE.TEST ");
  assert.deepEqual(readPhotoVaContactForm(form), {teamMemberId:"stable_profile_id",enabled:true,email:"sample@example.test"});
  form.set("email","victim@example.test,second@example.test");
  assert.equal(readPhotoVaContactForm(form),null);
  form.set("intent","disable");
  form.delete("email");
  assert.deepEqual(readPhotoVaContactForm(form), {teamMemberId:"stable_profile_id",enabled:false});
  form.set("teamMemberId","not an exact identity");
  assert.equal(readPhotoVaContactForm(form),null);
});

test("actual Studio action rejects non-owners and writes only a scoped contact", async () => {
  const module = await import("node:module");
  type Resolve = (specifier: string, context: object) => {url: string; shortCircuit?: boolean};
  type Load = (url: string, context: object) => {format: string; source?: string; shortCircuit?: boolean};
  const registerHooks = (module as unknown as {
    registerHooks(hooks: {
      resolve(specifier: string, context: object, nextResolve: Resolve): ReturnType<Resolve>;
      load(url: string, context: object, nextLoad: Load): ReturnType<Load>;
    }): {deregister(): void};
  }).registerHooks;
  const workspaceId = "home_studio", userId = "owner", teamMemberId = "stable_profile_id";
  const calls: unknown[] = [];
  const stub = {
    actor:{role:"ADMIN",workspaceId,userId},
    prisma:{
      async $transaction(callback: (tx: unknown) => Promise<unknown>, opts: unknown) {
        calls.push(opts);
        return callback({
          teamMember:{findUnique:async () => ({id:teamMemberId})},
          photoVaContact:{findUnique:async () => null,count:async () => 0,upsert:async (q:unknown) => {calls.push(q);}},
        });
      },
      photoVaContact:{
        updateMany:async (q:unknown) => {calls.push(q);return {count:1};},
      },
    },
  };
  const fakeModules = new Map([
    ["next/navigation", "export function redirect(path){throw new Error(path)}"],
    ["next/cache", "export function revalidatePath(){}"],
    ["@/lib/prisma", "export const prisma=globalThis.__studioVaStub.prisma;"],
    ["@/lib/auth/session", "export async function getAdminSession(){return globalThis.__studioVaStub.actor;}"],
  ]);
  const alias = new Map([
    ["@/lib/studio-photo-va-recipients", new URL("./studio-photo-va-recipients.ts",import.meta.url).href],
    ["@/lib/studio-photo-va-settings", new URL("./studio-photo-va-settings.ts",import.meta.url).href],
  ]);
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (alias.has(specifier)) return {url:alias.get(specifier)!,shortCircuit:true};
      if (fakeModules.has(specifier)) return {url:"mock-va:"+specifier,shortCircuit:true};
      return nextResolve(specifier,context);
    },
    load(url,context,nextLoad) {
      if (url.startsWith("mock-va:")) return {format:"module",source:fakeModules.get(url.slice(8))!,shortCircuit:true};
      return nextLoad(url,context);
    },
  });
  const globals = globalThis as typeof globalThis & {__studioVaStub?: typeof stub};
  const originalWorkspace = process.env.PHOTO_VA_WORKSPACE_ID;
  process.env.PHOTO_VA_WORKSPACE_ID = workspaceId;
  globals.__studioVaStub = stub;
  try {
    const { savePhotoVaContact } = await import("../app/admin/photo-va-contacts/actions.ts");
    const form = new FormData();
    form.set("teamMemberId",teamMemberId);
    form.set("workspaceId","untrusted_body_workspace");
    form.set("intent","enable");
    form.set("email","example@example.test");
    await assert.rejects(savePhotoVaContact(form),{message:"/admin"});
    assert.deepEqual(calls,[]);
    stub.actor.role = "OWNER";
    process.env.PHOTO_VA_WORKSPACE_ID = "other_studio";
    await assert.rejects(savePhotoVaContact(form),{message:"/admin"});
    assert.deepEqual(calls,[]);
    delete process.env.PHOTO_VA_WORKSPACE_ID;
    await assert.rejects(savePhotoVaContact(form),{message:"/admin/photo-va-contacts?status=saved"});
    const updated = {email:"example@example.test",enabled:true,updatedById:userId};
    assert.deepEqual(calls,[{isolationLevel:"Serializable"},{
      where:{workspaceId_teamMemberId:{workspaceId,teamMemberId}},
      create:{workspaceId,teamMemberId,...updated},update:updated,
    }]);
    calls.length=0;
    form.set("intent","disable");
    form.delete("email");
    await assert.rejects(savePhotoVaContact(form),{message:"/admin/photo-va-contacts?status=saved"});
    assert.deepEqual(calls,[{where:{workspaceId,teamMemberId},data:{enabled:false,updatedById:userId}}]);
  } finally {
    hooks.deregister();
    if (originalWorkspace === undefined) delete process.env.PHOTO_VA_WORKSPACE_ID;
    else process.env.PHOTO_VA_WORKSPACE_ID = originalWorkspace;
    delete globals.__studioVaStub;
  }
});
