import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { summaryHash, snapshotMatches } from './snapshot.ts';
import type { Summary } from './core.ts';
const example:Summary={month:'2026-10',clientId:1,firstName:'Alex',email:'alex@example.test',totalCents:10000,orderCount:1,properties:[{siteId:1,address:'Example',services:['Photo','Video'],totalCents:10000,orderIds:[1]}],issues:[],excludedOrderIds:[],source:'v1-review',reviewNotes:['Review']};
function reverse(value:unknown):unknown {return Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reverse(v)])):value;}
test('snapshot hash survives recursive JSONB object key reordering',()=>{assert.equal(summaryHash(example),summaryHash(reverse(example) as Summary));});
test('legacy reports verify after key reordering without ignoring edits or unknown fields',()=>{
 const hash=createHash('sha256').update(JSON.stringify(example)).digest('hex');
 assert.ok(snapshotMatches(reverse(example) as Summary,hash));
 assert.ok(!snapshotMatches({...example,totalCents:999},hash));
 assert.ok(!snapshotMatches({...example,unknown:true} as Summary,hash));
 const failed:Summary={month:'2026-10',clientId:1,firstName:'Alex',email:'alex@example.test',properties:[],totalCents:0,orderCount:0,issues:['API failed'],excludedOrderIds:[],source:'v1-review',reviewNotes:[],verificationFailed:true};
 assert.ok(snapshotMatches(reverse(failed) as Summary,createHash('sha256').update(JSON.stringify(failed)).digest('hex')));
});
test('snapshot integrity still detects nested changes and array order',()=>{
 const hash=summaryHash(example);const changed=structuredClone(example);changed.properties[0].services.reverse();assert.ok(!snapshotMatches(changed,hash));
 changed.properties[0].services.reverse();changed.properties[0].totalCents++;assert.ok(!snapshotMatches(changed,hash));
});
