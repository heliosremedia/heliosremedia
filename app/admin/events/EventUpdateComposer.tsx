"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { displayDate } from "./ui-helpers";
import {
  EVENT_UPDATE_AUDIENCES, createEventUpdateRequestKey, eventUpdateCopyError,
  eventUpdateHistory, eventUpdatePreviewDocument, eventUpdateSendTime, eventUpdateStatus,
  insertUpdateFirstName, type EventUpdateDraft, type EventUpdateEvent,
} from "./event-update-composer";

const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)] disabled:opacity-50";
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} border-orange-400/40 bg-[var(--helios-orange)] text-black hover:brightness-110`;
type Preview = { subject: string; html: string; audienceCount: number };

/** Keep additional updates separate from the invitation's three-stage delivery plan. */
export default function EventUpdateComposer<TEvent extends EventUpdateEvent>({ event, defaultTestEmail, disabled = false, onEventChange }: {
  event: TEvent;
  defaultTestEmail: string;
  disabled?: boolean;
  onEventChange: (event: TEvent) => void;
}) {
  const [draft, setDraft] = useState<EventUpdateDraft>(() => ({ subject: `${event.title} · Event update`.slice(0, 200), body: "", audience: "" }));
  const [schedule, setSchedule] = useState("");
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewWidth, setPreviewWidth] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [confirmed, setConfirmed] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "test" | "schedule" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const requestKey = useRef(createEventUpdateRequestKey(() => crypto.randomUUID()));
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<{ field: "subject" | "body"; position: number } | null>(null);
  const history = eventUpdateHistory(event.deliveries);
  const locked = disabled || busy !== null;
  const canCompose = event.status === "SCHEDULED";
  const copyError = eventUpdateCopyError(draft);
  const audience = EVENT_UPDATE_AUDIENCES.find(option => option.value === draft.audience);
  let scheduledAt = "", timeError = "";
  if (schedule) {
    try { scheduledAt = eventUpdateSendTime(schedule, event); }
    catch (cause) { timeError = cause instanceof Error ? cause.message : "Choose a valid delivery time."; }
  }

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (!caret) return;
    const element = caret.field === "subject" ? subjectRef.current : bodyRef.current;
    element?.focus(); element?.setSelectionRange(caret.position, caret.position);
  }, [draft]);

  function changeDraft<K extends keyof EventUpdateDraft>(field: K, value: EventUpdateDraft[K]) {
    if (pending.current || disabled) return;
    setDraft(previous => ({ ...previous, [field]: value }));
    setPreview(null); setConfirmed(false); setScheduled(false); setError(""); setMessage("");
  }
  function insertName(field: "subject" | "body") {
    if (locked) return;
    const element = field === "subject" ? subjectRef.current : bodyRef.current;
    const insertion = insertUpdateFirstName(draft[field], field, element?.selectionStart ?? draft[field].length, element?.selectionEnd ?? draft[field].length);
    if (insertion.error) { setError(insertion.error); return; }
    pendingCaret.current = { field, position: insertion.caret };
    changeDraft(field, insertion.text);
  }

  async function act(action: "preview" | "test" | "schedule" | "cancel", deliveryId?: string) {
    // A ref closes the same-render double-click gap before React disables the buttons.
    if (pending.current || disabled) return;
    if (action !== "cancel" && (!canCompose || copyError)) { setError(copyError || "Schedule the initial invitation before preparing an update."); return; }
    if (action === "test" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) { setError("Enter a valid test recipient email address."); return; }
    if (action === "cancel" && (!deliveryId || cancelId !== deliveryId || !history.some(item => item.id === deliveryId && item.status === "SCHEDULED"))) return;
    let sendAt = "";
    if (action === "schedule") {
      if (!confirmed || !preview || preview.audienceCount === 0 || scheduled) { setError("Preview this update, then confirm its audience, message and delivery time."); return; }
      try { sendAt = eventUpdateSendTime(schedule, event); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Choose a valid delivery time."); return; }
    }
    pending.current = true; setBusy(action); setError(""); setMessage("");
    try {
      const payload = action === "cancel" ? { action, deliveryId, confirm: true } : {
        action, ...draft,
        ...(action === "test" ? { testEmail: testEmail.trim(), confirm: true } : {}),
        ...(action === "schedule" ? {
          scheduledAt: sendAt, confirm: true,
          requestId: requestKey.current.forPayload({ eventId: event.id, ...draft, scheduledAt: sendAt }),
        } : {}),
      };
      const response = await fetch(`/api/admin/events/${encodeURIComponent(event.id)}/updates`, {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || data.message || "The update request could not be completed.");
      if (!mounted.current) return;
      if (action === "preview") {
        if (typeof data.html !== "string" || typeof data.subject !== "string" || !Number.isInteger(data.audienceCount) || data.audienceCount < 0) throw new Error("The update preview could not be loaded.");
        setPreview({ html: data.html, subject: data.subject, audienceCount: data.audienceCount }); setConfirmed(false);
      } else if (action === "test") {
        setMessage(data.message || `Test submitted to ${testEmail.trim()}. No guest update was scheduled.`);
      } else {
        if (!data.event || data.event.id !== event.id) throw new Error("The updated delivery history could not be loaded.");
        onEventChange(data.event as TEvent);
        setMessage(data.message || (action === "cancel" ? "Pending update cancelled. The original three emails are unchanged." : "Additional update scheduled. The original three emails are unchanged."));
        setConfirmed(false); setCancelId(null);
        if (action === "schedule") setScheduled(true);
      }
    } catch (cause) {
      if (mounted.current) {
        const detail = cause instanceof Error ? cause.message : "The update request could not be completed.";
        setError(action === "schedule" ? `${detail} If delivery status is uncertain, refresh the event to check its history. Retrying the unchanged schedule uses the same request ID to prevent duplicates.` : detail);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return <section className="space-y-5 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6" aria-labelledby={`event-update-title-${event.id}`}>
    <div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">Additional follow-up</p><h3 id={`event-update-title-${event.id}`} className="mt-2 text-lg text-white">Send an event update</h3><p className="mt-2 text-sm leading-6 text-white/55">Share an extra note, such as bringing a guest or updating a party size. This is separate from your initial invitation, 14-day follow-up and day-before reminder.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm leading-6 text-red-200">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm leading-6 text-emerald-200">{message}</p>}
    {!canCompose ? <p className="text-sm text-white/50">{event.status === "CANCELLED" ? "This event is cancelled. No more updates can be scheduled." : "Schedule the initial invitation first. Updates go only to guests who have received it."}</p> : <>
      <fieldset disabled={locked} className="space-y-4">
        <legend className="sr-only">Additional event update content</legend>
        <label className="block text-sm text-white/70">Update audience<select className={input} value={draft.audience} onChange={e => changeDraft("audience", e.target.value as EventUpdateDraft["audience"])}><option value="">Choose an audience</option>{EVENT_UPDATE_AUDIENCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-2 block text-xs leading-5 text-white/45">{audience?.detail || "Choose the guests who need this note."} Only subscribed, eligible guests who received the initial invitation can receive updates. RSVP responses and eligibility are checked again at delivery.</span></label>
        <div><label className="block text-sm text-white/70">Update subject<input ref={subjectRef} className={input} maxLength={200} value={draft.subject} onChange={e => changeDraft("subject", e.target.value)} /></label><button type="button" className={`${button} mt-2 text-xs`} aria-label="Insert first name into update subject" onMouseDown={e => e.preventDefault()} onClick={() => insertName("subject")}>Insert first name</button></div>
        <div><label className="block text-sm text-white/70">Update message<textarea ref={bodyRef} className={input} rows={6} maxLength={3000} value={draft.body} placeholder="What would you like your guests to know?" onChange={e => changeDraft("body", e.target.value)} /><span className="mt-2 block text-xs text-white/45">Plain text · {draft.body.length.toLocaleString()} / 3,000 characters. Your event details and each guest’s existing private RSVP link are included automatically.</span></label><button type="button" className={`${button} mt-2 text-xs`} aria-label="Insert first name into update message" onMouseDown={e => e.preventDefault()} onClick={() => insertName("body")}>Insert first name</button></div>
        <p className="text-xs leading-5 text-white/45">{"Use {{FIRST_NAME}} for a guest’s first name. Preview and test emails use Alex. Missing names become “there.” Changes here do not edit the three original messages."}</p>
        <button type="button" className={button} disabled={locked || !!copyError} onClick={() => void act("preview")}>{busy === "preview" ? "Loading preview…" : "Preview update"}</button>
      </fieldset>
      {preview && <div className="overflow-hidden rounded-xl border border-white/15">
        <div className="space-y-3 bg-white/5 p-3"><p className="text-sm text-white/80">Subject: {preview.subject}</p><p className="text-xs text-white/55">{preview.audienceCount} currently eligible {preview.audienceCount === 1 ? "recipient" : "recipients"} · {audience?.label}</p><div className="flex flex-wrap items-center gap-2" aria-label="Update preview width">{(["DESKTOP", "MOBILE"] as const).map(width => <button key={width} type="button" aria-pressed={previewWidth === width} className={button} onClick={() => setPreviewWidth(width)}>{width === "DESKTOP" ? "Desktop" : "Mobile"}</button>)}<button type="button" className={button} disabled={locked} onClick={() => { setPreview(null); setConfirmed(false); }}>Close preview</button></div></div>
        <div className="bg-black/30 p-2 sm:p-4"><iframe title="Additional event update preview" sandbox="" referrerPolicy="no-referrer" srcDoc={eventUpdatePreviewDocument(preview.html)} className="mx-auto h-[580px] w-full bg-white transition-[max-width]" style={{ maxWidth: previewWidth === "MOBILE" ? 375 : 760 }} /></div><p className="bg-white/5 px-3 py-2 text-xs leading-5 text-white/45">Preview only. Links are disabled and no email has been sent.</p>
      </div>}
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void act("test"); }}>
        <label className="min-w-0 flex-1 text-sm text-white/70">Update test recipient<input className={input} type="email" required maxLength={254} disabled={locked} value={testEmail} onChange={e => setTestEmail(e.target.value)} /></label><button className={button} disabled={locked || !!copyError} type="submit">{busy === "test" ? "Sending test…" : "Send update test only"}</button>
      </form>
      <p className="text-xs leading-5 text-white/45">A test sends only to the address above. Its RSVP links are disabled and it does not change the guest list or delivery plan.</p>
      <form className="space-y-4 border-t border-white/10 pt-5" onSubmit={e => { e.preventDefault(); void act("schedule"); }}>
        <label className="block text-sm text-white/70">Send additional update at<input className={input} required type="datetime-local" disabled={locked} value={schedule} onChange={e => { if (pending.current) return; setSchedule(e.target.value); setConfirmed(false); setScheduled(false); setError(""); setMessage(""); }} /><span className="mt-2 block text-xs text-white/45">Times use {event.timeZone}. Choose at least one minute ahead and before the event starts.</span></label>
        {timeError && <p className="text-xs text-amber-200">{timeError}</p>}
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><p>Audience: <strong className="font-medium text-white/85">{audience?.label || "Choose an audience"}</strong>{preview ? ` · ${preview.audienceCount} currently eligible` : ""}</p><p>Subject: <span className="text-white/85">{draft.subject || "Add a subject"}</span></p><p className="whitespace-pre-wrap leading-6">{draft.body || "Add your update message above."}</p><p>Delivery: {scheduledAt ? `${displayDate(scheduledAt, event.timeZone)} (${event.timeZone})` : "Choose a valid delivery time"}</p><p className="text-xs text-white/45">Your existing invitation, follow-up and reminder keep their current schedules.</p></div>
        {!preview && <p className="text-xs text-white/50">Preview the current update before confirming a real send.</p>}
        {preview?.audienceCount === 0 && <p className="text-xs text-amber-200">No eligible recipients currently match. Initial invitations must have been sent first. Choose another audience or check again later.</p>}
        <label className="flex items-start gap-3 text-sm leading-6 text-white/70"><input type="checkbox" className="mt-1.5" required disabled={locked || !preview || !scheduledAt || preview.audienceCount === 0 || scheduled} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I have reviewed this update’s subject, message, audience and time. I confirm this will send real emails.</span></label>
        <button type="submit" className={primary} disabled={locked || !confirmed || !preview || preview.audienceCount === 0 || !scheduledAt || !!copyError || scheduled}>{busy === "schedule" ? "Scheduling update…" : scheduled ? "Update scheduled" : "Confirm & schedule update"}</button>
      </form>
    </>}
    <div className="border-t border-white/10 pt-5"><h4 className="text-sm text-white/80">Additional update history</h4>{!history.length ? <p className="mt-3 text-sm text-white/45">No additional updates scheduled yet.</p> : <ul className="mt-3 space-y-3">{history.map(delivery => <li key={delivery.id} className="space-y-2 rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-white/85">{delivery.updateSubject || "Event update"}</p><span className="text-xs text-orange-200/75">{eventUpdateStatus(delivery.status)}</span></div>
      <p className="text-xs leading-5 text-white/50">{displayDate(delivery.scheduledAt, event.timeZone)} ({event.timeZone}) · {EVENT_UPDATE_AUDIENCES.find(option => option.value === delivery.updateAudience)?.label || "Saved audience"}</p>
      {delivery.updateBody && <details className="text-xs text-white/55"><summary className="w-fit cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">View saved message</summary><p className="mt-2 whitespace-pre-wrap leading-6">{delivery.updateBody}</p></details>}
      {delivery.status === "SCHEDULED" && event.status !== "CANCELLED" && (cancelId === delivery.id ? <div className="space-y-3 border-t border-white/10 pt-3"><p className="text-sm text-white/70">Cancel this pending update? The original three emails will keep their schedules. Sent emails cannot be recalled.</p><div className="flex flex-wrap gap-2"><button type="button" className={`${button} text-red-200`} disabled={locked} onClick={() => void act("cancel", delivery.id)}>{busy === "cancel" ? "Cancelling…" : "Confirm cancellation"}</button><button type="button" className={button} disabled={locked} onClick={() => setCancelId(null)}>Keep update</button></div></div> : <button type="button" className={button} disabled={locked} onClick={() => setCancelId(delivery.id)}>Cancel pending update</button>)}
    </li>)}</ul>}</div>
  </section>;
}
