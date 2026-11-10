"use client";

import { useEffect, useRef, useState } from "react";
import { getEventTheme } from "@/lib/events/themes";
import EventMotif from "../EventMotif";
import { initialAdditionalGuests, initialRsvpChoice, MAX_ADDITIONAL_GUESTS, parseAdditionalGuests, readRsvpFragment, rsvpPartySummary, type RsvpChoice } from "./response-helpers";

type Invitation = {
  event: { title: string; description: string; location: string; venueUrl?: string | null; startsAt: string; endsAt: string | null; timeZone: string; templateKey?: string; imageUrl?: string | null; imageAlt?: string | null };
  response: "PENDING" | RsvpChoice;
  additionalGuests?: number;
};
const choices = [{ value: "YES", label: "Yes", detail: "I’ll be there" }, { value: "NO", label: "No", detail: "I can’t make it" }, { value: "MAYBE", label: "Maybe", detail: "I’m not sure yet" }] as const;

export default function RsvpResponse() {
  const token = useRef("");
  const requestedChoice = useRef<RsvpChoice | "">("");
  const submitting = useRef(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [choice, setChoice] = useState<RsvpChoice | "">("");
  const [additionalGuests, setAdditionalGuests] = useState("0");
  const [guestCountError, setGuestCountError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    // Keep credentials in memory, never in queries, image URLs, or referrers.
    // Refs survive React's development effect replay after the fragment is cleared.
    if (!token.current) {
      const fragment = readRsvpFragment(window.location.hash);
      token.current = fragment.token;
      requestedChoice.current = fragment.choice;
    }
    window.history.replaceState(null, "", window.location.pathname);
    if (!token.current) { setError("This invitation link is missing or incomplete. Please open the original link in your invitation email."); setLoading(false); return; }
    const controller = new AbortController();
    fetch("/api/events/rsvp", { signal: controller.signal, headers: { Authorization: `Bearer ${token.current}` }, cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async response => { const data = await response.json(); if (!response.ok || data.success === false) throw new Error(data.error || "This invitation is no longer available."); return data; })
      .then(data => { if (!controller.signal.aborted) {
        const initialChoice = initialRsvpChoice(requestedChoice.current, data.response);
        setInvitation(data); setChoice(initialChoice); setAdditionalGuests(initialAdditionalGuests(initialChoice, data.additionalGuests));
      } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit() {
    if (!choice || busy || submitting.current) return;
    const guestCount = parseAdditionalGuests(choice, additionalGuests);
    if (guestCount === null) { setGuestCountError(`Enter a whole number from 0 to ${MAX_ADDITIONAL_GUESTS}.`); return; }
    submitting.current = true;
    setGuestCountError("");
    setBusy(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/events/rsvp", { method: "POST", cache: "no-store", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, response: choice, additionalGuests: guestCount }) });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || "Your response could not be saved. Please try again.");
      setInvitation(data); setChoice(initialRsvpChoice("", data.response)); setAdditionalGuests(initialAdditionalGuests(data.response, data.additionalGuests)); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { submitting.current = false; setBusy(false); }
  }

  const theme = getEventTheme(invitation?.event.templateKey);
  const format = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: invitation?.event.timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
  return <main className="min-h-screen px-4 py-10 sm:px-6 sm:py-16" style={{ background: theme.background, color: theme.text }}><div className="mx-auto max-w-2xl">
    <p className="text-center text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>Helios · You’re invited</p>
    <div className="mt-6 overflow-hidden rounded-3xl border shadow-[0_18px_70px_rgba(0,0,0,0.08)]" style={{ borderColor: theme.border, background: theme.surface }}>
      <div className="h-1" style={{ background: theme.accent }} />
      {invitation?.event.imageUrl && <>
        {/* Direct first-party image: no optimizer and no invitation token in the referrer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={invitation.event.imageUrl} alt={invitation.event.imageAlt || invitation.event.title} referrerPolicy="no-referrer" className="block h-auto w-full" />
      </>}
      <div className="p-6 sm:p-10">
        {loading && <p role="status" className="text-sm" style={{ color: theme.muted }}>Opening your invitation…</p>}
        {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6">{error}</p>}
        {invitation && <>
          <div className="mb-6 flex items-center justify-between gap-3" style={{ color: theme.accent }}><p className="text-[10px] uppercase leading-6 tracking-[0.2em]">{theme.motif}</p><EventMotif templateKey={theme.key} className="h-16 w-24 shrink-0" /></div>
          <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-normal leading-tight sm:text-5xl" style={{ color: theme.heading }}>{invitation.event.title}</h1>
          <p className="mt-5 whitespace-pre-wrap text-sm leading-7">{invitation.event.description}</p>
          <dl className="mt-8 space-y-5 border-y py-6" style={{ borderColor: theme.border }}><div><dt className="text-[10px] uppercase tracking-widest" style={{ color: theme.muted }}>When</dt><dd className="mt-2 text-sm leading-6">{format(invitation.event.startsAt)}{invitation.event.endsAt && <span className="block">Until {format(invitation.event.endsAt)}</span>}<span className="block text-xs" style={{ color: theme.muted }}>{invitation.event.timeZone}</span></dd></div><div><dt className="text-[10px] uppercase tracking-widest" style={{ color: theme.muted }}>Where</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6">{invitation.event.location || "Details to follow"}{invitation.event.venueUrl && <a href={invitation.event.venueUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-2 block w-fit underline underline-offset-4" style={{ color: theme.accent }}>Visit venue website ↗</a>}</dd></div></dl>
          {saved ? <div role="status" className="mt-6 rounded-xl border p-4" style={{ borderColor: theme.accent }}><p className="font-medium" style={{ color: theme.heading }}>{invitation.response === "YES" ? "You’re on the guest list. See you there!" : invitation.response === "MAYBE" ? "You’re down as a maybe. Thanks for letting us know!" : "Thanks for letting us know."}</p><p className="mt-2 text-sm leading-6" style={{ color: theme.heading }}>{rsvpPartySummary(invitation.response, invitation.additionalGuests)}</p><p className="mt-2 text-sm leading-6" style={{ color: theme.muted }}>Your response has been saved. You can change it below or return using the link in your email.</p></div> : invitation.response !== "PENDING" && <p className="mt-6 text-sm" style={{ color: theme.muted }}>Your current response: <strong style={{ color: theme.heading }}>{choices.find(option => option.value === invitation.response)?.label}</strong>. <span className="mt-2 block">{rsvpPartySummary(invitation.response, invitation.additionalGuests)}</span>You can update it below.</p>}
          <form className="mt-7" onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy}><legend className="text-2xl font-light" style={{ color: theme.heading }}>Will you join us?</legend><div className="mt-4 grid gap-3 sm:grid-cols-3">{choices.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition hover:brightness-110 focus-within:outline-2 focus-within:outline-offset-2" style={{ borderColor: choice === option.value ? theme.accent : theme.border, outlineColor: theme.accent, background: choice === option.value ? `${theme.accent}12` : undefined }}><input type="radio" name="response" required value={option.value} checked={choice === option.value} style={{ accentColor: theme.accent }} onChange={() => { setChoice(option.value); if (option.value === "NO") setAdditionalGuests("0"); setGuestCountError(""); setSaved(false); }} /><span><span className="block text-sm font-medium" style={{ color: theme.heading }}>{option.label}</span><span className="mt-1 block text-[11px]" style={{ color: theme.muted }}>{option.detail}</span></span></label>)}</div>
            {(choice === "YES" || choice === "MAYBE") && <div className="mt-6 rounded-xl border p-4 sm:p-5" style={{ borderColor: theme.border }}>
              <label htmlFor="additional-guests" className="block text-sm font-medium" style={{ color: theme.heading }}>How many guests will you bring?</label>
              <p id="additional-guests-help" className="mt-2 text-xs leading-5" style={{ color: theme.muted }}>Count only the people coming with you. Choose 0 if it’s just you.</p>
              <input id="additional-guests" name="additionalGuests" type="number" inputMode="numeric" required min={0} max={MAX_ADDITIONAL_GUESTS} step={1} value={additionalGuests} aria-describedby={`additional-guests-help additional-guests-total${guestCountError ? " additional-guests-error" : ""}`} aria-invalid={guestCountError ? true : undefined} className="mt-3 w-28 rounded-lg border px-3 py-2.5 text-base outline-offset-2 focus-visible:outline-2 disabled:opacity-50" style={{ borderColor: theme.border, background: theme.background, color: theme.text, outlineColor: theme.accent }} onChange={e => { setAdditionalGuests(e.target.value); setGuestCountError(""); setSaved(false); }} />
              <p id="additional-guests-total" aria-live="polite" className="mt-3 text-sm" style={{ color: theme.heading }}>{parseAdditionalGuests(choice, additionalGuests) !== null ? rsvpPartySummary(choice, Number(additionalGuests)) : "Enter the number of guests to see your party size."}</p>
              {guestCountError && <p id="additional-guests-error" role="alert" className="mt-2 text-sm">{guestCountError}</p>}
            </div>}
            </fieldset>
            <button type="submit" disabled={!choice || busy} className="mt-5 w-full rounded-xl px-5 py-3.5 text-sm font-medium transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: theme.accent, color: theme.buttonText, outlineColor: theme.accent }}>{busy ? "Saving your response…" : invitation.response === "PENDING" ? "Confirm RSVP" : "Update RSVP"}</button><p className="mt-4 text-xs leading-5" style={{ color: theme.muted }}>Your response is recorded only when you submit. This invitation link is personal, so please don’t forward it.</p>
          </form>
        </>}
      </div>
    </div><p className="mt-6 text-center text-xs" style={{ color: theme.muted }}>Thoughtfully brought together by Helios.</p>
  </div></main>;
}
