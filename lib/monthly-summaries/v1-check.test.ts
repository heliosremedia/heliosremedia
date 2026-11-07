import test from "node:test";
import assert from "node:assert/strict";
import { checkExistingConnection, v1CalendarMonth, v1Amount } from "./v1-check.ts";
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

test('legacy v1 US timestamps support AM/PM and single-digit components', async () => {
  for (const date of ['10/8/2026 12:00:00 AM', '10/31/2026 11:59:59 PM', '10/8/2026 1:05:09 pm']) {
    assert.equal(v1CalendarMonth(date), '2026-10');
    assert.equal((await checkExistingConnection(fixture({date}).input)).matchesHistoricalReference, true);
  }
  assert.equal(v1CalendarMonth('9/23/2026 10:21:45 AM'), '2026-09');
});
test('legacy v1 dates validate leap years, calendar limits and time ranges', () => {
  assert.equal(v1CalendarMonth('2/29/2024 12:00:00 PM'), '2024-02');
  for (const date of ['2/29/2026 12:00:00 PM', '13/1/2026 1:00:00 AM', '10/8/2026 0:00:00 AM', '10/8/2026 13:00:00 PM', '10/8/2026 1:60:00 AM', '10/8/2026 1:00:60 AM']) assert.throws(() => v1CalendarMonth(date));
});

test('v1 monetary formats preserve exact cents without rounding', () => {
  for (const value of [1200.5, '1200.50', '1200.5000', '$1,200.50', ' 1,200.50 ']) assert.equal(v1Amount(value, 'total'), 120050);
  for (const value of ['1200.501', '1,20.50', '1.200,50', true, {}, null, undefined, '']) assert.throws(() => v1Amount(value, 'total'), /total/);
});
test('missing optional amounts remain unknown rather than zero', () => {
  assert.equal(v1Amount(undefined, 'returned', true), null);
  assert.equal(v1Amount(null, 'taxamount', true), null);
  assert.equal(v1Amount('', 'returned', true), null);
  assert.equal(v1Amount(0, 'returned', true), 0);
  assert.throws(() => v1Amount('invalid', 'returned', true), /returned/);
});

test('ID-based directory checks authorize before any upstream request and do not use name search', async()=>{
 const f=fixture();await assert.rejects(checkExistingConnection({...f.input,clientId:99}),/workspace/);assert.equal(f.calls.length,0);
 const original=f.input.fetcher;
 const result=await checkExistingConnection({...f.input,clientId:20,clientName:'Changed display name',expectedTotalCents:undefined,fetcher:(async(url,init)=>{
  if(new URL(String(url)).pathname.endsWith('/user'))return Response.json({uid:20,bid:10,type:'client',firstname:'Alex',email:'alex@example.test',status:'active'});
  return original(url,init);
 }) as typeof fetch});
 assert.equal(result.clientId,20);assert.equal(result.email,'alex@example.test');assert.equal(result.matchesHistoricalReference,false);assert.ok(!f.calls.some(p=>p.endsWith('/users')));
});
