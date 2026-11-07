"use client";
import { useState } from "react";
import type { checkExistingConnection } from "@/lib/monthly-summaries/v1-check";
type Result = Awaited<ReturnType<typeof checkExistingConnection>>;
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function VerifyConnection() {
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState("2026-10");
  const [expectedTotal, setExpectedTotal] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setResult(null); setError("");
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(expectedTotal)) throw new Error("Enter the expected purchase total.");
      const response = await fetch("/api/admin/monthly-summaries/connection-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName, month, expectedTotalCents: Math.round(Number(expectedTotal) * 100) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The check failed.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "The check failed."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-6 rounded-2xl border border-white/10 bg-[#111] p-6 text-white/80">
    <div><h2 className="text-xl text-white">Historical order verification</h2><p className="mt-2 text-sm text-white/50">Enter an exact client name and a total you have already checked in HDPhotoHub.</p><p className="mt-2 text-sm text-white/50">This check only reads data. It does not change orders, save reports, or send emails.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Client name<input value={clientName} onChange={e => setClientName(e.target.value)} maxLength={150} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
      <label className="text-sm">Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
      <label className="text-sm">Expected total ($)<input inputMode="decimal" value={expectedTotal} onChange={e => setExpectedTotal(e.target.value)} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
    </div>
    <button disabled={busy || !clientName.trim() || !month || !expectedTotal} onClick={run} className="rounded-lg bg-[#d96b2b] px-5 py-3 font-medium text-black disabled:opacity-50">{busy ? "Checking orders…" : "Run read-only check"}</button>
    {error && <p role="alert" className="rounded-lg bg-red-300/10 p-4 text-red-100">{error}</p>}
    {result && <div className="space-y-5"><p role="status" className="text-lg">{result.matchesHistoricalReference ? "Historical amounts match" : "Historical amounts need review"} · {usd(result.totalCents)}</p><p className="text-sm text-white/50">{result.returnedOrderCount} orders returned for the account; {result.orders.length} month candidates.</p>
      {result.orders.map(order => <article key={String(order.orderId)} className="space-y-2 rounded-xl border border-white/10 p-4"><h3 className="font-medium text-white">{order.address}</h3><p>{usd(order.totalCents)}</p><p className="text-sm text-white/50">Order {String(order.orderId)} · {String(order.date)}</p><ul className="list-disc pl-5 text-sm">{order.services.map((service,i) => <li key={i}>{service.name}{service.canceled ? " (canceled)" : ""}</li>)}</ul><p className="text-xs text-white/50">Tax: {order.taxCents === null ? "Not supplied" : usd(order.taxCents)} · Returned amount: {order.returnedCents === null ? "Not supplied" : usd(order.returnedCents)} · Property owner matches: {order.siteOwnerMatches ? "Yes" : "No"}</p></article>)}
      <ul className="list-disc space-y-2 pl-5 text-sm text-amber-100/80">{result.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </div>}
  </section>;
}
