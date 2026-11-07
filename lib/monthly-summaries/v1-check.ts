import { moneyCents, positiveId, record } from "./core.ts";

// Deliberately scoped to the approved historical validation case. No mutating API calls.
export async function checkExistingConnection(input: {
  apiKey: string;
  authorizeClient: (clientId: number) => Promise<boolean>;
  fetcher?: typeof fetch;
}) {
  if (!input.apiKey.trim()) throw new Error("The existing HDPhotoHub key is not configured.");
  const fetcher = input.fetcher || fetch;
  async function read(endpoint: string, params: Record<string, string> = {}) {
    if (!["brand", "users", "orders", "order", "site"].includes(endpoint)) throw new Error("Unsupported read operation.");
    const result = await fetcher(`https://heliosrealestatemedia.hd.pics/api/v1/${endpoint}?${new URLSearchParams(params)}`, {
      method: "GET", headers: { api_key: input.apiKey, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (!result.ok) throw new Error(`HDPhotoHub read failed (${result.status}).`);
    return result.json();
  }
  const brand = record(await read("brand"));
  const brandId = positiveId(brand.bid);
  const users = await read("users", { name: "Stephanie Nealy" });
  if (!Array.isArray(users)) throw new Error("Unexpected client search response.");
  const matches = users.map(record).filter(c => String(c.name || `${c.firstname || ""} ${c.lastname || ""}`).trim().toLowerCase() === "stephanie nealy" && c.bid === brandId && c.type === "client");
  if (matches.length !== 1) throw new Error("An exact, unique Stephanie Nealy account could not be identified.");
  const clientId = positiveId(matches[0].uid);
  if (!(await input.authorizeClient(clientId))) throw new Error("The test client is not linked to your workspace. Sync the existing client directory first.");
  const list = await read("orders", { uid: String(clientId) });
  if (!Array.isArray(list) || list.length > 2000) throw new Error("Order list is invalid or exceeds the validation limit.");
  const seen = new Set<number>();
  const candidates = list.map(record).filter(o => {
    const id = positiveId(o.oid);
    if (seen.has(id)) throw new Error("Duplicate order in the response. Review completeness before proceeding.");
    seen.add(id);
    if (positiveId(o.bid) !== brandId || typeof o.date !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(o.date)) throw new Error("Order brand or date could not be validated.");
    return o.date.startsWith("2026-10-");
  });
  if (candidates.length > 20) throw new Error("Historical test exceeds the 20-order validation limit.");
  const orders = [];
  for (const candidate of candidates) {
    const order = record(await read("order", { oid: String(candidate.oid) }));
    if (order.oid !== candidate.oid || order.bid !== brandId || order.sid !== candidate.sid || order.date !== candidate.date) throw new Error("Order changed or ownership fields do not match.");
    const site = record(await read("site", { sid: String(positiveId(order.sid)) }));
    if (site.sid !== order.sid || site.bid !== brandId) throw new Error("Property does not match the order brand.");
    if (!Array.isArray(order.tasks)) throw new Error("Order services are missing.");
    const tasks = order.tasks.map(record);
    orders.push({ orderId: order.oid, siteId: order.sid, date: order.date, totalCents: moneyCents(order.total),
      taxCents: moneyCents(order.taxamount), returnedCents: moneyCents(order.returned),
      address: [site.address, site.city, site.state].filter(Boolean).join(", "),
      siteOwnerMatches: !!site.user && record(site.user).uid === clientId,
      services: tasks.map(t => ({ name: String(t.name || ""), canceled: t.canceled === true })),
      hasCanceledTasks: tasks.some(t => t.canceled === true),
    });
  }
  const totalCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  return { client: "Stephanie Nealy", month: "2026-10", returnedOrderCount: list.length, orders, totalCents,
    matchesHistoricalReference: orders.length === 2 && totalCents === 136999 && orders.map(o => o.totalCents).sort((a,b) => a-b).join(",") === "34208,102791",
    reviewRequired: true,
    notes: ["Read-only diagnostic. No report was saved and no email was sent.", "October candidates use the API date prefix. Timezone and month-boundary behavior still need confirmation.", "Site owner is checked separately from the purchaser. The v1 schema does not expose an explicit billed-client ID.", "List completeness and canceled/returned amount semantics must be verified before automated generation."],
  };
}
