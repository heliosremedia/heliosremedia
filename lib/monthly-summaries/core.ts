import { zonedLocalToUtc } from "../client-communications/scheduling.ts";

export const TIME_ZONE = "America/Denver";
export const TEST_EMAIL = "jake@heliosrealestatemedia.com";
export type PropertySummary = { siteId: number; address: string; services: string[]; totalCents: number; orderIds: number[] };
export type Summary = {
  month: string; clientId: number; firstName: string; email: string;
  properties: PropertySummary[]; totalCents: number; orderCount: number;
  issues: string[]; excludedOrderIds: number[];
};
export type RecordData = Record<string, unknown>;
export function record(value: unknown): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("HDPhotoHub returned an unexpected record.");
  return value as RecordData;
}
export function positiveId(value: unknown): number {
  if (!(typeof value === "number" || typeof value === "string") || !/^\d+$/.test(String(value))) throw new Error("Missing or invalid HDPhotoHub ID.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Missing or invalid HDPhotoHub ID.");
  return id;
}
export function moneyCents(value: unknown): number {
  if (!(typeof value === "number" || typeof value === "string") || !/^-?\d+(\.\d{1,2})?$/.test(String(value))) throw new Error("Missing or invalid monetary total.");
  const negative = String(value).startsWith("-");
  const [whole, fraction = ""] = String(value).replace(/^-/, "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Monetary total is out of range.");
  return negative ? -cents : cents;
}
export function monthWindow(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid reporting month.");
  const [year, number] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
  return { start: zonedLocalToUtc(`${month}-01T00:00`, TIME_ZONE), end: zonedLocalToUtc(`${next}-01T00:00`, TIME_ZONE), next };
}
export function previousMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find(p => p.type === "year")!.value);
  const month = Number(parts.find(p => p.type === "month")!.value);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}
export function requireCompletedMonth(month: string, now = new Date()) {
  const window = monthWindow(month);
  if (window.end > now) throw new Error("Choose a completed calendar month.");
  return window;
}
export function scheduledAt(month: string) {
  const { next } = monthWindow(month);
  let weekdays = 0;
  for (let day = 1; day <= 7; day++) {
    const date = new Date(`${next}-${String(day).padStart(2, "0")}T12:00:00Z`);
    if (![0, 6].includes(date.getUTCDay())) weekdays++;
    if (weekdays === 3) return zonedLocalToUtc(`${next}-${String(day).padStart(2, "0")}T09:00`, TIME_ZONE);
  }
  throw new Error("Unable to determine reporting schedule.");
}
export function monthLabel(month: string) {
  monthWindow(month);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}
export const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// A summary is fail-closed: one ambiguous order holds the entire client's report.
export function summarize(input: { month: string; brandId: number; client: RecordData; orders: RecordData[]; excludedOrderIds?: number[] }): Summary {
  const { start, end } = monthWindow(input.month);
  const clientId = positiveId(input.client.clientId);
  if (positiveId(input.client.brandId) !== input.brandId) throw new Error("Client is outside the configured Helios brand.");
  const email = typeof input.client.email === "string" ? input.client.email.trim().toLowerCase() : "";
  const summary: Summary = { month: input.month, clientId, firstName: String(input.client.firstName || input.client.name || "there"), email, properties: [], totalCents: 0, orderCount: 0, issues: [], excludedOrderIds: [] };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) summary.issues.push("Client account has no valid email address.");
  if (input.client.status !== "active" || !["client", "groupadmin"].includes(String(input.client.type))) summary.issues.push("Client account status or type needs review.");
  const seen = new Map<number, string>();
  const groups = new Map<number, PropertySummary>();
  for (const order of input.orders) {
    const id = positiveId(order.orderId);
    if (positiveId(order.brandId) !== input.brandId || positiveId(order.clientId) !== clientId) throw new Error("Order ownership does not match this client and brand.");
    const fingerprint = JSON.stringify(order);
    if (seen.has(id)) { if (seen.get(id) !== fingerprint) summary.issues.push(`Order ${id}: conflicting duplicate records.`); continue; }
    seen.set(id, fingerprint);
    try {
      const timestamp = order.createDate;
      if (typeof timestamp !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error("Purchase timestamp is missing or has no timezone.");
      const created = new Date(timestamp);
      if (created < start || created >= end) continue;
      if (input.excludedOrderIds?.includes(id) || order.status === "archived") { summary.excludedOrderIds.push(id); continue; }
      if (!["active", "complete"].includes(String(order.status))) throw new Error("Order status needs review.");
      if (order.parentOrderId != null) throw new Error("Allowance order needs review.");
      if (typeof order.clientEmail !== "string" || order.clientEmail.trim().toLowerCase() !== email) throw new Error("Order and client email addresses do not match.");
      if (!Array.isArray(order.tasks) || !order.tasks.length) throw new Error("Purchased services are missing.");
      const tasks = order.tasks.map(record);
      const products = tasks.filter(t => ["product", "package"].includes(String(t.productType)) && t.status !== "system");
      if (products.length && products.every(t => t.status === "cancelled")) {
        if (tasks.some(t => t.status !== "cancelled" && t.status !== "system" && moneyCents(t.price) !== 0)) throw new Error("Canceled services with retained charges need review.");
        summary.excludedOrderIds.push(id); continue;
      }
      if (tasks.some(t => t.status === "cancelled") || moneyCents(order.returnedAmount) !== 0) throw new Error("Cancellation or adjustment needs review.");
      if (tasks.some(t => t.allowanceOrder != null)) throw new Error("Allowance needs review.");
      if (tasks.some(t => !["done", "undone", "system"].includes(String(t.status)))) throw new Error("Unrecognized service status.");
      const totalCents = moneyCents(order.total);
      if (totalCents <= 0) throw new Error("Zero or negative purchases need review.");
      const paidProducts = products.filter(t => moneyCents(t.price) > 0);
      const names = [...new Set(paidProducts.map(t => typeof t.productName === "string" ? t.productName.trim() : ""))];
      if (!names.length || names.some(n => !n)) throw new Error("Paid service or package names are missing.");
      const siteId = positiveId(order.siteId);
      const location = record(order.location);
      if (typeof location.address !== "string" || !location.address.trim() || typeof location.city !== "string" || !location.city.trim()) throw new Error("Property address is incomplete.");
      const address = [location.address, location.address2, [location.city, location.region].filter(Boolean).join(", ")].filter(Boolean).join(" | ");
      const property = groups.get(siteId) || { siteId, address, services: [], totalCents: 0, orderIds: [] };
      if (property.address !== address) throw new Error("Property addresses disagree for the same site ID.");
      property.services = [...new Set([...property.services, ...names])];
      property.totalCents += totalCents;
      property.orderIds.push(id);
      groups.set(siteId, property);
      summary.orderCount++;
      summary.totalCents += totalCents;
      if (!Number.isSafeInteger(summary.totalCents)) throw new Error("Combined total is out of range.");
    } catch (error) { summary.issues.push(`Order ${id}: ${error instanceof Error ? error.message : "Needs review."}`); }
  }
  summary.properties = [...groups.values()].sort((a, b) => a.address.localeCompare(b.address));
  summary.issues = [...new Set(summary.issues)];
  return summary;
}
