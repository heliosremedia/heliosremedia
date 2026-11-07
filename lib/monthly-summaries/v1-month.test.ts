import test from "node:test";
import assert from "node:assert/strict";
import { prepareV1Month } from "./v1-month.ts";
import type { checkExistingConnection } from "./v1-check.ts";
const clients = [1,2,3].map(id => ({ id: `local-${id}`, hdPhotoHubUserId:id, displayName:`Example ${id}`, normalizedEmail:`example${id}@example.test` }));
const reader: typeof checkExistingConnection = async input => ({ clientId: input.clientId!, client:input.clientName, firstName:'Example', email:`example${input.clientId}@example.test`, accountStatus:'active', month:input.month, returnedOrderCount:1, totalCents:10000, matchesHistoricalReference:false, reviewRequired:true, notes:[], orders:[{orderId:input.clientId!,siteId:input.clientId!,date:'10/10/2026 1:00:00 PM',totalCents:10000,taxCents:0,returnedCents:null,missingAmounts:['returned'],address:'Example property',siteOwnerMatches:true,hasCanceledTasks:false,services:[{name:'Photo package',chargeCents:10000,canceled:false},{name:'Included item',chargeCents:0,canceled:false}]}] });
test('directory drafts use stable client IDs, preserve unknown review notes, and need no reference total',async()=>{
 const seen:number[]=[];
 const reports=await prepareV1Month({month:'2026-10',clients,apiKey:'test',reader:async input=>{assert.equal(await input.authorizeClient(999),false);assert.equal(await input.authorizeClient(input.clientId!),true);seen.push(input.clientId!);return reader(input);}});
 assert.deepEqual(seen.sort(),[1,2,3]);assert.equal(reports.length,3);
 for(const {summary} of reports){assert.equal(summary.source,'v1-review');assert.equal(summary.totalCents,10000);assert.ok(summary.reviewNotes?.length);assert.deepEqual(summary.properties[0].services,['Photo package']);}
});
test('no purchases and failed account checks remain distinct; private transport errors are not persisted',async()=>{
 const reports=await prepareV1Month({month:'2026-10',clients,apiKey:'test',reader:async input=>{if(input.clientId===2)throw new Error('private credential');const r=await reader(input);return input.clientId===3?{...r,orders:[],totalCents:0}:r;}});
 assert.equal(reports.find(r=>r.summary.clientId===2)!.summary.issues.length,1);
 assert.equal(reports.find(r=>r.summary.clientId===3)!.summary.issues.length,0);
 assert.equal(reports.find(r=>r.summary.clientId===3)!.summary.orderCount,0);
 assert.ok(!JSON.stringify(reports).includes('private credential'));
});
test('email mismatch and canceled services hold the affected account',async()=>{
 const reports=await prepareV1Month({month:'2026-10',clients,apiKey:'test',reader:async input=>{const r=await reader(input);if(input.clientId===1)r.email='changed@example.test';if(input.clientId===2)r.orders[0].hasCanceledTasks=true;return r;}});
 assert.ok(reports.find(r=>r.summary.clientId===1)!.summary.issues.length);
 assert.ok(reports.find(r=>r.summary.clientId===2)!.summary.issues.length);
 assert.equal(reports.find(r=>r.summary.clientId===3)!.summary.issues.length,0);
});
test('duplicate account orders and deadline expiry reject the entire prepared month',async()=>{
 await assert.rejects(prepareV1Month({month:'2026-10',clients,apiKey:'test',reader:async input=>{const r=await reader(input);r.orders[0].orderId=1;return r;}}),/multiple accounts/);
 let clock=0;await assert.rejects(prepareV1Month({month:'2026-10',clients,apiKey:'test',reader,now:()=>clock+=240000}),/timed out/);
});

test('sanitized verification stages are retained and never counted as purchase summaries',async()=>{
 const { VerificationError }=await import('./v1-check.ts');
 const { generationCounts, draftStatus }=await import('./review-status.ts');
 const reports=await prepareV1Month({month:'2026-10',clients,apiKey:'test',reader:async input=>{
  if(input.clientId===2)throw new VerificationError('[order-list] HDPhotoHub read failed (429).');
  const r=await reader(input);return input.clientId===3?{...r,orders:[],totalCents:0}:r;
 }});
 assert.deepEqual(generationCounts(reports),{checked:3,generated:1,ready:0,review:1,checkFailed:1,noPurchases:1});
 const failed=reports.find(p=>p.summary.clientId===2)!.summary;
 assert.equal(draftStatus(failed),'CHECK_FAILED');assert.match(failed.issues[0],/order-list.*429/);
 const legacy={...failed,verificationFailed:undefined,issues:['This account could not be verified. Run its connection check and retry generation.']};
 assert.equal(draftStatus(legacy),'CHECK_FAILED');
});
