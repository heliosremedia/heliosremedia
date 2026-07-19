"use client";

import { useState } from "react";

export default function ClientAccessForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    try {
      const response = await fetch("/api/client-portal/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.redirectUrl) { window.location.assign(result.redirectUrl); return; }
      setSuccess(true); setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Client access could not be started."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-10 border-t border-white/10 pt-8">
    <label className="block text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/35" htmlFor="client-email">Client email address</label>
    <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="client-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="min-h-14 flex-1 rounded-sm border border-white/12 bg-black/30 px-5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]" /><button disabled={busy} className="min-h-14 rounded-sm bg-[var(--helios-orange)] px-7 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--helios-orange-hover)] disabled:opacity-50">{busy ? "Checking…" : "Continue securely"}</button></div>
    <p className="mt-4 text-xs leading-5 text-white/30">We’ll look up this email in the connected client system. Existing clients receive a secure dashboard link; new clients can verify their email and finish creating an account.</p>
    {message && <p role="status" className={`mt-5 rounded-sm border px-4 py-3 text-sm ${success ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80" : "border-red-300/20 bg-red-300/[0.05] text-red-200/75"}`}>{message}</p>}
  </form>;
}
