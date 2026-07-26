"use client";

import { useState } from "react";

const field = "mt-2 w-full rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[var(--helios-orange)]/60";
const label = "text-[0.56rem] font-semibold uppercase tracking-[.16em] text-white/35";

export default function ReferralForm({ token, testMode = false }: { token: string; testMode?: boolean }) {
  const [renderedAt] = useState(() => Date.now());
  const [submittedBy, setSubmittedBy] = useState<"ADVOCATE" | "REFERRED_PERSON">("ADVOCATE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const values = Object.fromEntries(data.entries());
      const response = await fetch(`/api/referrals/${testMode ? "test/" : ""}${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, renderedAt: Number(values.renderedAt), consent: values.consent === "true" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The referral could not be submitted.");
      setSuccess(result.message || "Thank you. Your introduction has been received.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The referral could not be submitted."); }
    finally { setBusy(false); }
  }
  if (success) return <div role="status" className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.04] p-7 sm:p-9"><p className="text-[0.56rem] uppercase tracking-[.18em] text-emerald-200/70">{testMode ? "Test completed" : "Referral received"}</p><h2 className="mt-4 font-serif text-3xl font-normal text-white">{testMode ? "The preview journey works." : "Thank you for the introduction."}</h2><p className="mt-5 text-sm leading-7 text-white/50">{success}</p></div>;
  const consent = submittedBy === "ADVOCATE"
    ? "I confirm I have permission to share this person’s contact information with Helios for this referral. This does not provide marketing consent on their behalf."
    : "I agree that Helios may contact me about this referral request. This does not enroll me in unrelated marketing.";
  return <form onSubmit={submit} className="rounded-2xl border border-white/[0.09] bg-[#11110f] p-6 shadow-2xl sm:p-8">
    <input type="hidden" name="renderedAt" value={renderedAt} /><input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    <fieldset><legend className={label}>Who is completing this form?</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["ADVOCATE", "REFERRED_PERSON"] as const).map(value => <label key={value} className={`cursor-pointer rounded-xl border p-4 text-sm transition ${submittedBy === value ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/[0.06] text-white" : "border-white/10 text-white/40"}`}><input type="radio" name="submittedBy" value={value} checked={submittedBy === value} onChange={() => setSubmittedBy(value)} className="sr-only" />{value === "ADVOCATE" ? "I’m making an introduction" : "I’m requesting contact for myself"}</label>)}</div></fieldset>
    <div className="mt-6 grid gap-5 sm:grid-cols-2"><Input name="firstName" title="First name" required /><Input name="lastName" title="Last name" required /><Input name="email" title="Email" type="email" required /><Input name="phone" title="Phone" type="tel" /><label className={label}>Preferred contact<select name="preferredContactMethod" className={field} defaultValue="EMAIL"><option value="EMAIL">Email</option><option value="PHONE">Phone</option><option value="TEXT">Text message</option></select></label><label className={`${label} sm:col-span-2`}>Optional message<textarea name="message" rows={4} className={field} /></label></div>
    <label className="mt-6 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><input name="consent" value="true" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--helios-orange)]" /><span className="text-xs leading-6 text-white/40">{consent}</span></label>
    {error && <p role="alert" className="mt-5 text-sm text-red-200">{error}</p>}
    <button disabled={busy} className="mt-6 w-full bg-[#c85f28] px-5 py-4 text-xs font-semibold uppercase tracking-[.16em] text-white transition hover:bg-[#d46a31] disabled:opacity-50">{busy ? "Sending…" : testMode ? "Complete test submission" : "Submit referral"}</button>
  </form>;
}

function Input({ title, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { title: string }) { return <label className={label}>{title}<input {...props} className={field} /></label>; }
