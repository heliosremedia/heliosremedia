"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { attendanceCounts, createEventForm, displayDate, localDateTime, invitationPartySize, responseCounts, selectEventImage, type EventEditorForm } from "./ui-helpers";
import EventAppearance from "./EventAppearance";
import EventDraftPreview from "./EventDraftPreview";
import EventEmailCopy from "./EventEmailCopy";
import EventUpdateComposer from "./EventUpdateComposer";
import ResendInvitation from "./ResendInvitation";
import CopyEventLink from "./CopyEventLink";
import { getEventTheme } from "@/lib/events/themes";

type Client = { id: string; displayName: string; email: string };
type Group = { id: string; name: string };
type Invitation = { id: string; source?: string; response: "PENDING" | "YES" | "NO" | "MAYBE"; additionalGuests?: number; client?: Client; displayName?: string; email?: string };
type Delivery = { messages?: { id: string; invitationId?: string; status?: string; sentAt?: string | null }[]; id: string; stage: string; status: string; scheduledAt: string; updateSubject?: string | null; updateBody?: string | null; updateAudience?: string | null };
type Event = { id: string; title: string; description: string; location: string; venueUrl?: string | null; emailContent?: unknown; templateKey?: string; imageUrl?: string | null; imageAlt?: string | null; startsAt: string | null; endsAt: string | null; timeZone: string; status: string; mode: string; clientIds?: string[]; groupIds?: string[]; selection?: { clientIds?: string[]; groupIds?: string[] }; invitations?: Invitation[]; deliveries?: Delivery[] };
type Form = EventEditorForm;
const input = "mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)] disabled:opacity-50";
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} border-orange-400/40 bg-[var(--helios-orange)] text-black hover:brightness-110`;
const panel = "rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-6";
const stages = { INITIAL: "Initial invitation", FOLLOW_UP: "Follow-up", REMINDER: "Day-before reminder" };

async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.error || data.message || "The request could not be completed. Please try again.");
  return data;
}

export default function EventStudio({ defaultTestEmail }: { defaultTestEmail: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Event | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => createEventForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [operation] = useState(() => ({ busy: false }));
  const [unscheduleConfirm, setUnscheduleConfirm] = useState(false);
  const unscheduleDialog = useRef<HTMLDialogElement>(null);
  const keepScheduleButton = useRef<HTMLButtonElement>(null);
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [imageBusy, setImageBusy] = useState(false);
  const [draftPreviewOpen, setDraftPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<keyof typeof stages>("INITIAL");
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [schedule, setSchedule] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [guestResponsesExpanded, setGuestResponsesExpanded] = useState(false);
  const load = useCallback(async () => {
    const data = await request("/api/admin/events");
    setEvents(data.events); setClients(data.clients); setGroups(data.groups);
  }, []);
  useEffect(() => {
    let active = true;
    request("/api/admin/events").then(data => { if (active) { setEvents(data.events); setClients(data.clients); setGroups(data.groups); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!unscheduleConfirm) return;
    const dialog = unscheduleDialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The browser's top layer keeps confirmation in the viewport even inside
    // a long, scrolled event or a transformed Studio layout.
    dialog?.showModal();
    keepScheduleButton.current?.focus({ preventScroll: true });
    return () => {
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [unscheduleConfirm]);
  async function act(work: () => Promise<void>) {
    if (operation.busy) return;
    operation.busy = true; setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { operation.busy = false; setBusy(false); }
  }
  async function open(id: string) {
    await act(async () => { const data = await request(`/api/admin/events/${id}`); setSelected(data.event); setEditing(false); setDraftPreviewOpen(false); setPreview(null); setConfirmed(false); setUnscheduleConfirm(false); restoreSchedule(data.event); });
  }
  function restoreSchedule(event: Event) {
    const saved = Object.fromEntries((event.deliveries || []).filter(delivery => delivery.status === "PAUSED" && Object.hasOwn(stages, delivery.stage)).map(delivery => [delivery.stage, localDateTime(delivery.scheduledAt, event.timeZone)]));
    setDeliveryTimes(saved); setSchedule(saved.INITIAL || ""); setStage("INITIAL");
  }
  async function unschedule() {
    if (!selected || !unscheduleConfirm || busy || imageBusy) return;
    await act(async () => {
      const data = await request(`/api/admin/events/${selected.id}`, "PATCH", { action: "unschedule", confirm: true });
      edit(data.event); await load();
      setMessage("Delivery is paused. Your event, guest list and saved delivery times are kept. Save your changes, then review and confirm the schedule to resume.");
    });
  }
  function edit(event: Event | null) {
    setDraftPreviewOpen(false); setImageBusy(false); setSelected(event); setEditing(true); setError(""); setMessage(""); setPreview(null); setConfirmed(false);
    setUnscheduleConfirm(false); setForm(createEventForm(event));
    if (event) restoreSchedule(event);
  }
  function field<K extends keyof Form>(key: K, value: Form[K]) { setForm(previous => ({ ...previous, [key]: value })); }
  async function save() {
    if (imageBusy || busy) return;
    await act(async () => {
      const body = { ...form, startsAt: form.startsAt ? zonedLocalToUtc(form.startsAt, form.timeZone).toISOString() : null, endsAt: form.endsAt ? zonedLocalToUtc(form.endsAt, form.timeZone).toISOString() : null };
      const data = await request(`/api/admin/events${selected ? `/${selected.id}` : ""}`, selected ? "PATCH" : "POST", body);
      setSelected(data.event); setEditing(false); await load(); restoreSchedule(data.event); setMessage(data.event.deliveries?.some((delivery: Delivery) => delivery.status === "PAUSED") ? "Changes saved. Delivery is still paused. Review the saved times and confirm the schedule to resume." : "Draft saved. No invitations have been sent or scheduled.");
    });
  }
  async function emailAction(action: "preview" | "test" | "schedule" | "cancel") {
    if (!selected) return;
    await act(async () => {
      const deliveryTime = (key: string, value: string) => {
        const saved = selected.deliveries?.find(delivery => delivery.stage === key && delivery.status === "PAUSED");
        // Retain the exact saved instant through ambiguous daylight-saving hours.
        return saved && localDateTime(saved.scheduledAt, selected.timeZone) === value ? new Date(saved.scheduledAt).toISOString() : zonedLocalToUtc(value, selected.timeZone).toISOString();
      };
      const data = await request(`/api/admin/events/${selected.id}/email`, "POST", { action, stage, testEmail: action === "test" ? testEmail : undefined, scheduledAt: action === "schedule" ? deliveryTime(stage, schedule) : undefined, deliveryTimes: action === "schedule" && paused ? Object.fromEntries(Object.entries({ ...deliveryTimes, INITIAL: schedule }).map(([key, value]) => [key, deliveryTime(key, value)])) : undefined, confirm: action === "schedule" ? confirmed : action === "test" ? true : undefined });
      if (action === "preview") setPreview(data);
      else { const detail = await request(`/api/admin/events/${selected.id}`); setSelected(detail.event); await load(); setMessage(data.message || (action === "test" ? "Test email submitted." : action === "cancel" ? "Pending email schedule cancelled." : "Email schedule saved.")); setConfirmed(false); }
    });
  }
  const paused = selected?.status === "DRAFT" && selected.deliveries?.some(delivery => delivery.status === "PAUSED");
  const canUnschedule = selected?.status === "SCHEDULED" && selected.deliveries?.some(delivery => delivery.stage === "INITIAL" && delivery.status === "SCHEDULED") && selected.deliveries.every(delivery => Array.isArray(delivery.messages) && delivery.messages.length === 0 && (delivery.status !== "SCHEDULED" || Object.hasOwn(stages, delivery.stage)));
  let scheduleSummary: { label: string; value: string }[] = [];
  if (selected?.startsAt && schedule) {
    try {
      const initial = zonedLocalToUtc(schedule, selected.timeZone);
      const reminder = new Date(new Date(selected.startsAt).getTime() - 86_400_000);
      const followUp = new Date(initial.getTime() + 14 * 86_400_000);
      scheduleSummary = [{ label: stages[stage], value: displayDate(initial.toISOString(), selected.timeZone) }];
      if (paused) {
        scheduleSummary = Object.entries({ ...deliveryTimes, INITIAL: schedule }).map(([key, value]) => ({ label: stages[key as keyof typeof stages], value: displayDate(zonedLocalToUtc(value, selected.timeZone).toISOString(), selected.timeZone) }));
      } else if (stage === "INITIAL") scheduleSummary.push(
        { label: "Follow-up · no reply / maybe", value: followUp < reminder ? displayDate(followUp.toISOString(), selected.timeZone) : "Not scheduled: fewer than 14 days before the reminder." },
        { label: "Reminder · yes attendees", value: reminder > initial ? displayDate(reminder.toISOString(), selected.timeZone) : "Not scheduled: invitation is within 24 hours of the event." },
      );
    } catch { /* Invalid or nonexistent local time is shown when submitted. */ }
  }
  const counts = responseCounts(selected?.invitations);
  const attendance = attendanceCounts(selected?.invitations);
  const standardDeliveries = (selected?.deliveries || []).filter(delivery => Object.hasOwn(stages, delivery.stage));
  const zones = Array.from(new Set(["America/Denver", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu", "UTC", form.timeZone, ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [])]));
  const invitations = (selected?.invitations || []).filter(i => (filter === "ALL" || i.response === filter) && `${i.client?.displayName || i.displayName || ""} ${i.client?.email || i.email || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    {unscheduleConfirm && <dialog ref={unscheduleDialog} aria-labelledby="unschedule-confirm-title" aria-describedby="unschedule-confirm-description" aria-modal="true" aria-busy={busy || imageBusy}
      onCancel={event => { event.preventDefault(); if (!operation.busy && !imageBusy) setUnscheduleConfirm(false); }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg flex-col overflow-hidden rounded-2xl border border-orange-300/20 bg-[#171717] p-0 text-white shadow-2xl open:flex backdrop:bg-black/80 backdrop:backdrop-blur-sm">
      <div tabIndex={0} className="min-h-0 overflow-y-auto p-5 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] sm:p-6">
        <h2 id="unschedule-confirm-title" className="text-xl font-light">Unschedule & edit?</h2>
        <p id="unschedule-confirm-description" className="mt-3 text-sm leading-6 text-white/75">Pause all pending event emails and reopen this event for editing? Your wording, guest list, images and delivery times will be kept. Nothing resumes until you confirm the schedule again. If delivery has already started, this action will be blocked.</p>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-200">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-3 border-t border-white/10 p-4 sm:p-5">
        <button type="button" className={primary} disabled={busy || imageBusy} onClick={() => void unschedule()}>{busy ? "Pausing delivery…" : "Confirm unschedule & edit"}</button>
        <button ref={keepScheduleButton} type="button" className={button} disabled={busy || imageBusy} onClick={() => { if (!operation.busy && !imageBusy) setUnscheduleConfirm(false); }}>Keep schedule</button>
      </div>
    </dialog>}
    <div className="space-y-6">
    {error && !unscheduleConfirm && <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-200">{message}</div>}
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className={`${panel} self-start`} aria-label="Events">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg text-white">Your events</h2><button className={button} disabled={busy || imageBusy} onClick={() => edit(null)}>+ New</button></div>
        {loading ? <p className="mt-6 text-sm text-white/50" role="status">Loading events…</p> : events.length === 0 ? <p className="mt-6 text-sm leading-6 text-white/50">Your next gathering starts here. Create a draft when you’re ready.</p> : <ul className="mt-5 space-y-2">{events.map(event => <li key={event.id}><button aria-current={selected?.id === event.id ? "true" : undefined} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === event.id ? "border-orange-400/40 bg-orange-400/5" : "border-white/5 hover:border-white/20"}`} disabled={busy || imageBusy} onClick={() => void open(event.id)}><span className="block text-sm text-white">{event.title}</span><span className="mt-2 block text-xs text-white/45">{displayDate(event.startsAt, event.timeZone)}</span><span className="mt-2 block text-[10px] uppercase tracking-widest text-orange-200/70">{event.status === "DRAFT" && event.deliveries?.some(delivery => delivery.status === "PAUSED") ? "Paused for editing" : event.status}</span></button></li>)}</ul>}
      </aside>
      {editing ? <form className={`${panel} space-y-6`} onSubmit={e => { e.preventDefault(); void save(); }}>
        <div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">01 / Event details</p><h2 className="mt-2 text-2xl font-light text-white">{paused ? "Edit your event" : selected ? "Edit your draft" : "Make it an occasion"}</h2><p className="mt-2 text-sm text-white/50">{paused ? "Delivery is paused. Your event and guest list are preserved. Save your changes, then review and confirm the schedule to resume." : "Saving a draft never sends email. Choose the audience and review before scheduling."}</p></div>
        <label className="block text-sm text-white/70">Event title<input className={input} required maxLength={160} value={form.title} onChange={e => field("title", e.target.value)} placeholder="Client holiday celebration" /></label>
        <label className="block text-sm text-white/70">Description<textarea className={input} rows={5} required maxLength={10000} value={form.description} onChange={e => field("description", e.target.value)} placeholder="What should your guests know?" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-white/70">Start date & time<input className={input} type="datetime-local" required value={form.startsAt} onChange={e => field("startsAt", e.target.value)} /></label><label className="text-sm text-white/70">End date & time · optional<input className={input} type="datetime-local" value={form.endsAt} onChange={e => field("endsAt", e.target.value)} /></label></div>
        <label className="block text-sm text-white/70">Time zone<select className={input} value={form.timeZone} onChange={e => field("timeZone", e.target.value)}>{zones.map(zone => <option key={zone}>{zone}</option>)}</select></label>
        <label className="block text-sm text-white/70">Location<input className={input} required maxLength={500} value={form.location} onChange={e => field("location", e.target.value)} placeholder="Venue and address" /></label>
        <label className="block text-sm text-white/70">Venue website · optional<input className={input} type="url" maxLength={2000} value={form.venueUrl} onChange={e => field("venueUrl", e.target.value)} placeholder="https://venue-website.com" /><span className="mt-2 block text-xs text-white/45">Give guests a link to the venue, directions, or parking details. Use an HTTPS website.</span></label>
        <EventAppearance key={selected?.id || "new"} value={form} title={form.title} disabled={busy} onTemplateChange={value => field("templateKey", value)} onImageChange={image => setForm(previous => selectEventImage(previous, image))} onAltChange={value => field("imageAlt", value)} onUploadingChange={setImageBusy} onPreview={() => setDraftPreviewOpen(true)} />
        {draftPreviewOpen && <EventDraftPreview form={form} onClose={() => setDraftPreviewOpen(false)} onApplyStyle={templateKey => { field("templateKey", templateKey); setDraftPreviewOpen(false); }} />}
        <EventEmailCopy key={`copy-${selected?.id || "new"}`} title={form.title} description={form.description} aiSource={{ title: form.title, description: form.description, startsAt: form.startsAt, endsAt: form.endsAt, timeZone: form.timeZone, location: form.location, venueUrl: form.venueUrl }} value={form.emailContent} disabled={busy} onChange={value => field("emailContent", value)} />
        <fieldset disabled={busy || !!paused} className="border-t border-white/10 pt-6"><legend className="pr-3 text-xs uppercase tracking-widest text-[var(--helios-orange)]">04 / Guest list</legend><div className="mt-3 flex flex-wrap gap-3">{[["ALL", "All eligible clients"], ["GROUPS", "Selected groups"], ["INDIVIDUALS", "Individual clients"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm text-white/70"><input type="radio" name="audience" checked={form.mode === value} onChange={() => field("mode", value)} />{label}</label>)}</div><p className="mt-3 text-xs leading-5 text-white/45">{paused ? `${selected?.invitations?.length || 0} saved recipients. The original guest list is kept while you edit. Eligibility is checked again before delivery.` : "Only subscribed, valid, non-suppressed email addresses are eligible. Recipients are finalized when you schedule."}</p>
          {form.mode !== "ALL" && <div className="mt-4 max-h-60 space-y-2 overflow-auto rounded-xl border border-white/10 p-3">{(form.mode === "GROUPS" ? groups : clients).map(item => { const key = form.mode === "GROUPS" ? "groupIds" : "clientIds"; return <label key={item.id} className="flex items-start gap-3 rounded-lg p-2 text-sm text-white/70 hover:bg-white/5"><input type="checkbox" className="mt-1" checked={form[key].includes(item.id)} onChange={e => field(key, e.target.checked ? [...form[key], item.id] : form[key].filter(id => id !== item.id))} /><span>{"name" in item ? item.name : item.displayName || item.email}{"email" in item && <span className="block text-xs text-white/40">{item.email}</span>}</span></label>; })}{(form.mode === "GROUPS" ? groups : clients).length === 0 && <p className="text-sm text-white/45">No eligible {form.mode === "GROUPS" ? "groups" : "clients"} available.</p>}</div>}
        </fieldset>
        <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy || imageBusy} type="submit">{busy ? "Saving…" : paused ? "Save changes" : "Save draft"}</button><button className={button} type="button" disabled={busy || imageBusy} onClick={() => setEditing(false)}>{paused ? "Discard edits & return" : "Cancel editing"}</button></div>
      </form> : selected ? <div className="space-y-6">
        <section className={panel} aria-labelledby="rsvp-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="rsvp-title" className="text-lg text-white">Guest responses</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={`${button} inline-flex items-center gap-2`} aria-expanded={guestResponsesExpanded} aria-controls="rsvp-guests" aria-label={`${guestResponsesExpanded ? "Collapse" : "Expand"} guest responses`} onClick={() => setGuestResponsesExpanded(previous => !previous)}>
                {guestResponsesExpanded ? "Collapse" : "Expand"}
                <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${guestResponsesExpanded ? "rotate-180" : ""}`}><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button type="button" className={button} disabled={busy || imageBusy} onClick={() => void open(selected.id)}>Refresh</button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Invited", counts.total], ["Yes", counts.yes], ["Maybe", counts.maybe], ["No", counts.no], ["Awaiting reply", counts.pending]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-2 text-2xl font-light text-white">{value}</p></div>)}</div>
          <p className="mt-3 text-xs leading-5 text-white/45">Responses above count invited clients. People totals below include their extra guests.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3"><dt className="text-xs text-emerald-100/70">Confirmed total people</dt><dd className="mt-2 text-2xl font-light text-emerald-100">{attendance.confirmedPeople}<span className="mt-1 block text-xs font-normal text-white/45">Invited clients who said yes + their guests</span></dd></div>
            <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/45">Confirmed extra guests</dt><dd className="mt-2 text-2xl font-light text-white">{attendance.confirmedExtraGuests}<span className="mt-1 block text-xs font-normal text-white/45">Already included in confirmed total</span></dd></div>
            <div className="rounded-xl border border-white/10 p-3"><dt className="text-xs text-white/45">Tentative total people</dt><dd className="mt-2 text-2xl font-light text-white">{attendance.tentativePeople}<span className="mt-1 block text-xs font-normal text-white/45">Maybe responses, including {attendance.tentativeExtraGuests} extra {attendance.tentativeExtraGuests === 1 ? "guest" : "guests"}</span></dd></div>
          </dl>
          <div id="rsvp-guests" hidden={!guestResponsesExpanded}>
            <div className="mt-4 flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-xs text-white/50">Find a guest<input className={input} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" /></label><label className="text-xs text-white/50">Response<select className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All responses</option><option value="YES">Yes</option><option value="MAYBE">Maybe</option><option value="NO">No</option><option value="PENDING">Awaiting reply</option></select></label></div>
            <ul className="mt-4 divide-y divide-white/10">{invitations.map(invitation => <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-x-4 py-3 text-sm"><div className="min-w-0"><p className="truncate text-white/80">{invitation.client?.displayName || invitation.displayName || "Guest"}</p><p className="truncate text-xs text-white/40">{invitation.client?.email || invitation.email}</p>{invitationPartySize(invitation) > 0 && <p className="mt-1 text-xs text-white/60">+{invitationPartySize(invitation) - 1} {invitationPartySize(invitation) === 2 ? "guest" : "guests"} · {invitationPartySize(invitation)} {invitationPartySize(invitation) === 1 ? "person" : "people"} total{invitation.response === "MAYBE" ? " (tentative)" : ""}</p>}</div><span className={invitation.response === "YES" ? "text-emerald-200" : "text-white/55"}>{invitation.response === "PENDING" ? "Awaiting reply" : invitation.response === "YES" ? "Yes" : invitation.response === "MAYBE" ? "Maybe" : "No"}</span>{invitation.source === "SHARED_LINK" ? <span className="mt-2 w-full text-xs text-white/40">RSVP via shared invite link · No email subscription</span> : <ResendInvitation key={`${selected.id}-${invitation.id}`} event={selected} recipient={{id:invitation.id,email:invitation.email || invitation.client?.email,displayName:invitation.displayName || invitation.client?.displayName}} disabled={busy || imageBusy} onChange={updated=>{setSelected(current=>current?.id===updated.id ? updated : current);setEvents(current=>current.map(item=>item.id===updated.id ? updated : item));}} />}</li>)}</ul>
            {!invitations.length && <p className="mt-4 text-sm text-white/45">{counts.total ? "No guests match this filter." : "No invitations yet. Your guest list appears after scheduling."}</p>}
          </div>
        </section>
        <section className={panel}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">{paused ? "Paused for editing" : selected.status}</p><h2 className="mt-2 text-2xl font-light text-white">{selected.title}</h2></div>{selected.status === "SCHEDULED" && selected.startsAt && +new Date(selected.startsAt) > Date.now() && <CopyEventLink key={selected.id} eventId={selected.id} disabled={busy || imageBusy} />}{selected.status === "DRAFT" && <button className={button} disabled={busy || imageBusy} onClick={() => edit(selected)}>{paused ? "Edit event" : "Edit draft"}</button>}{canUnschedule && <button className={button} disabled={busy || imageBusy} onClick={() => setUnscheduleConfirm(true)}>Unschedule & edit</button>}</div><p className="mt-4 text-xs text-white/50">{getEventTheme(selected.templateKey).label}{selected.imageUrl ? " · Cover image included" : " · No cover image"}</p><p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-white/60">{selected.description || "No description yet."}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-white/40">When</dt><dd className="mt-1 text-sm text-white/80">{displayDate(selected.startsAt, selected.timeZone)}{selected.endsAt && ` – ${displayDate(selected.endsAt, selected.timeZone)}`}<span className="mt-1 block text-xs text-white/40">{selected.timeZone}</span></dd></div><div><dt className="text-xs text-white/40">Where</dt><dd className="mt-1 text-sm text-white/80">{selected.location || "Location not set"}{selected.venueUrl && <a href={selected.venueUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-2 block w-fit text-[var(--helios-orange)] underline underline-offset-4">Visit venue website ↗</a>}</dd></div></dl>
          {paused && <p className="mt-5 rounded-xl border border-orange-300/20 bg-orange-300/5 p-4 text-sm leading-6 text-white/75">Delivery is paused. Edit your event above, then review all saved delivery times and confirm the schedule below. Leaving this page keeps delivery paused.</p>}
        </section>
        {selected.status !== "CANCELLED" && <section className={`${panel} space-y-5`} aria-labelledby="email-title"><div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">Delivery plan</p><h3 id="email-title" className="mt-2 text-lg text-white">A thoughtful invitation, start to finish</h3></div><ol className="space-y-3 text-sm text-white/60"><li><strong className="text-white/85">1. Initial invitation</strong> · Your selected audience, at the time you choose.</li><li><strong className="text-white/85">2. Follow-up</strong> · Guests who have not replied or chose maybe, 14 days later if there is time before the reminder.</li><li><strong className="text-white/85">3. Day-before reminder</strong> · Guests who said yes, 24 hours before the event.</li></ol>
          <label className="block text-sm text-white/65">Email to review<select className={input} disabled={busy} value={stage} onChange={e => { setStage(e.target.value as keyof typeof stages); setPreview(null); setConfirmed(false); }}>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex flex-wrap gap-3"><button className={button} disabled={busy || imageBusy} onClick={() => void emailAction("preview")}>Preview email</button></div>
          {preview && <div className="overflow-hidden rounded-xl border border-white/15"><div className="flex flex-wrap items-center justify-between gap-3 bg-white/5 p-3"><p className="text-sm text-white/80">Subject: {preview.subject}</p><div className="flex gap-2" aria-label="Email preview width">{(["DESKTOP", "MOBILE"] as const).map(width => <button key={width} type="button" aria-pressed={previewWidth === width} onClick={() => setPreviewWidth(width)} className={`rounded-lg border px-3 py-1.5 text-xs ${previewWidth === width ? "border-orange-300/50 text-orange-200" : "border-white/15 text-white/60"}`}>{width === "DESKTOP" ? "Desktop" : "Mobile"}</button>)}</div></div><div className="bg-black/30 p-2 sm:p-4"><iframe title={`${stages[stage]} email preview`} sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html} className="mx-auto h-[640px] w-full bg-white transition-[max-width]" style={{ maxWidth: previewWidth === "MOBILE" ? 375 : 760 }} /></div><p className="bg-white/5 px-3 py-2 text-xs leading-5 text-white/45">Preview only. First-name fields use Alex, a sample name. RSVP choices are disabled here and in test emails.</p></div>}
          <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void emailAction("test"); }}><label className="min-w-0 flex-1 text-sm text-white/65">Test recipient<input className={input} type="email" required value={testEmail} onChange={e => setTestEmail(e.target.value)} /></label><button className={button} disabled={busy || imageBusy} type="submit">Send test only</button></form><p className="text-xs text-white/40">Tests use Alex for first-name fields, not the test recipient’s identity. They do not invite your audience or change attendance. RSVP links in tests are disabled.</p>
          {(!paused || stage === "INITIAL") ? <form className="space-y-4 border-t border-white/10 pt-5" onSubmit={e => { e.preventDefault(); void emailAction("schedule"); }}><label className="block text-sm text-white/65">{stage === "INITIAL" ? "Send initial invitation at" : `Send ${stages[stage].toLowerCase()} at`}<input className={input} required disabled={busy} type="datetime-local" value={schedule} onChange={e => { setSchedule(e.target.value); setConfirmed(false); }} /><span className="mt-2 block text-xs text-white/40">All times use {selected.timeZone}. {paused ? "Your saved times are shown below. Adjust any time before confirming." : stage === "INITIAL" ? "Scheduling the invitation also schedules the eligible follow-up and reminder." : "This changes only the selected stage."}</span></label>
            {paused && Object.entries(deliveryTimes).filter(([key]) => key !== "INITIAL").map(([key, value]) => <label key={key} className="block text-sm text-white/65">Send {stages[key as keyof typeof stages].toLowerCase()} at<input className={input} required disabled={busy} type="datetime-local" value={value} onChange={e => { setDeliveryTimes(previous => ({ ...previous, [key]: e.target.value })); setConfirmed(false); }} /></label>)}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65"><p className="text-white/85">Audience: {paused ? `${selected.invitations?.length || 0} saved recipients (original guest list)` : selected.mode === "ALL" ? "All eligible clients" : selected.mode === "GROUPS" ? (selected.groupIds || []).map(id => groups.find(group => group.id === id)?.name || "Selected group").join(", ") : `${(selected.clientIds || []).length} selected clients`}</p><p className="mt-2 text-xs text-white/45">{paused ? "No new recipients will be added. Eligibility is checked again before delivery." : "Eligibility is checked at scheduling and again before delivery."}</p>{scheduleSummary.map(item => <p key={item.label} className="mt-3"><span className="block text-xs text-white/40">{item.label}</span>{item.value}</p>)}</div><label className="flex items-start gap-3 text-sm leading-6 text-white/70"><input className="mt-1.5" required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I have reviewed the event, audience, and email. I confirm this schedule will send real emails.</span></label><button type="submit" className={primary} disabled={busy || !confirmed || !selected.startsAt || (stage === "INITIAL" ? selected.status !== "DRAFT" : selected.status !== "SCHEDULED")}>{paused ? "Confirm & resume schedule" : `Confirm & schedule ${stage === "INITIAL" ? "invitations" : "email"}`}</button>{!selected.startsAt && <p className="text-xs text-amber-200">Add an event date before scheduling.</p>}</form> : <div className="border-t border-white/10 pt-5"><p className="text-sm text-white/65">Preview or test each email here. Resume all saved deliveries from the initial invitation schedule.</p><button type="button" className={`${button} mt-3`} onClick={() => { setStage("INITIAL"); setPreview(null); setConfirmed(false); }}>Review saved schedule</button></div>}
          {!!standardDeliveries.length && <div className="border-t border-white/10 pt-5"><h4 className="text-sm text-white/80">{paused ? "Saved delivery times · paused" : "Scheduled deliveries"}</h4><ul className="mt-3 space-y-3">{standardDeliveries.map(delivery => <li key={delivery.id} className="text-sm text-white/55">{stages[delivery.stage as keyof typeof stages] || delivery.stage} · {displayDate(delivery.scheduledAt, selected.timeZone)}<span className="ml-2 text-xs text-orange-200/70">{delivery.status}</span></li>)}</ul>{!paused && <button className={`${button} mt-4`} disabled={busy || imageBusy} onClick={() => { if (window.confirm(`Cancel pending ${stages[stage].toLowerCase()} emails? Already sent email cannot be recalled.`)) void emailAction("cancel"); }}>Cancel pending {stages[stage].toLowerCase()}</button>}</div>}
        </section>}
        <EventUpdateComposer key={selected.id} event={selected} defaultTestEmail={defaultTestEmail} disabled={busy || imageBusy} onEventChange={updated => { setSelected(current => current?.id === updated.id ? updated : current); setEvents(current => current.map(item => item.id === updated.id ? updated : item)); }} />
        {selected.status !== "CANCELLED" && <div className="flex flex-wrap items-center justify-between gap-3 px-1"><p className="text-xs text-white/40">Cancelling stops future delivery. Sent emails cannot be recalled.</p><button className={`${button} text-red-200`} disabled={busy || imageBusy} onClick={() => { if (window.confirm("Cancel this event and all pending emails? Guests will not receive a cancellation email automatically.")) void act(async () => { const data = await request(`/api/admin/events/${selected.id}`, "PATCH", { action: "cancel" }); setSelected(data.event); await load(); setMessage("Event cancelled. Pending emails have been stopped."); }); }}>Cancel event</button></div>}
      </div> : <section className={`${panel} flex min-h-80 flex-col items-start justify-center`}><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">Good company. Simply organized.</p><h2 className="mt-4 text-3xl font-light text-white">Make room for connection.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-white/50">From your first invitation to the final reminder, keep every detail and every RSVP in one place. Start with a draft. Nothing sends until you confirm.</p><button className={`${primary} mt-6`} disabled={busy || imageBusy} onClick={() => edit(null)}>Create an event</button></section>}
    </div>
    </div>
  </>;
}
