"use client";

import { useEffect, useRef, useState } from "react";

type Invitation = {
  event: { title: string; description: string; location: string; startsAt: string; endsAt: string | null; timeZone: string };
  response: "PENDING" | "YES" | "NO";
};

export default function RsvpResponse() {
  const token = useRef("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [choice, setChoice] = useState<"YES" | "NO" | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // Read once before clearing. The ref also survives React's development effect replay.
    if (!token.current) token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!token.current) { setError("This invitation link is missing or incomplete. Please open the original link in your invitation email."); setLoading(false); return; }
    let active = true;
    fetch("/api/events/rsvp", { headers: { Authorization: `Bearer ${token.current}` }, cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async response => { const data = await response.json(); if (!response.ok || data.success === false) throw new Error(data.error || "This invitation is no longer available."); return data; })
      .then(data => { if (active) { setInvitation(data); setChoice(data.response === "YES" || data.response === "NO" ? data.response : ""); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit() {
    if (!choice || busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/events/rsvp", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, response: choice }) });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || "Your response could not be saved. Please try again.");
      setInvitation(data); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  const format = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: invitation?.event.timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
  return <main className="min-h-screen bg-[#0c0c0c] px-5 py-16 text-white sm:py-24"><div className="mx-auto max-w-xl">
    <p className="text-xs uppercase tracking-[0.3em] text-[var(--helios-orange)]">Helios · You’re invited</p>
    <div className="mt-8 rounded-3xl border border-white/10 bg-[#141414] p-6 sm:p-10">
      {loading && <p role="status" className="text-sm text-white/60">Opening your invitation…</p>}
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-200/20 bg-red-200/5 p-4 text-sm leading-6 text-red-100">{error}</p>}
      {invitation && <><h1 className="text-3xl font-light leading-tight sm:text-4xl">{invitation.event.title}</h1><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-white/65">{invitation.event.description}</p><dl className="mt-8 space-y-5 border-y border-white/10 py-6"><div><dt className="text-xs uppercase tracking-widest text-white/40">When</dt><dd className="mt-2 text-sm leading-6">{format(invitation.event.startsAt)}{invitation.event.endsAt && <span className="block">Until {format(invitation.event.endsAt)}</span>}<span className="block text-xs text-white/45">{invitation.event.timeZone}</span></dd></div><div><dt className="text-xs uppercase tracking-widest text-white/40">Where</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6">{invitation.event.location || "Details to follow"}</dd></div></dl>
        {saved ? <div role="status" className="mt-6 rounded-xl border border-emerald-200/20 bg-emerald-200/5 p-4"><p className="text-emerald-100">{invitation.response === "YES" ? "You’re on the guest list. See you there!" : "Thanks for letting us know."}</p><p className="mt-2 text-sm text-white/60">Your response has been saved. You can change it below or return using the link in your email.</p></div> : invitation.response !== "PENDING" && <p className="mt-6 text-sm text-white/65">Your current response: <strong className="text-white">{invitation.response === "YES" ? "Yes, I’ll be there" : "No, I can’t make it"}</strong>. You can update it below.</p>}
        <form className="mt-7" onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy}><legend className="text-lg font-light">Will you join us?</legend><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["YES", "Yes, I’ll be there"], ["NO", "No, I can’t make it"]].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition ${choice === value ? "border-orange-300/60 bg-orange-300/10" : "border-white/15 hover:border-white/35"}`}><input type="radio" name="response" required value={value} checked={choice === value} onChange={() => { setChoice(value as "YES" | "NO"); setSaved(false); }} />{label}</label>)}</div></fieldset><button type="submit" disabled={!choice || busy} className="mt-5 w-full rounded-xl bg-[var(--helios-orange)] px-5 py-3.5 text-sm font-medium text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving your response…" : invitation.response === "PENDING" ? "Send RSVP" : "Update RSVP"}</button><p className="mt-4 text-xs leading-5 text-white/40">Your response is recorded only when you submit. This invitation link is personal, so please don’t forward it.</p></form>
      </>}
    </div><p className="mt-6 text-center text-xs text-white/30">Thoughtfully brought together by Helios.</p>
  </div></main>;
}
