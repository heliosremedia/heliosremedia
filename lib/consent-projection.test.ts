import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { normalizeEmail } from "./client-communications/normalization.ts";
const date = new Date("2026-01-01T00:00:00Z");
function fixture(input: { enabled?: boolean; workspaces?: string[]; company?: string; legacy?: string; safety?: boolean; contact?: boolean }) {
  const exports = {}, modules: Record<string, unknown> = { "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => input.enabled ?? true }, "./normalization": { normalizeEmail }, "./delivery-consent": { eligibleMarketingAddresses: async (_db: unknown, id: string) => { assert.equal(id,"a"); return new Set(["same@example.test"]); } } };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./client-communications/consent-projection.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Date,Map,Set,require:(id:string)=>{assert.ok(id in modules,id);return modules[id];}});
  const api=exports as typeof import("./client-communications/consent-projection");
  const tx={ workspace:{findMany:async()=> (input.workspaces??["a","b"]).map(id=>({id}))},
    workspaceMarketingPreference:{findMany:async({where}:{where:{workspaceId:string}})=>{assert.equal(where.workspaceId,"a");return input.company?[{normalizedEmail:"same@example.test",status:input.company,source:"OWN_COMPANY",effectiveAt:date}]:[];}},
    marketingEmailPreference:{findMany:async()=>input.legacy?[{normalizedEmail:"same@example.test",status:input.legacy,source:"PRIVATE_GLOBAL_SOURCE",effectiveAt:date}]:[]},
    communicationSuppression:{findMany:async()=>input.safety?[{normalizedEmail:"same@example.test"}]:[]},
  };
  const db={$transaction:async(fn:(t:unknown)=>Promise<unknown>,options:{isolationLevel:string})=>{assert.equal(options.isolationLevel,"RepeatableRead");return fn(tx);}} as unknown as Parameters<typeof api.readClientConsentProjection>[0];
  return {api,db,clients:[{id:"owned",normalizedEmail:" SAME@EXAMPLE.TEST ",emailSubscribed:input.contact??true}]};
}
for(const company of ["SUBSCRIBED","UNSUBSCRIBED","PENDING_CONFIRMATION"])test(`directory displays its own ${company} preference`,async()=>{
  const {api,db,clients}=fixture({company,legacy:"SUBSCRIBED"});const [row]=await api.readClientConsentProjection(db,"a",clients);assert.equal(row.emailStatus,company);assert.equal(row.emailStatusSource,"OWN_COMPANY");assert.equal(row.emailStatusEffectiveAt,date.toISOString());
});
for(const legacy of ["UNSUBSCRIBED","SUPPRESSED"])test(`protected ${legacy} reveals neither global source nor timestamp`,async()=>{
  const {api,db,clients}=fixture({company:"SUBSCRIBED",legacy});const [row]=await api.readClientConsentProjection(db,"a",clients);assert.equal(row.emailStatus,"SUPPRESSED");assert.equal(row.emailStatusSource,null);assert.equal(row.emailStatusEffectiveAt,null);
});
test("safety and conservative contact blocks hide provenance",async()=>{
  for(const extra of [{safety:true},{contact:false}]){const {api,db,clients}=fixture({company:"SUBSCRIBED",...extra});const [row]=await api.readClientConsentProjection(db,"a",clients);assert.equal(row.emailStatus,"SUPPRESSED");assert.equal(row.emailStatusSource,null);assert.equal(row.emailStatusEffectiveAt,null);}
});
test("global subscription is not displayed as company consent with either tenant flag in multitenant mode",async()=>{
  for(const enabled of [true,false]){const {api,db,clients}=fixture({enabled,legacy:"SUBSCRIBED"});const [row]=await api.readClientConsentProjection(db,"a",clients);assert.equal(row.emailStatus,"UNKNOWN");assert.equal(row.emailStatusSource,null);}
});
test("sole-company legacy compatibility retains existing provenance until company preference exists",async()=>{
  const {api,db,clients}=fixture({enabled:false,workspaces:["a"],legacy:"SUBSCRIBED"});const [row]=await api.readClientConsentProjection(db,"a",clients);assert.equal(row.emailStatus,"SUBSCRIBED");assert.equal(row.emailStatusSource,"PRIVATE_GLOBAL_SOURCE");
});
test("missing workspace cannot fall back to a global projection",async()=>{const {api,clients}=fixture({});await assert.rejects(api.readClientConsentProjection({} as never,"",clients),/CONSENT_WORKSPACE_REQUIRED/);});
