import test from "node:test";
import assert from "node:assert/strict";
import { checkExistingConnection } from "./v1-check.ts";
function fixture(options: { linked?: boolean; otherBrand?: boolean; duplicate?: boolean } = {}) {
  const calls: string[] = [];
  const orders = [342.08,1027.91].map((total,i) => ({ oid: i+1, bid: 10, sid: i+100, date: '2026-10-08T12:00:00', total, taxamount: 0, returned: 0, tasks: [{ name: 'Photography', canceled: false }] }));
  return { calls, input: { apiKey: 'test-only', authorizeClient: async (id: number) => id === 20 && options.linked !== false,
    fetcher: (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error');
      const u = new URL(String(url)); assert.equal(u.origin, 'https://heliosrealestatemedia.hd.pics'); calls.push(u.pathname);
      const endpoint = u.pathname.split('/').at(-1);
      const data = endpoint === 'brand' ? {bid:10} : endpoint === 'users' ? [{uid:20,bid:10,name:'Stephanie Nealy',type:'client'}] : endpoint === 'orders' ? options.duplicate ? [orders[0],orders[0]] : orders : endpoint === 'order' ? orders[Number(u.searchParams.get('oid'))-1] : {sid:Number(u.searchParams.get('sid')),bid:options.otherBrand ? 99 : 10,user:{uid:20},address:'Example property'};
      return Response.json(data);
    }) as typeof fetch,
  }};
}
test('v1 diagnostic reads both reference orders without enabling delivery', async () => {
  const f=fixture(); const result=await checkExistingConnection(f.input);
  assert.equal(result.totalCents,136999); assert.equal(result.matchesHistoricalReference,true); assert.equal(result.reviewRequired,true);
  assert.equal(result.orders.length,2); assert.ok(result.orders.every(o=>o.siteOwnerMatches));
});
test('unlinked client stops before reading any orders', async () => {
  const f=fixture({linked:false}); await assert.rejects(checkExistingConnection(f.input),/workspace/);
  assert.equal(f.calls.length,2);
});
test('cross-brand site and duplicate orders fail closed', async () => {
  await assert.rejects(checkExistingConnection(fixture({otherBrand:true}).input),/brand/);
  await assert.rejects(checkExistingConnection(fixture({duplicate:true}).input),/Duplicate/);
});
test('missing credential makes no requests', async () => {
  const f=fixture(); await assert.rejects(checkExistingConnection({...f.input,apiKey:''}),/configured/); assert.equal(f.calls.length,0);
});
