import { moneyCents, positiveId, record } from "./core.ts";

export class VerificationError extends Error {}

export function v1Amount(value: unknown, field: "total" | "taxamount" | "returned" | "clientpay", optional = false): number | null {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    if (optional) return null;
    throw new VerificationError(`Required amount field '${field}' was not supplied.`);
  }
  // Accept USD grouping and insignificant trailing zeroes, but never round sub-cent values.
  if (typeof value !== "string" && typeof value !== "number") throw new VerificationError(`Amount field '${field}' has an unexpected type (${typeof value}).`);
  let text = String(value).trim();
  if (/^-?\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) text = text.replace("$", "").replaceAll(",", "");
  text = text.replace(/(\.\d{2})0+$/, "$1");
  try { return moneyCents(text); } catch {
    const shape = String(value).slice(0, 32).replace(/[0-9]/g, "#").replace(/[A-Za-z]/g, "A").replace(/[^#A$.,+\- ]/g, "?");
    throw new VerificationError(`Amount field '${field}' cannot be read as exact cents (type: ${typeof value}; shape: ${shape}).`);
  }
}

// Read the calendar month exactly as supplied; this is not a timezone conversion.
export function v1CalendarMonth(value: unknown): string {
  if (typeof value !== "string") throw new VerificationError("Order date is missing or is not text.");
  // The v1 response uses US-style month/day/year timestamps with AM/PM.
  const legacy = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i.exec(value.trim());
  if (legacy) {
    const [, month, day, year, hour, minute, second, period] = legacy;
    if (Number(hour) < 1 || Number(hour) > 12) throw new VerificationError("Order date has an invalid 12-hour time.");
    const hour24 = Number(hour) % 12 + (period.toUpperCase() === "PM" ? 12 : 0);
    return v1CalendarMonth(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(hour24).padStart(2, "0")}:${minute}:${second}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?(?:Z|[+-](\d{2}):?(\d{2}))?)?$/.exec(value.trim());
  if (!match) {
    const shape = value.slice(0, 40).replace(/[0-9]/g, "#").replace(/[A-Za-z]/g, "A").replace(/[^#A /:.,+\-]/g, "?");
    throw new VerificationError(`Order date format is unsupported (shape: ${shape}). No date was inferred.`);
  }
  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() + 1 !== Number(month) || check.getUTCDate() !== Number(day) || (hour !== undefined && Number(hour) > 23) || (minute !== undefined && Number(minute) > 59) || (second !== undefined && Number(second) > 59) || (offsetHour !== undefined && Number(offsetHour) > 23) || (offsetMinute !== undefined && Number(offsetMinute) > 59)) throw new VerificationError("Order date is not a valid calendar date or time.");
  return `${year}-${month}`;
}

// Read-only v1 account reader. Directory generation uses verified IDs, never name guesses.
export async function checkExistingConnection(input: {
  apiKey: string;
  clientName: string;
  month: string;
  expectedTotalCents?: number;
  clientId?: number;
  authorizeClient: (clientId: number) => Promise<boolean>;
  fetcher?: typeof fetch;
}) {
  let stage = "configuration";
  try {
  if (!input.apiKey.trim()) throw new VerificationError("The existing HDPhotoHub key is not configured.");
  if (!input.clientName.trim() || input.clientName.length > 150 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(input.month) || (input.expectedTotalCents !== undefined && (!Number.isSafeInteger(input.expectedTotalCents) || input.expectedTotalCents < 0))) throw new VerificationError("Invalid verification inputs.");
  const fetcher = input.fetcher || fetch;
  async function read(endpoint: string, params: Record<string, string> = {}) {
    if (!["brand", "users", "user", "orders", "order", "site"].includes(endpoint)) throw new VerificationError("Unsupported read operation.");
    let result: Response;
    try { result = await fetcher(`https://heliosrealestatemedia.hd.pics/api/v1/${endpoint}?${new URLSearchParams(params)}`, {
      method: "GET", headers: { api_key: input.apiKey, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    }); } catch (error) { if (error instanceof VerificationError) throw error; throw new VerificationError("HDPhotoHub request could not connect, timed out, or attempted a redirect."); }
    if (!result.ok) throw new VerificationError(`HDPhotoHub read failed (${result.status}).`);
    try { return await result.json(); } catch { throw new VerificationError("HDPhotoHub returned a non-JSON response."); }
  }
  if (input.clientId !== undefined) {
    stage = "workspace-association";
    if (!(await input.authorizeClient(positiveId(input.clientId)))) throw new VerificationError("Client is not linked to this workspace.");
  }
  stage = "brand";
  const brand = record(await read("brand"));
  const brandId = positiveId(brand.bid);
  stage = "client-search";
  const users = input.clientId !== undefined ? [await read("user", { uid: String(input.clientId) })] : await read("users", { name: input.clientName.trim() });
  if (!Array.isArray(users)) throw new VerificationError("Unexpected client search response.");
  stage = "client-match";
  const matches = users.map(record).filter(c => (input.clientId !== undefined ? c.uid === input.clientId : String(c.name || `${c.firstname || ""} ${c.lastname || ""}`).trim().toLowerCase() === input.clientName.trim().toLowerCase()) && c.bid === brandId && c.type === "client");
  if (matches.length !== 1) throw new VerificationError("An exact, unique client account could not be identified.");
  const clientId = positiveId(matches[0].uid);
  stage = "workspace-association";
  if (!(await input.authorizeClient(clientId))) throw new VerificationError("The test client is not linked to your workspace. Sync the existing client directory first.");
  stage = "order-list";
  const list = await read("orders", { uid: String(clientId) });
  if (!Array.isArray(list) || list.length > 2000) throw new VerificationError("Order list is invalid or exceeds the validation limit.");
  const seen = new Set<number>();
  stage = "order-date-validation";
  const candidates = list.map(record).filter(o => {
    const id = positiveId(o.oid);
    if (seen.has(id)) throw new VerificationError("Duplicate order in the response. Review completeness before proceeding.");
    seen.add(id);
    stage = "order-brand-validation";
    if (positiveId(o.bid) !== brandId) throw new VerificationError("An order belongs to a different brand. Verification stopped.");
    stage = "order-date-validation";
    return v1CalendarMonth(o.date) === input.month;
  });
  if (candidates.length > 20) throw new VerificationError("Historical test exceeds the 20-order validation limit.");
  const orders = [];
  for (const candidate of candidates) {
    stage = "order-detail";
    const order = record(await read("order", { oid: String(candidate.oid) }));
    if (order.oid !== candidate.oid || order.bid !== brandId || order.sid !== candidate.sid || order.date !== candidate.date) throw new VerificationError("Order changed or ownership fields do not match.");
    stage = "property-detail";
    const site = record(await read("site", { sid: String(positiveId(order.sid)) }));
    if (site.sid !== order.sid || site.bid !== brandId) throw new VerificationError("Property does not match the order brand.");
    if (!Array.isArray(order.tasks)) throw new VerificationError("Order services are missing.");
    const tasks = order.tasks.map(record);
    stage = "property-owner";
    const siteOwnerMatches = !!site.user && record(site.user).uid === clientId;
    stage = "order-totals";
    const totalCents = v1Amount(order.total, "total")!;
    const taxCents = v1Amount(order.taxamount, "taxamount", true);
    const returnedCents = v1Amount(order.returned, "returned", true);
    orders.push({ orderId: order.oid, siteId: order.sid, date: order.date, totalCents, taxCents, returnedCents,
      missingAmounts: [taxCents === null ? "taxamount" : null, returnedCents === null ? "returned" : null].filter(Boolean),
      address: [site.address, site.city, site.state].filter(Boolean).join(", "),
      siteOwnerMatches,
      services: tasks.map(t => ({ name: String(t.name || ""), canceled: t.canceled === true, chargeCents: v1Amount(t.clientpay, "clientpay", true) })),
      hasCanceledTasks: tasks.some(t => t.canceled === true),
    });
  }
  const totalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  return { clientId, email: String(matches[0].email || "").trim().toLowerCase(), accountStatus: String(matches[0].status || ""), firstName: String(matches[0].firstname || input.clientName.trim().split(/\s+/)[0]), client: input.clientName.trim(), month: input.month, returnedOrderCount: list.length, orders, totalCents,
    matchesHistoricalReference: orders.length > 0 && totalCents === input.expectedTotalCents,
    reviewRequired: true,
    notes: ["Read-only diagnostic. No report was saved and no email was sent.", "Month candidates use the calendar date supplied by the API, including v1 month/day/year AM/PM timestamps. Timezone and month-boundary behavior still need confirmation.", "Site owner is checked separately from the purchaser. The v1 schema does not expose an explicit billed-client ID.", "Missing optional amounts are shown as not supplied, never assumed to be zero. List completeness and canceled/returned amount semantics still require review before automated generation."],
  };
  } catch (error) {
    if (error instanceof VerificationError && error.name === "RateLimitError") throw error;
    const detail = error instanceof VerificationError ? error.message : stage === "workspace-association" ? "The client-directory database check failed." : "An API field was missing or had an unexpected format.";
    throw new VerificationError(`[${stage}] ${detail}`);
  }
}
