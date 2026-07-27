"use client";

import { useMemo, useRef, useState } from "react";
import { renderPersonalizedEmail } from "@/lib/client-communications/personalization";

type Client = { id: string; firstName: string; lastName: string; displayName: string; email: string; phone: string | null; groupIds: string[] };
type Group = { id: string; name: string; count: number };
type Campaign = {
  id: string; subject: string; previewText: string | null; body: string; status: string;
  recipientMode: string; selection: { groupIds?: string[]; clientIds?: string[] };
  recipientCount: number; sentCount: number; failedCount: number; createdAt: string;
  sentAt: string | null; scheduledAt: string | null; scheduledTimeZone: string | null;
  rowVersion: number; createdBy: { displayName: string };
};
type Mode = "ALL" | "GROUPS" | "INDIVIDUALS";
type Field = "subject" | "previewText" | "body";
type AiDraft = { subjectOptions?: string[]; previewText?: string; body?: string; cta?: string };

const variables = [
  ["First Name", "{{FIRST_NAME}}"], ["Last Name", "{{LAST_NAME}}"],
  ["Full Name", "{{FULL_NAME}}"], ["Email", "{{EMAIL}}"], ["Phone", "{{PHONE}}"],
] as const;

export default function BulkEmailStudio({ clients, groups, campaigns, canSend, defaultTestEmail }: {
  clients: Client[]; groups: Group[]; campaigns: Campaign[]; canSend: boolean; defaultTestEmail: string;
}) {
  const [mode, setMode] = useState<Mode>("ALL");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [previewClientId, setPreviewClientId] = useState("");
  const [personalizedPreview, setPersonalizedPreview] = useState(false);
  const [activeField, setActiveField] = useState<Field>("body");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState(campaigns);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reschedulingCampaign, setReschedulingCampaign] = useState<Campaign | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [minimumScheduleLocal, setMinimumScheduleLocal] = useState("");
  const [scheduleTimeZone, setScheduleTimeZone] = useState("America/Denver");
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("Refined and warm");
  const [aiLength, setAiLength] = useState("Concise");
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? clients.filter((client) => `${client.displayName} ${client.email}`.toLowerCase().includes(query)) : clients;
  }, [clients, search]);
  const recipientCount = useMemo(() => {
    if (mode === "ALL") return clients.length;
    if (mode === "INDIVIDUALS") return clients.filter((client) => clientIds.includes(client.id)).length;
    return clients.filter((client) => client.groupIds.some((groupId) => groupIds.includes(groupId))).length;
  }, [clients, clientIds, groupIds, mode]);
  const previewProfile = useMemo(() => {
    const client = clients.find(({ id }) => id === previewClientId);
    return client ? { firstName: client.firstName, lastName: client.lastName, fullName: client.displayName, email: client.email, phone: client.phone }
      : { firstName: "Jake", lastName: "Guerin", fullName: "Jake Guerin", email: "jake@heliosrealestatemedia.com", phone: "970.682.5533" };
  }, [clients, previewClientId]);
  const preview = personalizedPreview
    ? renderPersonalizedEmail({ subject, previewText, body, recipient: previewProfile })
    : { subject, previewText, body };

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function insertVariable(token: string) {
    const config = {
      subject: [subject, setSubject, subjectRef.current],
      previewText: [previewText, setPreviewText, previewRef.current],
      body: [body, setBody, bodyRef.current],
    }[activeField] as [string, (value: string) => void, HTMLInputElement | HTMLTextAreaElement | null];
    const [value, setter, element] = config;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    setter(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function writeWithAi() {
    setBusy("ai"); setMessage(null);
    try {
      const response = await fetch("/api/admin/email-ai", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({brief:aiBrief,tone:aiTone,length:aiLength}) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "AI could not complete the draft.");
      setAiDraft(data.draft); setMessage({tone:"ok",text:"AI draft ready. Review it before accepting any field."});
    } catch(error) { setMessage({tone:"error",text:error instanceof Error?error.message:"AI could not complete the draft."}); }
    finally { setBusy(null); }
  }
  function acceptAiDraft() {
    if ((subject.trim()||previewText.trim()||body.trim())&&!window.confirm("Replace the populated email fields with this AI draft?")) return;
    const option=aiDraft?.subjectOptions?.[0]||"";
    setSubject(option); setPreviewText(aiDraft?.previewText||""); setBody([aiDraft?.body,aiDraft?.cta].filter(Boolean).join("\n\n"));
    setAiDraft(null); setMessage({tone:"ok",text:"AI draft accepted. You remain in full control—review and edit before testing or sending."});
  }

  async function submit(action: "test" | "send" | "schedule") {
    if (action === "send" && !window.confirm(`Send this campaign to ${recipientCount} recipients now? This cannot be undone.`)) return;
    setBusy(action);
    setMessage(null);
    try {
      const rescheduling = action === "schedule" ? reschedulingCampaign : null;
      const response = await fetch(rescheduling ? `/api/admin/email-campaigns/${rescheduling.id}` : "/api/admin/email-campaigns", {
        method: rescheduling ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: rescheduling ? "reschedule" : action, subject, previewText, body, mode, groupIds, clientIds, testEmail,
          previewClientId: previewClientId || undefined,
          scheduledLocal: scheduleLocal, scheduledTimeZone: scheduleTimeZone,
          rowVersion: rescheduling?.rowVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
      setMessage({ tone: "ok", text: data.message });
      if (action === "schedule") {
        setScheduleOpen(false);
        setReschedulingCampaign(null);
        if (rescheduling) {
          setHistory((current) => current.map((item) => item.id === rescheduling.id ? {
            ...item, scheduledAt: new Date(scheduleLocal).toISOString(), scheduledTimeZone: scheduleTimeZone, rowVersion: item.rowVersion + 1,
          } : item));
        } else setHistory((current) => [{
          id: data.campaignId, subject, previewText, body, status: "SCHEDULED", recipientMode: mode,
          selection: { groupIds, clientIds }, recipientCount, sentCount: 0, failedCount: 0,
          createdAt: new Date().toISOString(), sentAt: null, scheduledAt: data.scheduledAt,
          scheduledTimeZone: scheduleTimeZone, rowVersion: 1, createdBy: { displayName: "You" },
        }, ...current]);
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The request could not be completed." });
    } finally {
      setBusy(null);
    }
  }

  function openSchedule(campaign?: Campaign) {
    setMinimumScheduleLocal(new Date(Date.now() + 120_000).toISOString().slice(0, 16));
    setReschedulingCampaign(campaign ?? null);
    if (campaign?.scheduledAt) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: campaign.scheduledTimeZone ?? "America/Denver", year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(new Date(campaign.scheduledAt));
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      setScheduleLocal(`${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`);
      setScheduleTimeZone(campaign.scheduledTimeZone ?? "America/Denver");
    }
    setScheduleOpen(true);
  }

  async function manageCampaign(campaign: Campaign, action: "cancel" | "send-now" | "edit") {
    if ((action === "cancel" || action === "edit") && !window.confirm(action === "edit" ? "Cancel this schedule and return its content to the composer?" : "Cancel this scheduled email?")) return;
    setBusy(`${action}:${campaign.id}`);
    try {
      const response = await fetch(`/api/admin/email-campaigns/${campaign.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rowVersion: campaign.rowVersion }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The campaign could not be updated.");
      if (action === "edit") {
        setSubject(campaign.subject); setPreviewText(campaign.previewText ?? ""); setBody(campaign.body);
        setMode(campaign.recipientMode as Mode);
        setGroupIds(campaign.selection.groupIds ?? []); setClientIds(campaign.selection.clientIds ?? []);
      }
      setHistory((current) => current.map((item) => item.id === campaign.id
        ? { ...item, status: action === "cancel" ? "CANCELLED" : action === "edit" ? "DRAFT" : "PROCESSING", rowVersion: item.rowVersion + 1 }
        : item));
      setMessage({ tone: "ok", text: action === "edit" ? "Schedule cancelled and campaign returned to the composer." : action === "cancel" ? "Schedule cancelled." : "Campaign released for immediate delivery." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The campaign could not be updated." });
    } finally { setBusy(null); }
  }

  const disabled = !canSend || busy !== null || !subject.trim() || !body.trim();
  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]">
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-white/30">01 · Audience</p><h2 className="mt-2 text-2xl font-light text-white">Choose recipients</h2></div><p className="rounded-full border border-[#e7ddc8]/20 bg-[#e7ddc8]/[0.07] px-4 py-2 text-sm text-[#e7ddc8]">{recipientCount} eligible</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{(["ALL", "GROUPS", "INDIVIDUALS"] as Mode[]).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${mode === value ? "border-[#e7ddc8]/35 bg-[#e7ddc8]/10 text-[#f3ead8]" : "border-white/[0.08] text-white/40 hover:border-white/15"}`}>{value === "ALL" ? "All clients" : value === "GROUPS" ? "Groups" : "Individuals"}</button>)}</div>
        {mode === "GROUPS" && <div className="mt-5 grid gap-2 sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-sm text-white/55"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggle(group.id, groupIds, setGroupIds)} /><span className="flex-1">{group.name}</span><span className="text-xs text-white/25">{group.count}</span></label>)}</div>}
        {mode === "INDIVIDUALS" && <div className="mt-5"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients…" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/25" /><div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/[0.07]">{filteredClients.map((client) => <label key={client.id} className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0"><input type="checkbox" checked={clientIds.includes(client.id)} onChange={() => toggle(client.id, clientIds, setClientIds)} /><span className="min-w-0"><span className="block truncate text-sm text-white/65">{client.displayName}</span><span className="block truncate text-xs text-white/30">{client.email}</span></span></label>)}</div></div>}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-white/30">02 · Message</p><h2 className="mt-2 text-2xl font-light text-white">Compose email</h2>
        <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-[var(--helios-orange)]">Write with AI</p><p className="mt-2 text-xs leading-5 text-white/35">Generate a reviewable draft only. AI cannot choose recipients, schedule, approve, or send.</p></div>{busy==="ai"&&<span role="status" className="text-sm text-emerald-300">AI is writing…</span>}</div>
          <textarea rows={4} maxLength={5000} value={aiBrief} onChange={e=>setAiBrief(e.target.value)} placeholder="Describe the purpose, verified facts, audience, and desired call to action…" className="mt-4 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]"/>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/35">Tone<select value={aiTone} onChange={e=>setAiTone(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white"><option>Refined and warm</option><option>Professional and direct</option><option>Conversational</option><option>Celebratory</option></select></label><label className="text-xs text-white/35">Length<select value={aiLength} onChange={e=>setAiLength(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white"><option>Concise</option><option>Standard</option><option>Detailed</option></select></label></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy!==null||aiBrief.trim().length<12} onClick={writeWithAi} className="admin-btn-primary">{aiDraft?"Retry":"Generate"}</button>{aiDraft&&<><button type="button" onClick={acceptAiDraft} className="admin-btn-secondary">Accept draft</button><button type="button" onClick={()=>setAiDraft(null)} className="admin-btn-link">Discard</button></>}</div>
          {aiDraft&&<div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4 text-sm text-white/55"><p className="font-medium text-white/75">{aiDraft.subjectOptions?.[0]||"Subject option unavailable"}</p>{aiDraft.previewText&&<p className="mt-2 text-xs text-white/35">{aiDraft.previewText}</p>}<p className="mt-4 whitespace-pre-wrap leading-6">{aiDraft.body}</p>{aiDraft.cta&&<p className="mt-3 text-[var(--helios-orange)]">{aiDraft.cta}</p>}</div>}
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-xs text-white/35">Subject<input ref={subjectRef} value={subject} maxLength={160} onFocus={() => setActiveField("subject")} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label>
          <label className="block text-xs text-white/35">Preview text <span className="text-white/20">(optional)</span><input ref={previewRef} value={previewText} maxLength={180} onFocus={() => setActiveField("previewText")} onChange={(event) => setPreviewText(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label>
          <label className="block text-xs text-white/35">Message<textarea ref={bodyRef} value={body} maxLength={20000} onFocus={() => setActiveField("body")} onChange={(event) => setBody(event.target.value)} rows={12} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal leading-7 text-white" /></label>
        </div>
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/35">Personalization Variables</p>
          <p className="mt-2 text-xs leading-5 text-white/30">Variables are replaced separately for each recipient. Select a field, then insert a token at the cursor.</p>
          <div className="mt-3 flex flex-wrap gap-2">{variables.map(([label, token]) => <button key={token} type="button" onClick={() => insertVariable(token)} className="rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-white/55 hover:border-[#e7ddc8]/30"><span className="block">{label}</span><span className="text-[10px] text-white/25">{token}</span></button>)}</div>
          <p className="mt-3 whitespace-pre-line text-xs text-white/25">{"Example:\nHello {{FIRST_NAME}},\n\nI wanted to share a quick update with you."}</p>
        </div>
      </section>
      {message && <p role="status" className={`rounded-xl border px-5 py-4 text-sm ${message.tone === "ok" ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80" : "border-red-400/20 bg-red-400/[0.06] text-red-200/80"}`}>{message.text}</p>}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
        <div className="grid gap-3 md:grid-cols-2"><label className="text-xs text-white/35">Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label><label className="text-xs text-white/35">Preview/Test personalization<select value={previewClientId} onChange={(event) => setPreviewClientId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm font-normal text-white"><option value="">Sample · Jake Guerin</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName} · {client.email}</option>)}</select></label></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={disabled} onClick={() => submit("test")} className="admin-btn-secondary">{busy === "test" ? "Sending test…" : "Send Test"}</button><button type="button" disabled={disabled || recipientCount === 0} onClick={() => openSchedule()} className="admin-btn-secondary">Schedule Email</button><button type="button" disabled={disabled || recipientCount === 0} onClick={() => submit("send")} className="admin-btn-primary">{busy === "send" ? "Sending…" : "Send Now"}</button></div>
      </section>
      {!canSend && <p className="text-xs text-amber-200/65">Owner or administrator access is required to test, schedule, or send campaigns.</p>}
    </div>
    <aside className="space-y-6">
      <section className="sticky top-6 rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.16em] text-white/30">Live preview</p><button type="button" onClick={() => setPersonalizedPreview((value) => !value)} className="text-xs text-[#e7ddc8]/60">{personalizedPreview ? "Personalized" : "Template"}</button></div>
        {personalizedPreview && <p className="mt-2 text-xs text-white/25">Previewing as {previewProfile.fullName}; final content varies by recipient.</p>}
        <div className="mt-5 bg-[#0b0b0b] p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--helios-orange)]">Helios Real Estate Media</p><h3 className="mt-5 text-xl font-light text-white">{preview.subject || "Your email subject"}</h3>{preview.previewText && <p className="mt-2 text-xs text-white/30">{preview.previewText}</p>}<div className="mt-5 whitespace-pre-wrap border border-white/[0.08] bg-[#121211] p-5 text-sm leading-7 text-white/60">{preview.body || "Your message preview will appear here."}</div></div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6"><p className="text-xs uppercase tracking-[0.16em] text-white/30">Campaign history</p><div className="mt-4 divide-y divide-white/[0.06]">{history.map((campaign) => <article key={campaign.id} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-3"><p className="text-sm text-white/65">{campaign.subject}</p><span className="text-[10px] uppercase tracking-[0.12em] text-white/30">{campaign.status}</span></div><p className="mt-2 text-xs text-white/25">{campaign.status === "SCHEDULED" && campaign.scheduledAt ? `Scheduled ${new Date(campaign.scheduledAt).toLocaleString("en-US", { timeZone: campaign.scheduledTimeZone ?? "America/Denver", timeZoneName: "short" })}` : `${campaign.sentCount}/${campaign.recipientCount} sent`} · {new Date(campaign.createdAt).toLocaleDateString()}</p>{campaign.status === "SCHEDULED" && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openSchedule(campaign)} className="text-xs text-[#e7ddc8]/65">Reschedule</button><button type="button" onClick={() => manageCampaign(campaign, "send-now")} className="text-xs text-[#e7ddc8]/65">Send Now</button><button type="button" onClick={() => manageCampaign(campaign, "edit")} className="text-xs text-white/40">Edit Campaign</button><button type="button" onClick={() => manageCampaign(campaign, "cancel")} className="text-xs text-red-200/55">Cancel Schedule</button></div>}</article>)}{!history.length && <p className="py-6 text-sm text-white/30">No campaigns yet.</p>}</div></section>
    </aside>
    {scheduleOpen && <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl"><h2 id="schedule-title" className="text-2xl font-light text-white">{reschedulingCampaign ? "Reschedule Email" : "Schedule Email"}</h2><p className="mt-2 text-sm text-white/35">{reschedulingCampaign?.recipientCount ?? recipientCount} recipients · {reschedulingCampaign?.subject || subject || "Untitled campaign"}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/35">Send date and time<input type="datetime-local" value={scheduleLocal} min={minimumScheduleLocal} onChange={(event) => setScheduleLocal(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><label className="text-xs text-white/35">Timezone<select value={scheduleTimeZone} onChange={(event) => setScheduleTimeZone(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option></select></label></div><p className="mt-4 text-xs leading-5 text-white/30">Delivery time is saved in UTC while preserving the selected timezone. Recipient membership and personalization values are frozen when scheduled; compliance is checked again before delivery.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setScheduleOpen(false); setReschedulingCampaign(null); }} className="admin-btn-secondary">Cancel</button><button type="button" disabled={!scheduleLocal || busy !== null} onClick={() => submit("schedule")} className="admin-btn-primary">{busy === "schedule" ? "Scheduling…" : reschedulingCampaign ? "Confirm Reschedule" : "Confirm Schedule"}</button></div></div></div>}
  </div>;
}
