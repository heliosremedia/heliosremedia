import assert from "node:assert/strict";
import test from "node:test";
import { moneyCents, monthWindow, previousMonth, scheduledAt, summarize, requireCompletedMonth, type RecordData } from "./core.ts";
import { renderSummaryEmail, sampleSummary } from "./email.ts";
const client = { clientId: 44, brandId: 7, firstName: "Alex", email: "alex@example.com", status: "active", type: "client" };
const task = { taskId: 1, productType: "package", productName: "Pro Media Package", price: "325.00", status: "undone" };
function order(change: RecordData = {}): RecordData { return { orderId: 1, clientId: 44, brandId: 7, clientEmail: client.email, createDate: "2026-10-01T06:00:00Z", siteId: 100, status: "active", total: "342.08", returnedAmount: "0.00", location: { address: "123 Meadow Lane", city: "Eaton", region: "CO" }, tasks: [task], ...change }; }
const summarizeOrders = (orders: RecordData[]) => summarize({ month: "2026-10", brandId: 7, client, orders });
test("uses API totals including discounts and taxes, without recalculating from services", () => {
  const summary = summarizeOrders([order(), order({ orderId: 2, siteId: 101, total: "1027.91", location: { address: "456 Aspen Court", city: "Windsor", region: "CO" } })]);
  assert.equal(summary.totalCents, 136999); assert.equal(summary.properties.length, 2); assert.deepEqual(summary.issues, []);
});
test("deduplicates orders and groups separate visits by stable site ID", () => {
  const summary = summarizeOrders([order(), order(), order({ orderId: 2 })]);
  assert.equal(summary.orderCount, 2); assert.equal(summary.properties.length, 1); assert.equal(summary.totalCents, 68416);
  assert.equal(summarizeOrders([order(), order({ orderId: 2, siteId: 102 })]).properties.length, 2);
});
test("conflicting duplicates hold the entire client", () => assert.match(summarizeOrders([order(), order({ total: 3 })]).issues.join(), /conflicting/));
test("cross-client and cross-brand orders cannot enter another client's summary", () => {
  assert.throws(() => summarizeOrders([order({ clientId: 99 })]), /ownership/);
  assert.throws(() => summarizeOrders([order({ brandId: 99 })]), /ownership/);
});
test("October includes its start and excludes next-month start in Denver", () => {
  const summary = summarizeOrders([order(), order({ orderId: 2, createDate: "2026-10-01T05:59:59Z" }), order({ orderId: 3, createDate: "2026-11-01T06:00:00Z" })]);
  assert.equal(summary.orderCount, 1);
});
test("Denver windows cover both daylight-saving changes and year rollover", () => {
  assert.equal(monthWindow("2026-03").start.toISOString(), "2026-03-01T07:00:00.000Z");
  assert.equal(monthWindow("2026-03").end.toISOString(), "2026-04-01T06:00:00.000Z");
  assert.equal(monthWindow("2026-11").end.toISOString(), "2026-12-01T07:00:00.000Z");
  assert.equal(monthWindow("2026-12").next, "2027-01");
  assert.equal(previousMonth(new Date("2026-11-01T05:00:00Z")), "2026-09");
});
test("schedule is third weekday, including holidays as specified", () => {
  assert.equal(scheduledAt("2026-10").toISOString(), "2026-11-04T16:00:00.000Z");
  assert.equal(scheduledAt("2026-07").toISOString(), "2026-08-05T15:00:00.000Z");
  assert.equal(scheduledAt("2026-12").toISOString(), "2027-01-05T16:00:00.000Z");
});
test("rejects invalid and incomplete months", () => {
  assert.throws(() => monthWindow("2026-13"));
  assert.throws(() => requireCompletedMonth("2026-11", new Date("2026-11-07T00:00:00Z")), /completed/);
});
test("requires complete, exact monetary values and timezone-bearing timestamps", () => {
  for (const value of [null, undefined, "", "0.001", NaN, Infinity, "1,000.00"]) assert.throws(() => moneyCents(value));
  assert.equal(moneyCents("0.29"), 29); assert.equal(moneyCents("-10.50"), -1050);
  for (const change of [{ total: null }, { returnedAmount: null }, { total: -1 }, { total: 0 }, { createDate: "2026-10-01T12:00:00" }, { createDate: "bad" }]) assert.ok(summarizeOrders([order(change)]).issues.length);
});
test("partial cancellations hold a client; fully canceled orders and archived orders are excluded", () => {
  const cancelled = { ...task, status: "cancelled" };
  assert.ok(summarizeOrders([order({ tasks: [task, cancelled] })]).issues.length);
  assert.ok(summarizeOrders([order({ returnedAmount: 25 })]).issues.length);
  const summary = summarizeOrders([order({ tasks: [cancelled] }), order({ orderId: 2, status: "archived" })]);
  assert.deepEqual(summary.excludedOrderIds, [1, 2]); assert.equal(summary.orderCount, 0);
});
test("retained cancellation fees are held, not quietly removed", () => {
  assert.ok(summarizeOrders([order({ tasks: [{ ...task, status: "cancelled" }, { ...task, productType: "orderfee", price: 50 }] })]).issues.length);
});
test("explicit test-order exclusions never affect other orders", () => {
  const summary = summarize({ month: "2026-10", brandId: 7, client, orders: [order(), order({ orderId: 2 })], excludedOrderIds: [1] });
  assert.equal(summary.orderCount, 1); assert.deepEqual(summary.excludedOrderIds, [1]);
});
test("free services and discount lines are not advertised as purchased media", () => {
  const summary = summarizeOrders([order({ tasks: [task, { ...task, price: 0, productName: "Complimentary twilight" }, { ...task, price: -50, productName: "Discount", status: "system" }] })]);
  assert.deepEqual(summary.properties[0].services, ["Pro Media Package"]);
});
test("allowances, missing services, address inconsistencies and email mismatches hold", () => {
  for (const change of [{ parentOrderId: 50 }, { tasks: [] }, { siteId: null }, { clientEmail: "other@example.com" }, { tasks: [{ ...task, allowanceOrder: { orderId: 20 } }] }]) assert.ok(summarizeOrders([order(change)]).issues.length);
  assert.ok(summarizeOrders([order(), order({ orderId: 2, location: { address: "Other", city: "Eaton" } })]).issues.length);
});
test("email escapes external content, uses purchase language, and rejects held reports", () => {
  const summary = summarizeOrders([order()]); summary.firstName = '<img src=x onerror="bad()">';
  const html = renderSummaryEmail(summary);
  assert.ok(html.includes("&lt;img")); assert.ok(!html.includes('<img src=x')); assert.ok(html.includes("Total Purchases")); assert.ok(html.includes("@media"));
  assert.throws(() => renderSummaryEmail({ ...summary, issues: ["held"] }));
  assert.throws(() => renderSummaryEmail(summary, { unsubscribeUrl: "javascript:alert(1)" }));
  assert.ok(renderSummaryEmail(sampleSummary("2026-10"), { sample: true }).includes("not verified order data"));
});
