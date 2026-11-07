"use client";
import { useState } from "react";
import type { checkExistingConnection } from "@/lib/monthly-summaries/v1-check";
type Result = Awaited<ReturnType<typeof checkExistingConnection>>;
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export default function VerifyConnection() {
  const [clientName, setClientName] = useState("");
  const [month, setMonth] = useState("2026-10");
  const [expectedTotal, setExpectedTotal] = useState("");
  const [preview, setPreview] = useState<{html: string; pdf: string; filename: string; token: string; notes: string[]} | null>(null);
  const [testAttempted, setTestAttempted] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setBusy(true); setResult(null); setPreview(null); setError("");
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(expectedTotal)) throw new Error("Enter the expected purchase total.");
      const response = await fetch("/api/admin/monthly-summaries/connection-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName, month, expectedTotalCents: Math.round(Number(expectedTotal) * 100) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The check failed.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "The check failed."); }
    finally { setBusy(false); }
  }
  async function preparePreview() {
    setBusy(true); setError(""); setMessage(""); setPreview(null);
    try {
      if (!/^\d+(\.\d{1,2})?$/.test(expectedTotal)) throw new Error("Enter the expected purchase total.");
      const response = await fetch("/api/admin/monthly-summaries/internal-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", clientName, month, expectedTotalCents: Math.round(Number(expectedTotal) * 100) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPreview(data); setTestAttempted(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  async function sendTest() {
    if (!preview) return;
    setBusy(true); setError(""); setTestAttempted(true);
    try {
      const response = await fetch("/api/admin/monthly-summaries/internal-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", token: preview.token }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(`${data.message} Resend ID: ${data.messageId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Test delivery not confirmed. Check Resend before another attempt."); }
    finally { setBusy(false); }
  }
  function downloadPdf() {
    if (!preview) return;
    const bytes = Uint8Array.from(atob(preview.pdf), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = preview.filename;
    document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return <section className="space-y-6 rounded-2xl border border-white/10 bg-[#111] p-6 text-white/80">
    <div><h2 className="text-xl text-white">Historical order verification</h2><p className="mt-2 text-sm text-white/50">Enter an exact client name and a total you have already checked in HDPhotoHub.</p><p className="mt-2 text-sm text-white/50">This check only reads data. It does not change orders, save reports, or send emails.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm">Client name<input value={clientName} disabled={busy} onChange={e => { setClientName(e.target.value); setPreview(null); setResult(null); }} maxLength={150} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
      <label className="text-sm">Month<input type="month" value={month} disabled={busy} onChange={e => { setMonth(e.target.value); setPreview(null); setResult(null); }} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
      <label className="text-sm">Expected total ($)<input inputMode="decimal" value={expectedTotal} disabled={busy} onChange={e => { setExpectedTotal(e.target.value); setPreview(null); setResult(null); }} className="mt-2 block w-full rounded-lg border border-white/20 bg-black p-3" /></label>
    </div>
    <button disabled={busy || !clientName.trim() || !month || !expectedTotal} onClick={run} className="rounded-lg bg-[#d96b2b] px-5 py-3 font-medium text-black disabled:opacity-50">{busy ? "Checking orders…" : "Run read-only check"}</button>
    <button disabled={busy || testAttempted || !clientName.trim() || !month || !expectedTotal} onClick={preparePreview} className="ml-3 rounded-lg border border-white/20 px-5 py-3 disabled:opacity-50">Build email + PDF preview</button>
    {message && <p role="status" className="rounded-lg bg-emerald-300/10 p-4 text-emerald-100">{message}</p>}
    {preview && <div className="space-y-4"><h2 className="text-xl text-white">Internal review preview</h2><p className="text-sm text-white/50">The email and PDF use the same preview, valid for 30 minutes. Testing sends only to the configured internal test inbox. Review notes remain here and are not included in the client design.</p><div className="flex flex-wrap gap-3"><button onClick={downloadPdf} className="rounded-lg border border-white/20 px-4 py-3">Download PDF</button><button disabled={busy || testAttempted} onClick={sendTest} className="rounded-lg bg-[#d96b2b] px-4 py-3 text-black disabled:opacity-50">{testAttempted ? "Test requested · check status" : "Send email + PDF to Jake"}</button></div><iframe title="Real-data monthly email preview" sandbox="" srcDoc={preview.html} className="h-[1050px] w-full border-0 bg-[#e8e2d7]" /><ul className="list-disc space-y-2 pl-5 text-sm text-amber-100/80">{preview.notes.map(note => <li key={note}>{note}</li>)}</ul></div>}
    {error && <p role="alert" className="rounded-lg bg-red-300/10 p-4 text-red-100">{error}</p>}
    {result && <div className="space-y-5"><p role="status" className="text-lg">{result.matchesHistoricalReference ? "Historical amounts match" : "Historical amounts need review"} · {usd(result.totalCents)}</p><p className="text-sm text-white/50">{result.returnedOrderCount} orders returned for the account; {result.orders.length} month candidates.</p>
      {result.orders.map(order => <article key={String(order.orderId)} className="space-y-2 rounded-xl border border-white/10 p-4"><h3 className="font-medium text-white">{order.address}</h3><p>{usd(order.totalCents)}</p><p className="text-sm text-white/50">Order {String(order.orderId)} · {String(order.date)}</p><ul className="list-disc pl-5 text-sm">{order.services.map((service,i) => <li key={i}>{service.name}{service.canceled ? " (canceled)" : ""}</li>)}</ul><p className="text-xs text-white/50">Tax: {order.taxCents === null ? "Not supplied" : usd(order.taxCents)} · Returned amount: {order.returnedCents === null ? "Not supplied" : usd(order.returnedCents)} · Property owner matches: {order.siteOwnerMatches ? "Yes" : "No"}</p></article>)}
      <ul className="list-disc space-y-2 pl-5 text-sm text-amber-100/80">{result.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </div>}
  </section>;
}
