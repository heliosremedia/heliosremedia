"use client";

import { useState } from "react";

export default function RegistrationForm() {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/client-portal/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); window.location.assign(result.redirectUrl); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Account creation failed."); }
    finally { setBusy(false); }
  }
  const input = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2"><label className="text-xs uppercase tracking-[0.16em] text-white/35">First name<input required autoComplete="given-name" value={form.firstName} onChange={(e) => input("firstName", e.target.value)} className="mt-2 min-h-14 w-full border border-white/12 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-xs uppercase tracking-[0.16em] text-white/35">Last name<input required autoComplete="family-name" value={form.lastName} onChange={(e) => input("lastName", e.target.value)} className="mt-2 min-h-14 w-full border border-white/12 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-xs uppercase tracking-[0.16em] text-white/35 sm:col-span-2">Phone <span className="normal-case tracking-normal text-white/20">(optional)</span><input autoComplete="tel" value={form.phone} onChange={(e) => input("phone", e.target.value)} className="mt-2 min-h-14 w-full border border-white/12 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label><label className="text-xs uppercase tracking-[0.16em] text-white/35 sm:col-span-2">Create password<input required type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={(e) => input("password", e.target.value)} className="mt-2 min-h-14 w-full border border-white/12 bg-black/25 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /><span className="mt-2 block text-[0.68rem] normal-case leading-5 tracking-normal text-white/25">At least 10 characters with a letter and number.</span></label>{message && <p className="text-sm text-red-200/75 sm:col-span-2">{message}</p>}<button disabled={busy} className="mt-2 min-h-14 bg-[var(--helios-orange)] px-6 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50 sm:col-span-2">{busy ? "Creating account…" : "Create account & open dashboard"}</button></form>;
}
