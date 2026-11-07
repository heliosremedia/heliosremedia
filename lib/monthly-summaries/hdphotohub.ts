import "server-only";
import { monthWindow, positiveId, record, type RecordData } from "./core";

export function connectionStatus() {
  return Boolean(process.env.HDPH_V3_TOKEN?.trim() && process.env.HDPH_SUMMARY_BRAND_ID && process.env.HDPH_SUMMARY_WORKSPACE_ID);
}
export function summaryConfiguration(workspaceId: string) {
  if (!connectionStatus()) throw new Error("Connect the HDPhotoHub v3 token, brand ID, and workspace before generating real summaries.");
  if (process.env.HDPH_SUMMARY_WORKSPACE_ID !== workspaceId) throw new Error("HDPhotoHub summaries are not configured for this workspace.");
  return { token: process.env.HDPH_V3_TOKEN!.trim(), brandId: positiveId(process.env.HDPH_SUMMARY_BRAND_ID) };
}

export function createSummaryReader(workspaceId: string) {
  const { token, brandId } = summaryConfiguration(workspaceId);
  const deadline = Date.now() + 240_000;
  // Only these documented read operations are reachable from this integration.
  async function request(path: string, body?: RecordData): Promise<RecordData> {
    if (!/^\/(order-views\/search|orders\/\d+\?expand=tasks,allowance|clients\/\d+)$/.test(path)) throw new Error("Unsupported summary read operation.");
    for (let attempt = 0; attempt < 3; attempt++) {
      if (Date.now() > deadline) throw new Error("HDPhotoHub reading timed out. No partial month was saved; retry generation.");
      let response: Response;
      try {
        response = await fetch(`https://api.hd.pics${path}`, {
          method: body ? "POST" : "GET", cache: "no-store", redirect: "error",
          headers: { "hd-token": token, Accept: "application/json", "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
        });
      } catch { throw new Error("HDPhotoHub could not be reached. No partial month was saved."); }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const seconds = Number(response.headers.get("retry-after") || "1");
        if (!Number.isFinite(seconds) || seconds > 10) throw new Error("HDPhotoHub is busy. Retry generation later.");
        await new Promise(resolve => setTimeout(resolve, Math.max(1, seconds) * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`HDPhotoHub read failed (${response.status}). Check token permissions and account access.`);
      return record(await response.json());
    }
    throw new Error("HDPhotoHub reading failed.");
  }
  return {
    brandId,
    async orders(month: string) {
      const { start, next } = monthWindow(month);
      // Deliberately fetch a wider window, then enforce exact Denver boundaries on UTC createDate.
      const from = new Date(start.getTime() - 86_400_000).toISOString().slice(0, 10);
      const to = `${next}-02`;
      const rows = new Map<number, RecordData>();
      let offset = 0;
      while (true) {
        const page = await request("/order-views/search", { createDateFrom: `${from}T00:00:00`, createDateTo: `${to}T00:00:00`, quantity: 100, offset, sort: "orderdate" });
        if (!Array.isArray(page.data)) throw new Error("HDPhotoHub returned an incomplete order page.");
        for (const value of page.data) {
          const row = record(value);
          if (positiveId(row.brandId) !== brandId) continue;
          const id = positiveId(row.orderId);
          if (rows.has(id) && JSON.stringify(rows.get(id)) !== JSON.stringify(row)) throw new Error("Orders changed during pagination. Retry generation.");
          rows.set(id, row);
        }
        if (rows.size > 2_000) throw new Error("This month exceeds the initial 2,000-order limit. Review before increasing scope.");
        if (page.nextOffset == null) break;
        const nextOffset = positiveId(page.nextOffset);
        if (nextOffset <= offset || nextOffset > 20_000) throw new Error("HDPhotoHub pagination did not complete safely.");
        offset = nextOffset;
      }
      const orders: RecordData[] = [];
      for (const [id, row] of rows) {
        const order = record((await request(`/orders/${id}?expand=tasks,allowance`)).data);
        if (positiveId(order.orderId) !== id || positiveId(order.brandId) !== brandId || positiveId(order.clientId) !== positiveId(row.clientId)) throw new Error("Order ownership changed or does not match the search result.");
        orders.push(order);
      }
      return orders;
    },
    async client(id: number) {
      positiveId(id);
      const response = await request(`/clients/${id}`);
      if (!Array.isArray(response.data) || response.data.length !== 1) throw new Error(`Client ${id}: account association could not be verified.`);
      const client = record(response.data[0]);
      if (positiveId(client.clientId) !== id || positiveId(client.brandId) !== brandId) throw new Error("Client does not match the configured brand.");
      return client;
    },
  };
}
