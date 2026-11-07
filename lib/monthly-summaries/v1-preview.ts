import sanitizeHtml from "sanitize-html";
import type { checkExistingConnection } from "./v1-check.ts";
import { positiveId, requireCompletedMonth, type Summary } from "./core.ts";
export class PreviewValidationError extends Error {}
export function cleanServiceName(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
export function buildV1Preview(result: Awaited<ReturnType<typeof checkExistingConnection>>): Summary {
  requireCompletedMonth(result.month);
  if (!result.matchesHistoricalReference || !result.orders.length) throw new PreviewValidationError("The API total must match the expected total before previewing.");
  const summary: Summary = { month: result.month, clientId: result.clientId, firstName: result.firstName, email: "", totalCents: 0, orderCount: 0, properties: [], issues: [], excludedOrderIds: [] };
  const properties = new Map<number, Summary["properties"][number]>();
  for (const order of result.orders) {
    if (!order.siteOwnerMatches || order.hasCanceledTasks || (order.returnedCents !== null && order.returnedCents !== 0) || order.totalCents <= 0) throw new PreviewValidationError("An order has ownership, cancellation, or adjustment details requiring review.");
    if (!order.address.trim() || order.services.some(s => s.chargeCents === null)) throw new PreviewValidationError("A property address or service charge is missing. Review the API fields before previewing.");
    const names = order.services.filter(s => !s.canceled && s.chargeCents! > 0).map(s => cleanServiceName(s.name));
    if (!names.length || names.some(n => !n)) throw new PreviewValidationError("No named, charged services were found for an order.");
    const siteId = positiveId(order.siteId);
    const property = properties.get(siteId) || { siteId, address: order.address, services: [], totalCents: 0, orderIds: [] };
    if (property.address !== order.address) throw new PreviewValidationError("Addresses disagree for the same property.");
    const unique = new Map(property.services.map(n => [n.toLowerCase(), n]));
    for (const name of names) if (!unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name);
    property.services = [...unique.values()]; property.totalCents += order.totalCents; property.orderIds.push(positiveId(order.orderId));
    properties.set(siteId, property); summary.totalCents += order.totalCents; summary.orderCount++;
  }
  if (!Number.isSafeInteger(summary.totalCents) || summary.totalCents !== result.totalCents) throw new PreviewValidationError("Preview total does not match the verification result.");
  summary.properties = [...properties.values()];
  return summary;
}
