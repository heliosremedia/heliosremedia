"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AccessibleDialog from "@/app/admin/newsletter-studio/components/AccessibleDialog";
import { feedbackAudience, feedbackEmailBody, newFeedbackDraft, type FeedbackDashboard, type FeedbackDraft, type FeedbackReminder } from "@/lib/feedback";
import styles from "./FeedbackWorkspace.module.css";

type Editor = { id: string; rowVersion: number | null; draft: FeedbackDraft; saved: string | null };
type Confirmation = { type: "schedule" | "test" | "discard" | "cancel" | "pause"; reminder?: FeedbackReminder; operationId?: string } | null;
const audienceLabels = { ORIGINAL: "Original invitation audience", ALL: "All eligible clients", GROUPS: "Selected groups", INDIVIDUALS: "Selected clients" };
function dateLabel(value: string | null, zone = "America/Denver") {
  return value ? new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value)) : "Not scheduled";
}
function localDate(value: string | null, timeZone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (key: string) => parts.find(part => part.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
async function api<T>(url: string, method = "GET", payload?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method, headers: payload ? { "Content-Type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined, signal });
  const result = await response.json();
  if (!response.ok || result.success === false) throw new Error(result.error || "This action could not be completed. Your draft is still here.");
  return result as T;
}
function toDraft(reminder: FeedbackReminder): FeedbackDraft {
  return { subject: reminder.subject, previewText: reminder.previewText, body: reminder.body, mode: reminder.mode, groupIds: reminder.selection.groupIds, clientIds: reminder.selection.clientIds };
}

export default function FeedbackWorkspace({ initialDashboard }: { initialDashboard: FeedbackDashboard }) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [view, setView] = useState<"overview" | "reminders">("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [search, setSearch] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [timeZone, setTimeZone] = useState("America/Denver");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pending, setPending] = useState("");
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = !!editor && (JSON.stringify(editor.draft) !== editor.saved || !!scheduledLocal);
  const recipients = useMemo(() => editor ? feedbackAudience(dashboard.clients, editor.draft) : [], [dashboard.clients, editor]);
  const survey = dashboard.survey;
  const scheduled = dashboard.reminders.filter(item => item.status === "SCHEDULED");
  const drafts = dashboard.reminders.filter(item => item.status === "DRAFT");

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const guardNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      if (!window.confirm("Leave Client Feedback and discard your unsaved message or delivery time? Saved drafts will remain.")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardNavigation, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardNavigation, true); };
  }, [dirty]);
  useEffect(() => {
    if (!editor) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError("");
      api<{ subject: string; html: string }>("/api/admin/feedback/preview", "POST", editor.draft, controller.signal)
        .then(setPreview).catch((reason: Error) => { if (!controller.signal.aborted) { setPreview(null); setPreviewError(reason.message); } })
        .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editor]);

  function updateDraft(patch: Partial<FeedbackDraft>) {
    setEditor(current => current ? { ...current, draft: { ...current.draft, ...patch } } : current);
    setAcknowledged(false);
  }
  function startDraft(reminder?: FeedbackReminder) {
    if (dirty || pendingRef.current) return;
    const draft = reminder ? toDraft(reminder) : newFeedbackDraft();
    setEditor({ id: reminder?.id || crypto.randomUUID(), rowVersion: reminder?.rowVersion ?? null, draft, saved: reminder ? JSON.stringify(draft) : null });
    setTimeZone(reminder?.scheduledTimeZone || "America/Denver");
    setScheduledLocal(localDate(reminder?.scheduledAt || null, reminder?.scheduledTimeZone || "America/Denver"));
    setSearch(""); setAcknowledged(false); setError(""); setMessage(""); setPreview(null); setView("reminders");
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function acceptReminder(reminder: FeedbackReminder) {
    setDashboard(current => ({ ...current, reminders: [reminder, ...current.reminders.filter(item => item.id !== reminder.id)] }));
  }
  async function perform(label: string, work: () => Promise<void>) {
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(label); setError(""); setMessage("");
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : "The action could not be completed. Refresh to check its status before retrying."); }
    finally { pendingRef.current = false; setPending(""); }
  }
  async function saveDraft() {
    if (!editor) throw new Error("Open a reminder first.");
    const result = await api<{ reminder: FeedbackReminder }>(editor.rowVersion ? `/api/admin/feedback/${editor.id}` : "/api/admin/feedback", editor.rowVersion ? "PATCH" : "POST", { ...editor.draft, id: editor.id, action: "draft", rowVersion: editor.rowVersion });
    acceptReminder(result.reminder);
    setEditor({ id: result.reminder.id, rowVersion: result.reminder.rowVersion, draft: toDraft(result.reminder), saved: JSON.stringify(toDraft(result.reminder)) });
    return result.reminder;
  }
  async function confirmAction() {
    if (!confirmation) return;
    const current = confirmation;
    await perform(current.type, async () => {
      if (current.type === "discard") { setEditor(null); setConfirmation(null); return; }
      if (current.type === "test" && editor) {
        await api("/api/admin/feedback/test", "POST", { ...editor.draft, operationId: current.operationId });
        setMessage(`Test sent to ${dashboard.defaultTestEmail}. No clients were contacted.`);
      } else if (current.reminder) {
        const reminder = current.reminder;
        const result = await api<{ reminder: FeedbackReminder }>(`/api/admin/feedback/${reminder.id}`, "PATCH", {
          action: current.type, rowVersion: reminder.rowVersion,
          ...(current.type === "schedule" ? { scheduledLocal, scheduledTimeZone: timeZone, anonymousAcknowledged: acknowledged, expectedRecipientCount: recipients.length } : {}),
        });
        acceptReminder(result.reminder);
        if (current.type === "schedule") { setEditor(null); setMessage("Reminder scheduled. You can pause or cancel it before delivery begins."); }
        else if (current.type === "pause") { if (editor?.id === reminder.id) setEditor(null); setMessage("Reminder paused and returned to drafts. It will not send unless you schedule it again."); }
        else { setMessage("Reminder cancelled. It will not send."); if (editor?.id === reminder.id) setEditor(null); }
      }
      setConfirmation(null);
    });
  }
  const scheduledTime = scheduledLocal ? `${scheduledLocal.replace("T", " at ")} (${timeZone})` : "Choose a delivery time";

  return <div className={styles.workspace}>
    <section className={`${styles.card} ${styles.hero}`} aria-labelledby="survey-title">
      <div className={styles.split}>
        <div><p className={styles.eyebrow}>Listen. Learn. Make it better.</p><h2 id="survey-title" className="mt-2">{survey.title}</h2><p className={`${styles.muted} mt-2 max-w-2xl`}>Your existing Google Form, with a home in Studio. Responses stay in Google Forms; no data is copied or linked to client profiles.</p></div>
        <div className={styles.row}><a className={styles.button} href={survey.formUrl} target="_blank" rel="noopener noreferrer">Open survey ↗</a><a className={styles.primary} href={survey.resultsUrl} target="_blank" rel="noopener noreferrer">View responses ↗</a></div>
      </div>
      <dl className={styles.metrics}>
        <div className={styles.metric}><dt>Original invitation · accepted</dt><dd>{dashboard.originalCampaign?.sentCount ?? "—"}</dd></div>
        <div className={styles.metric}><dt>Scheduled reminders</dt><dd>{scheduled.length}</dd></div>
        <div className={styles.metric}><dt>Reminder drafts</dt><dd>{drafts.length}</dd></div>
      </dl>
    </section>
    <nav className={styles.tabs} aria-label="Feedback sections"><button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Overview</button><button type="button" aria-pressed={view === "reminders"} onClick={() => setView("reminders")}>Reminders <span className={styles.badge}>{dashboard.reminders.length}</span></button></nav>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {message && <div role="status" className={styles.success}>{message}</div>}
    <div hidden={view !== "overview"} className={styles.grid}>
      <section className={styles.card}><p className={styles.eyebrow}>A thoughtful follow-up</p><h2 className="mt-2">Make room for more voices.</h2><p className={`${styles.muted} mt-3`}>Start with two reminders a few days apart. Each can have its own message, audience, and delivery time. Nothing sends until you review and schedule it.</p><div className={`${styles.notice} mt-5`}>{survey.anonymousNotice}</div><div className={`${styles.row} mt-5`}><button className={styles.primary} type="button" onClick={() => editor ? setView("reminders") : startDraft()}>{editor ? "Continue your reminder" : "Create a reminder"}</button><span className={styles.muted}>Draft first. Schedule when ready.</span></div></section>
      <section className={styles.card}><p className={styles.eyebrow}>Your feedback setup</p><h2 className="mt-2">Anonymous by design.</h2><ul className={`${styles.list} mt-4`}><li>Use Google Forms for response totals, charts, and written feedback. Sign in with the Google account that owns the form.</li><li>Studio cannot identify respondents or exclude people who have already answered. Opens and clicks are not completion signals.</li><li>Every reminder includes the same survey link, an “already responded” note, and the normal email unsubscribe option.</li><li>The existing thank-you offer stays in the form confirmation. It is not a reward for a positive or public review.</li></ul><p className={`${styles.muted} mt-5`}>{dashboard.originalCampaign ? `Original invitation: ${dateLabel(dashboard.originalCampaign.sentAt)}. Provider acceptance is not confirmed inbox delivery.` : "Original invitation is not available in this workspace."}</p></section>
    </div>
    <div hidden={view !== "reminders"}>
      <div className={styles.split}><div><h2 className="text-xl font-light">Reminder plan</h2><p className={`${styles.muted} mt-1`}>A series of individual reminders, always under your control.</p></div><div className={styles.row}><button type="button" className={styles.button} disabled={!!pending} onClick={() => perform("refresh", async () => {
        const result = await api<FeedbackDashboard>("/api/admin/feedback");
        setDashboard(result);
        setEditor(current => current ? { ...current, draft: { ...current.draft, groupIds: current.draft.groupIds.filter(id => result.groups.some(group => group.id === id)), clientIds: current.draft.clientIds.filter(id => result.clients.some(client => client.id === id)) } } : null);
        setAcknowledged(false);
        setMessage("Audience and reminder status refreshed. Your message is preserved; any ineligible selections were removed. If another tab changed this reminder, close and reopen its saved draft before editing.");
      })}>Refresh</button><button type="button" className={styles.primary} disabled={!!pending || dirty} onClick={() => startDraft()}>+ New reminder</button></div></div>
      {dirty && <p className={`${styles.muted} mt-2`}>You have an unsaved message or delivery time. Save your message or close this draft before opening another reminder.</p>}
      <div className={styles.history}>
        {!dashboard.reminders.length && !editor && <div className={styles.empty}><p className="text-lg">No reminders yet.</p><p className={`${styles.muted} mt-2`}>Create a draft to choose your audience and message. Creating a draft never sends email.</p></div>}
        {dashboard.reminders.map(reminder => <article key={reminder.id} className={styles.reminder}><div className={styles.split}><div className="min-w-0"><div className={styles.row}><h3 className="break-words text-base">{reminder.subject}</h3><span className={`${styles.badge} ${reminder.status === "SCHEDULED" ? styles.scheduled : ""}`}>{reminder.status === "DRAFT" ? "Draft · inactive" : reminder.status.replaceAll("_", " ").toLowerCase()}</span></div><p className={`${styles.muted} mt-2`}>{audienceLabels[reminder.mode]} · {reminder.status === "DRAFT" ? "Audience checked when scheduled" : `${reminder.recipientCount} selected`} · {reminder.status === "SCHEDULED" ? dateLabel(reminder.scheduledAt, reminder.scheduledTimeZone || "America/Denver") : reminder.sentAt ? dateLabel(reminder.sentAt) : "No active delivery"}</p>{reminder.sentCount > 0 && <p className={styles.muted}>{reminder.sentCount} provider accepted · {reminder.failedCount} failed</p>}{reminder.scheduleError && <p className="mt-2 text-sm text-amber-200">{reminder.scheduleError}</p>}</div><div className={styles.row}>{reminder.status === "DRAFT" && <button className={styles.button} disabled={!!pending || dirty} type="button" onClick={() => startDraft(reminder)}>Edit draft</button>}{reminder.status === "SCHEDULED" && <button className={styles.button} disabled={!!pending} type="button" onClick={() => setConfirmation({ type: "pause", reminder })}>Pause to edit</button>}{["DRAFT", "SCHEDULED"].includes(reminder.status) && <button className={styles.button} disabled={!!pending} type="button" onClick={() => setConfirmation({ type: "cancel", reminder })}>Cancel</button>}</div></div></article>)}
      </div>
      {editor && <div ref={editorRef} className={`${styles.editor} mt-6 scroll-mt-24`}>
        <section className={styles.card} aria-labelledby="reminder-editor-title"><div className={styles.split}><div><p className={styles.eyebrow}>Prepare a reminder</p><h2 id="reminder-editor-title" className="mt-2">A little nudge, in your voice.</h2></div><button type="button" className={styles.button} disabled={!!pending} onClick={() => dirty ? setConfirmation({ type: "discard" }) : setEditor(null)}>Close</button></div>
          <fieldset disabled={!!pending} className="min-w-0">
            <div className={styles.step}><h3>1. Choose an audience</h3><label className={styles.field}>Send to<select value={editor.draft.mode} onChange={event => updateDraft({ mode: event.target.value as FeedbackDraft["mode"] })}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {editor.draft.mode === "ORIGINAL" && <p className={`${styles.muted} mb-3`}>Only people included in the original survey invitation who are still eligible. New clients are not added.</p>}
              {editor.draft.mode === "GROUPS" && <div className={styles.choices}>{dashboard.groups.length ? dashboard.groups.map(group => <label key={group.id} className={styles.check}><input type="checkbox" checked={editor.draft.groupIds.includes(group.id)} onChange={event => updateDraft({ groupIds: event.target.checked ? [...editor.draft.groupIds, group.id] : editor.draft.groupIds.filter(id => id !== group.id) })}/><span>{group.name} <span className={styles.muted}>({group.count})</span></span></label>) : <p className={styles.muted}>No eligible groups found.</p>}</div>}
              {editor.draft.mode === "INDIVIDUALS" && <><label className={styles.field}>Find a client<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or email"/></label><div className={styles.choices}>{dashboard.clients.filter(client => `${client.displayName} ${client.email}`.toLowerCase().includes(search.toLowerCase())).map(client => <label key={client.id} className={styles.check}><input type="checkbox" checked={editor.draft.clientIds.includes(client.id)} onChange={event => updateDraft({ clientIds: event.target.checked ? [...editor.draft.clientIds, client.id] : editor.draft.clientIds.filter(id => id !== client.id) })}/><span>{client.displayName}<br/><span className={styles.muted}>{client.email}</span></span></label>)}</div></>}
              <p className="mt-3 text-sm text-orange-200">{recipients.length} eligible recipient{recipients.length === 1 ? "" : "s"}</p><p className={`${styles.muted} mt-1`}>Unsubscribed, invalid, archived, and suppressed addresses are excluded. Eligibility is checked again before delivery.</p>
            </div>
            <div className={styles.step}><h3>2. Make it personal</h3><label className={styles.field}>Subject<input value={editor.draft.subject} maxLength={160} onChange={event => updateDraft({ subject: event.target.value })}/></label><label className={styles.field}>Inbox preview<input value={editor.draft.previewText} maxLength={180} onChange={event => updateDraft({ previewText: event.target.value })}/></label><label className={styles.field}>Message<textarea rows={11} maxLength={19000} value={editor.draft.body} onChange={event => updateDraft({ body: event.target.value })}/></label><p className={styles.muted}>Use {"{{FIRST_NAME}}"} for a friendly greeting. The survey link and already-responded note are added automatically.</p></div>
            <div className={styles.step}><h3>3. Review and choose a time</h3><div className={styles.notice}>{survey.anonymousNotice}</div><div className="mt-4"><label className={styles.field}>Delivery date and time<input type="datetime-local" value={scheduledLocal} onChange={event => { setScheduledLocal(event.target.value); setAcknowledged(false); }}/></label><label className={styles.field}>Time zone<select value={timeZone} onChange={event => { setTimeZone(event.target.value); setAcknowledged(false); }}>{["America/Denver", "America/Los_Angeles", "America/Chicago", "America/New_York", "Pacific/Honolulu", "America/Anchorage", "UTC"].map(zone => <option key={zone}>{zone}</option>)}</select></label></div><p className={styles.muted}>Delivery runs about every five minutes. The date and time are applied only when you confirm scheduling, not when you save a draft. Times use the selected time zone.</p><div className={`${styles.row} mt-4`}><button type="button" className={styles.button} onClick={() => perform("save", async () => { await saveDraft(); setMessage("Draft saved. Nothing has been scheduled or sent. Delivery time is applied only when you confirm scheduling."); })}>{pending === "save" ? "Saving…" : "Save draft"}</button><button type="button" className={styles.button} onClick={() => setConfirmation({ type: "test", operationId: crypto.randomUUID() })}>Send myself a test</button><button type="button" className={styles.primary} disabled={!scheduledLocal || !recipients.length || !editor.draft.subject.trim() || !editor.draft.body.trim()} onClick={() => perform("review", async () => { const reminder = await saveDraft(); setAcknowledged(false); setConfirmation({ type: "schedule", reminder }); })}>{pending === "review" ? "Saving…" : "Review schedule"}</button></div></div>
          </fieldset>
        </section>
        <aside className={`${styles.card} ${styles.preview}`} aria-label="Reminder preview"><div className={styles.split}><div><p className={styles.eyebrow}>Email preview</p><h3 className="mt-2">What your client will see</h3></div><span className={styles.badge}>{previewLoading ? "Updating…" : "Sample recipient"}</span></div><p className={`${styles.muted} mt-3`}>Subject: {preview?.subject || editor.draft.subject || "Add a subject"}</p>{previewError && <p role="alert" className={`${styles.error} mt-3`}>{previewError}</p>}{preview ? <iframe title="Feedback reminder email preview" srcDoc={preview.html} sandbox="" referrerPolicy="no-referrer" className="mt-4 h-[660px] w-full rounded-lg border-0 bg-white"/> : <div className={`${styles.message} mt-4`}>{feedbackEmailBody(editor.draft.body)}</div>}<p className={`${styles.muted} mt-3`}>Preview only. Survey responses stay anonymous. Unsubscribe controls are disabled in preview and test messages.</p></aside>
      </div>}
    </div>
    <AccessibleDialog open={!!confirmation} onClose={() => { if (!pendingRef.current) setConfirmation(null); }} labelledBy="feedback-confirmation-title" size="max-w-xl"><div className={`${styles.workspace} ${styles.dialog}`}>
      <h2 id="feedback-confirmation-title">{confirmation?.type === "schedule" ? "Schedule this reminder?" : confirmation?.type === "test" ? "Send a test to yourself?" : confirmation?.type === "discard" ? "Discard unsaved changes?" : confirmation?.type === "pause" ? "Pause this reminder?" : "Cancel this reminder?"}</h2>
      {confirmation?.type === "schedule" ? <><p className="mt-4">“{confirmation.reminder?.subject}” will be sent to {recipients.length} eligible recipients on {scheduledTime}. This enables automatic delivery.</p><div className={`${styles.notice} mt-4`}>{survey.anonymousNotice}</div><label className={`${styles.check} mt-4`}><input type="checkbox" checked={acknowledged} disabled={!!pending} onChange={event => setAcknowledged(event.target.checked)}/><span>I understand this may include clients who already responded, and I approve this audience, message, and delivery time.</span></label></> : confirmation?.type === "test" ? <p className="mt-4">A sample email will be sent only to {dashboard.defaultTestEmail}. No client reminders will be scheduled or sent.</p> : confirmation?.type === "discard" ? <p className="mt-4">Changes since your last save will be lost. Saved drafts remain in your reminder plan.</p> : confirmation?.type === "pause" ? <p className="mt-4">“{confirmation.reminder?.subject}” ({confirmation.reminder?.recipientCount} recipients, {dateLabel(confirmation.reminder?.scheduledAt || null, confirmation.reminder?.scheduledTimeZone || "America/Denver")}) will return to drafts and will not send. Edit it, then review and schedule it again when ready.</p> : <p className="mt-4">“{confirmation?.reminder?.subject}” will be kept in history but will not send. {confirmation?.reminder?.status === "SCHEDULED" ? `${confirmation.reminder.recipientCount} recipients · ${dateLabel(confirmation.reminder.scheduledAt, confirmation.reminder.scheduledTimeZone || "America/Denver")}. ` : ""}A delivery already in progress cannot be cancelled.</p>}
      {error && <p role="alert" className={`${styles.error} mt-4`}>{error}</p>}
      <div className={`${styles.row} mt-6`}><button type="button" className={styles.button} disabled={!!pending} onClick={() => setConfirmation(null)}>Go back</button><button type="button" className={styles.primary} disabled={!!pending || (confirmation?.type === "schedule" && !acknowledged)} onClick={confirmAction}>{pending ? "Working…" : confirmation?.type === "schedule" ? "Confirm schedule" : confirmation?.type === "test" ? "Send test" : confirmation?.type === "discard" ? "Discard changes" : confirmation?.type === "pause" ? "Pause reminder" : "Cancel reminder"}</button></div>
    </div></AccessibleDialog>
  </div>;
}
