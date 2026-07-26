"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"READY" | "BUSY" | "DONE" | "ERROR">("READY");
  const [reason, setReason] = useState("");
  async function unsubscribe() {
    setState("BUSY");
    const response = await fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, reason }) });
    setState(response.ok ? "DONE" : "ERROR");
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#0b0b0b] px-6 text-white"><section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#121211] p-8 text-center sm:p-10"><p className="eyebrow text-[var(--helios-orange)]">Helios Real Estate Media</p><h1 className="mt-5 font-display text-4xl font-light">Email preferences</h1>{state === "DONE" ? <><p className="mt-6 text-white/65">You have been unsubscribed from Helios marketing emails.</p><p className="mt-3 text-sm leading-6 text-white/35">Transactional project, billing, security, and account messages may still be delivered when necessary.</p></> : <><p className="mt-6 text-sm leading-7 text-white/45">Stop receiving newsletters, referral promotions, company updates, and special offers. Transactional service messages remain separate.</p><label className="mt-6 block text-left text-xs text-white/40">Reason (optional)<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]" /></label>{state === "ERROR" && <p className="mt-4 text-sm text-red-300">This link is invalid, expired, or could not be completed.</p>}<button disabled={!token || state === "BUSY"} onClick={unsubscribe} className="admin-btn-primary mt-8">{state === "BUSY" ? "Updating…" : "Unsubscribe from marketing"}</button></>}</section></main>;
}

export default function UnsubscribePage() {
  return <Suspense><UnsubscribeForm /></Suspense>;
}
