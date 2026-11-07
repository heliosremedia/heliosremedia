import test from "node:test";
import assert from "node:assert/strict";
import { buildV1Preview, cleanServiceName } from "./v1-preview.ts";
import { signPreview, verifyPreview, type PreviewPayload } from "./preview-token.ts";
function example() {
  return { clientId: 1, firstName: "Alex", client: "Alex Example", month: "2026-10", returnedOrderCount: 2, totalCents: 30000, matchesHistoricalReference: true, reviewRequired: true, notes: [], orders: [10000,20000].map((totalCents,i) => ({ orderId:i+1,siteId:5,date:'10/10/2026 1:00:00 PM',totalCents,taxCents:0,returnedCents:null,missingAmounts:['returned'],address:'Example property',siteOwnerMatches:true,hasCanceledTasks:false,services:[{name:'Photo Package <i>(Large)</i>',chargeCents:totalCents,canceled:false},{name:'Included floor plan',chargeCents:0,canceled:false}] })) };
}
test('preview groups visits and includes charged labels without package components or duplicate names', () => {
 const summary=buildV1Preview(example());
 assert.equal(summary.properties.length,1);assert.equal(summary.totalCents,30000);assert.equal(summary.orderCount,2);
 assert.deepEqual(summary.properties[0].services,['Photo Package (Large)']);
 assert.deepEqual(summary.properties[0].orderIds,[1,2]);
});
test('service markup and script bodies cannot reach the preview',()=>{
 assert.equal(cleanServiceName('Photo <font size="3"><i>Package</i></font> &amp; Drone<script>alert(1)</script>'),'Photo Package & Drone');
});
test('mismatch, canceled services, adjustments, missing charges and ownership fail closed',()=>{
 const mismatch=example();mismatch.matchesHistoricalReference=false;assert.throws(()=>buildV1Preview(mismatch));
 const canceled=example();canceled.orders[0].hasCanceledTasks=true;assert.throws(()=>buildV1Preview(canceled));
 const owner=example();owner.orders[0].siteOwnerMatches=false;assert.throws(()=>buildV1Preview(owner));
 const missing=example();Object.assign(missing.orders[0].services[0],{chargeCents:null});assert.throws(()=>buildV1Preview(missing));
 const adjusted=example();Object.assign(adjusted.orders[0],{returnedCents:100});assert.throws(()=>buildV1Preview(adjusted));
});
test('signed preview freezes exact attachment and rejects edits, expiry and other owners/workspaces',()=>{
 const secret='test-secret-only-'.repeat(3);
 const payload:PreviewPayload={workspaceId:'w',userId:'u',expiresAt:2000,requestId:'request',subject:'Summary',html:'<p>Example</p>',attachment:{filename:'summary.pdf',content:'JVBERg==',contentType:'application/pdf'}};
 const token=signPreview(payload,secret);assert.deepEqual(verifyPreview(token,secret,'w','u',1000),payload);
 assert.throws(()=>verifyPreview(token,secret,'other','u',1000));assert.throws(()=>verifyPreview(token,secret,'w','other',1000));assert.throws(()=>verifyPreview(token,secret,'w','u',2000));
 const edited=Buffer.from(JSON.stringify({...payload,html:'changed'})).toString('base64url')+'.'+token.split('.')[1];
 assert.throws(()=>verifyPreview(edited,secret,'w','u',1000));
});
