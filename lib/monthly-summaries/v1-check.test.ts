import test from "node:test";
import assert from "node:assert/strict";
import { checkExistingConnection, v1CalendarMonth } from "./v1-check.ts";
function fixture(options: { linked?: boolean; otherBrand?: boolean; duplicate?: boolean; date?: string; orderBrand?: number } = {}) {
  const calls: string[] = [];
  const orders = [100,200].map((total,i) => ({ oid: i+1, bid: options.orderBrand ?? 10, sid: i+100, date: options.date ?? '2026-10-08T12:00:00', total, taxamount: 0, returned: 0, tasks: [{ name: 'Photography', canceled: false }] }));
  return { calls, input: { apiKey: 'test-only', clientName: 'Alex Example', month: '2026-10', expectedTotalCents: 30000, authorizeClient: async (id: number) => id === 20 && options.linked !== false,
    fetcher: (async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error');
      const u = new URL(String(url)); assert.equal(u.origin, 'https://heliosrealestatemedia.hd.pics'); calls.push(u.pathname);
      const endpoint = u.pathname.split('/').at(-1);
      const data = endpoint === 'brand' ? {bid:10} : endpoint === 'users' ? [{uid:20,bid:10,name:'Alex Example',type:'client'}] : endpoint === 'orders' ? options.duplicate ? [orders[0],orders[0]] : orders : endpoint === 'order' ? orders[Number(u.searchParams.get('oid'))-1] : {sid:Number(u.searchParams.get('sid')),bid:options.otherBrand ? 99 : 10,user:{uid:20},address:'Example property'};
      return Response.json(data);
    }) as typeof fetch,
  }};
}
test('v1 diagnostic reads both reference orders without enabling delivery', async () => {
  const f=fixture(); const result=await checkExistingConnection(f.input);
  assert.equal(result.totalCents,30000); assert.equal(result.matchesHistoricalReference,true); assert.equal(result.reviewRequired,true);
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
test('authentication failure identifies the step without echoing the response body', async () => {
  const f=fixture();
  await assert.rejects(checkExistingConnection({...f.input,fetcher:(async()=>new Response('private upstream details',{status:401})) as typeof fetch}),/^Error: \[brand\] HDPhotoHub read failed \(401\)\.$/);
});
test('unexpected database errors cannot disclose connection strings', async () => {
  const f=fixture();
  await assert.rejects(checkExistingConnection({...f.input,authorizeClient:async()=>{throw new Error('private-database-connection');}}),/^Error: \[workspace-association\] The client-directory database check failed\.$/);
});
test('upstream transport errors are sanitized and stage-labelled', async () => {
  const f=fixture();
  await assert.rejects(checkExistingConnection({...f.input,fetcher:(async()=>{throw new Error('private-token');}) as typeof fetch}),/\[brand\] HDPhotoHub request could not connect/);
});

test('v1 date-only and space-separated orders match the same calendar month', async () => {
  for (const date of ['2026-10-08', '2026-10-08 12:00:00', '2026-10-08T12:00:00.000Z']) {
    const result = await checkExistingConnection(fixture({date}).input);
    assert.equal(result.matchesHistoricalReference, true);
  }
});
test('v1 parsing does not shift an explicit source date across months', () => {
  assert.equal(v1CalendarMonth('2026-11-01T00:15:00+02:00'), '2026-11');
  assert.equal(v1CalendarMonth('2026-10-31 23:45:00-06:00'), '2026-10');
});
test('invalid and ambiguous dates remain held', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-10-08 24:00:00', '10/08/2026', '', null]) assert.throws(() => v1CalendarMonth(date));
});
test('cross-brand orders report a distinct brand failure', async () => {
  await assert.rejects(checkExistingConnection(fixture({orderBrand:99}).input), /\[order-brand-validation\]/);
});
