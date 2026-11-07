// Read-only verification. Run with HDPH_API_KEY in the local secret environment.
// No credential or raw client records are printed or written to disk.
import assert from 'node:assert/strict';
const key = process.env.HDPH_API_KEY?.trim();
if (!key) { console.error('HDPH_API_KEY is required in the local secret environment. No requests were made.'); process.exit(1); }
const base = 'https://heliosrealestatemedia.hd.pics/api/v1';
async function read(route, query = {}) {
  assert.ok(['/brand', '/users', '/orders', '/order', '/site'].includes(route));
  const response = await fetch(`${base}${route}?${new URLSearchParams(query)}`, {
    headers: { api_key: key, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HDPhotoHub ${route} returned HTTP ${response.status}`);
  return response.json();
}
try {
  const brand = await read('/brand');
  assert.ok(Number.isSafeInteger(brand.bid) && brand.bid > 0, 'Invalid brand response');
  const clients = await read('/users', { name: 'Stephanie Nealy' });
  assert.ok(Array.isArray(clients), 'Invalid client search response');
  const matches = clients.filter(c => c.name?.trim().toLowerCase() === 'stephanie nealy' && c.bid === brand.bid && c.type === 'client');
  assert.equal(matches.length, 1, 'Expected one exact Stephanie Nealy client match; review identity before proceeding');
  const client = matches[0];
  const orders = await read('/orders', { uid: String(client.uid) });
  assert.ok(Array.isArray(orders), 'Invalid orders response');
  const october = orders.filter(o => typeof o.date === 'string' && o.date.startsWith('2026-10'));
  console.log(JSON.stringify({ connection: 'verified', clientMatch: 'exact', returnedOrders: orders.length, octoberCandidates: october.length }));
  const seen = new Set();
  for (const row of october) {
    assert.ok(Number.isSafeInteger(row.oid) && row.oid > 0 && !seen.has(row.oid), 'Invalid or duplicate order ID'); seen.add(row.oid);
    const order = await read('/order', { oid: String(row.oid) });
    assert.equal(order.oid, row.oid); assert.equal(order.bid, brand.bid);
    assert.ok(Number.isSafeInteger(order.sid) && order.sid > 0, 'Missing site ID');
    const site = await read('/site', { sid: String(order.sid) });
    assert.equal(site.bid, brand.bid); assert.equal(site.sid, order.sid);
    console.log(JSON.stringify({
      orderId: order.oid, siteId: order.sid, date: order.date, total: order.total,
      tax: order.taxamount, returned: order.returned,
      taskCount: Array.isArray(order.tasks) ? order.tasks.length : null,
      canceledTasks: Array.isArray(order.tasks) ? order.tasks.filter(t => t.canceled).length : null,
      siteOwnerMatches: site.user?.uid === client.uid,
      siteStatus: site.status,
      // Field names only: establish whether the actual response has a billed-user field.
      orderFields: Object.keys(order),
    }));
  }
  console.log('Read-only check complete. Date timezone, result completeness, billed-client ownership, and totals still require review before enabling generation.');
} catch (error) {
  console.error(error instanceof Error && (error.name === 'AssertionError' || error.message.startsWith('HDPhotoHub ')) ? error.message : 'Read-only verification failed. No records were changed.');
  process.exitCode = 1;
}
