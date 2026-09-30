import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const root = process.argv[2];
if (!root?.endsWith('/')) throw new Error('Pass the reviewed checkout root with trailing slash; synthetic adapters only.');
const clients=[{id:'a-client',workspaceId:'a',normalizedEmail:'shared@example.test',emailSubscribed:true},{id:'b-client',workspaceId:'b',normalizedEmail:'shared@example.test',emailSubscribed:true}];
let preference; const memberships=[]; let history=0;
const prisma={marketingEmailPreference:{findUnique:async()=>preference,upsert:async({create,update})=>(preference={id:'pref',...(preference?update:create)})},marketingEmailPreferenceEvent:{create:async()=>{history++}},communicationClient:{findMany:async({where})=>clients.filter(c=>c.normalizedEmail===where.normalizedEmail),updateMany:async({where,data})=>clients.filter(c=>c.normalizedEmail===where.normalizedEmail).forEach(c=>Object.assign(c,data))},communicationGroup:{upsert:async()=>({id:'global-unsubscribed'})},communicationGroupMembership:{createMany:async({data})=>memberships.push(...data)}};
prisma.$transaction=async f=>f(prisma);
function load(path,modules){const exports={};runInNewContext(ts.transpileModule(readFileSync(root+path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:id=>{assert.ok(id in modules,id);return modules[id]}});return exports}
const prefs=load('lib/client-communications/preferences.ts',{'server-only':{},'node:crypto':{},'@/lib/prisma':{prisma},'./normalization':{normalizeEmail:s=>s.trim().toLowerCase()},'./preference-rules':{}});
await prefs.setMarketingPreference({email:'shared@example.test',status:'UNSUBSCRIBED',source:'SYNTHETIC_COMPANY_A'});
assert.equal(clients[1].emailSubscribed,false);assert.ok(memberships.some(m=>m.clientId==='b-client'));
let target;
const route=load('app/api/admin/clients/preferences/route.ts',{'next/cache':{revalidatePath(){}},'next/server':{NextResponse:Response},'@/lib/auth/session':{getAdminSession:async()=>({role:'ADMIN',workspaceId:'a',userId:'a-admin'})},'@/lib/prisma':{prisma:{communicationClient:{findUnique:async({where})=>where.id==='b-client'?{id:'b-client',displayName:'Synthetic B',email:'b@example.test'}:null}}},'@/lib/client-communications/preferences':{setMarketingPreference:async input=>{target=input.email;return{status:input.status}}},'@/lib/audit':{recordAuditEvent:async()=>{}}});
const response=await route.POST(new Request('https://synthetic.test',{method:'POST',body:JSON.stringify({clientId:'b-client',action:'unsubscribe'})}));
assert.equal(response.status,200);assert.equal(target,'b@example.test');
console.log(JSON.stringify({syntheticOnly:true,providerCalls:false,sharedEmail:{companyBSubscriptionChanged:true,companyBAddedToGlobalGroup:true,historyWrites:history},foreignClientAdminRoute:{actorWorkspace:'a',targetWorkspace:'b',status:response.status,preferenceMutationReached:true}},null,2));
