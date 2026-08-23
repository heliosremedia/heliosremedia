"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { renderPersonalizedEmail } from "@/lib/client-communications/personalization";
import SentCampaignSnapshot from "./SentCampaignSnapshot";
import { cleanPastedEmailText, EMAIL_TEMPLATES, normalizeEmailTemplateKey, renderFormattedEmailBody, type EmailTemplateKey } from "@/lib/client-communications/email-format";

type Client = { id: string; firstName: string; lastName: string; displayName: string; email: string; phone: string | null; groupIds: string[] };
type Group = { id: string; name: string; count: number };
type Campaign = {
  id: string; subject: string; previewText: string | null; body: string; templateKey: string; status: string;
  imageUrl: string | null; imageAlt: string | null; imageCaption: string | null; imageLink: string | null;
  recipientMode: string; selection: { groupIds?: string[]; clientIds?: string[] };
  recipientCount: number; sentCount: number; failedCount: number; createdAt: string;
  sentAt: string | null; scheduledAt: string | null; scheduledTimeZone: string | null;
  rowVersion: number; createdBy: { displayName: string };
  delivery: { accepted: number; delivered: number; failed: number; awaitingConfirmation: number };
};
type Mode = "ALL" | "GROUPS" | "INDIVIDUALS";
type Field = "subject" | "previewText" | "body";
type AiDraft = { subjectOptions?: string[]; previewText?: string; body?: string; cta?: string };
type MediaLibraryItem = { id: string; url: string; thumbnailUrl: string; label: string; altText?: string | null };

const variables = [
  ["First Name", "{{FIRST_NAME}}"], ["Last Name", "{{LAST_NAME}}"],
  ["Full Name", "{{FULL_NAME}}"], ["Email", "{{EMAIL}}"], ["Phone", "{{PHONE}}"],
] as const;

function campaignHistorySummary(campaign: Campaign) {
  if (campaign.status === "DRAFT") return "Saved draft";
  if (campaign.status === "SCHEDULED" && campaign.scheduledAt) {
    return `Scheduled ${new Date(campaign.scheduledAt).toLocaleString("en-US", { timeZone: campaign.scheduledTimeZone ?? "America/Denver", timeZoneName: "short" })}`;
  }
  if (["SENT", "PARTIAL", "FAILED"].includes(campaign.status)) {
    const parts = [
      `${campaign.delivery.delivered} delivered`,
      `${campaign.delivery.accepted} provider accepted`,
      campaign.delivery.awaitingConfirmation ? `${campaign.delivery.awaitingConfirmation} awaiting confirmation` : null,
      campaign.delivery.failed ? `${campaign.delivery.failed} failed` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  return `${campaign.recipientCount} eligible ${campaign.recipientCount === 1 ? "recipient" : "recipients"}`;
}

export default function BulkEmailStudio({ clients, groups, campaigns, canSend, defaultTestEmail, initialDraft }: {
  clients: Client[]; groups: Group[]; campaigns: Campaign[]; canSend: boolean; defaultTestEmail: string;
  initialDraft?: { id: string; subject: string; previewText: string | null; body: string; templateKey: string; imageUrl: string | null; imageAlt: string | null; imageCaption: string | null; imageLink: string | null; recipientMode: string; selection: { groupIds?: string[]; clientIds?: string[] } } | null;
}) {
  const [mode, setMode] = useState<Mode>("ALL");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(initialDraft?.subject || "");
  const [previewText, setPreviewText] = useState(initialDraft?.previewText || "");
  const [body, setBody] = useState(initialDraft?.body || "");
  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>(normalizeEmailTemplateKey(initialDraft?.templateKey));
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [imageUrl, setImageUrl] = useState(initialDraft?.imageUrl || "");
  const [imageAlt, setImageAlt] = useState(initialDraft?.imageAlt || "");
  const [imageCaption, setImageCaption] = useState(initialDraft?.imageCaption || "");
  const [imageLink, setImageLink] = useState(initialDraft?.imageLink || "");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaLibraryItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [previewClientId, setPreviewClientId] = useState("");
  const [personalizedPreview, setPersonalizedPreview] = useState(false);
  const [activeField, setActiveField] = useState<Field>("body");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState(campaigns);
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reschedulingCampaign, setReschedulingCampaign] = useState<Campaign | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [minimumScheduleLocal, setMinimumScheduleLocal] = useState("");
  const [scheduleTimeZone, setScheduleTimeZone] = useState("America/Denver");
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("Refined and warm");
  const [aiLength, setAiLength] = useState("Concise");
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [insertedToken, setInsertedToken] = useState<string | null>(null);
  const lastInsertionRef = useRef<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!viewingCampaign) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewingCampaign(null);
        window.setTimeout(() => historyTriggerRef.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [viewingCampaign]);

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
      : { firstName: "Preview", lastName: "Recipient", fullName: "Preview Recipient", email: "preview@example.com", phone: "(555) 010-0193" };
  }, [clients, previewClientId]);
  const preview = personalizedPreview
    ? renderPersonalizedEmail({ subject, previewText, body, recipient: previewProfile })
    : { subject, previewText, body };

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function insertVariable(token: string) {
    if (lastInsertionRef.current === token) return;
    lastInsertionRef.current = token;
    window.setTimeout(() => {
      if (lastInsertionRef.current === token) lastInsertionRef.current = null;
    }, 600);
    const config = {
      subject: [subject, setSubject, subjectRef.current],
      previewText: [previewText, setPreviewText, previewRef.current],
      body: [body, setBody, bodyRef.current],
    }[activeField] as [string, (value: string) => void, HTMLInputElement | HTMLTextAreaElement | null];
    const [value, setter, element] = config;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    setter(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setInsertedToken(token);
    window.setTimeout(() => setInsertedToken((current) => current === token ? null : current), 1400);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function wrapBodySelection(before: string, after = before, placeholder = "text") {
    const element = bodyRef.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? start;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixBodySelection(prefix: string, placeholder: string) {
    const element = bodyRef.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? start;
    const selected = body.slice(start, end) || placeholder;
    const formatted = selected.split("\n").map((line) => `${prefix}${line}`).join("\n");
    setBody(`${body.slice(0, start)}${formatted}${body.slice(end)}`);
    requestAnimationFrame(() => element?.focus());
  }

  function cleanFormatting() {
    const cleaned = cleanPastedEmailText(body);
    setBody(cleaned);
    setMessage({ tone: "ok", text: cleaned === body ? "Formatting is already clean." : "Copied formatting cleaned. Markdown emphasis and personalization tokens were preserved." });
  }

  async function formatWithAi() {
    setBusy("format-ai"); setMessage(null);
    try {
      const response = await fetch("/api/admin/email-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "format", body, templateKey }) });
      const data = await response.json();
      if (!response.ok || !data.success || typeof data.formattedBody !== "string") throw new Error(data.error || "AI could not format this message.");
      if (!window.confirm("Apply the AI formatting? Wording will remain unchanged, but emphasis and section structure may be added.")) return;
      setBody(data.formattedBody);
      setMessage({ tone: "ok", text: `AI formatting applied${Array.isArray(data.changes) && data.changes.length ? `: ${data.changes.join("; ")}` : "."} Review the preview before sending.` });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "AI could not format this message." }); }
    finally { setBusy(null); }
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

  async function loadMediaImages(searchValue = mediaSearch) {
    setMediaLoading(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/newsletters/images?source=ALL&search=${encodeURIComponent(searchValue)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Media Library could not be loaded.");
      setMediaItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Media Library could not be loaded." }); }
    finally { setMediaLoading(false); }
  }

  async function uploadEmailImage(file: File) {
    setBusy("upload-image"); setMessage(null);
    try {
      const response = await fetch("/api/admin/email-images/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The image could not be prepared.");
      const uploaded = await fetch(data.upload.uploadUrl, { method: "PUT", headers: { "Content-Type": data.upload.contentType }, body: file });
      if (!uploaded.ok) throw new Error("The image upload did not complete.");
      setImageUrl(data.upload.publicUrl);
      if (!imageAlt.trim()) setImageAlt(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      setMessage({ tone: "ok", text: "Image uploaded. Review its accessibility description before sending." });
    } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "The image could not be uploaded." }); }
    finally { setBusy(null); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  function restoreCampaignImage(campaign: Campaign) {
    setImageUrl(campaign.imageUrl ?? ""); setImageAlt(campaign.imageAlt ?? "");
    setImageCaption(campaign.imageCaption ?? ""); setImageLink(campaign.imageLink ?? "");
  }

  async function submit(action: "draft" | "test" | "send" | "schedule") {
    if (action === "send" && !window.confirm(`Send this campaign to ${recipientCount} recipients now? This cannot be undone.`)) return;
    setBusy(action);
    setMessage(null);
    try {
      const rescheduling = action === "schedule" ? reschedulingCampaign : null;
      const response = await fetch(rescheduling ? `/api/admin/email-campaigns/${rescheduling.id}` : "/api/admin/email-campaigns", {
        method: rescheduling ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: rescheduling ? "reschedule" : action, draftId, subject, previewText, body, templateKey, imageUrl, imageAlt, imageCaption, imageLink, mode, groupIds, clientIds, testEmail,
          previewClientId: previewClientId || undefined,
          scheduledLocal: scheduleLocal, scheduledTimeZone: scheduleTimeZone,
          rowVersion: rescheduling?.rowVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The request could not be completed.");
      setMessage({ tone: "ok", text: data.message });
      if (action === "draft") {
        setDraftId(data.campaignId);
        const saved: Campaign = {
          id: data.campaignId, subject: subject || "Untitled email", previewText, body, templateKey, imageUrl: imageUrl || null, imageAlt: imageAlt || null, imageCaption: imageCaption || null, imageLink: imageLink || null, status: "DRAFT", recipientMode: mode,
          selection: { groupIds, clientIds }, recipientCount: 0, sentCount: 0, failedCount: 0,
          createdAt: new Date().toISOString(), sentAt: null, scheduledAt: null, scheduledTimeZone: null,
          rowVersion: 1, createdBy: { displayName: "You" }, delivery: { accepted: 0, delivered: 0, failed: 0, awaitingConfirmation: 0 },
        };
        setHistory((current) => [saved, ...current.filter((item) => item.id !== data.campaignId)]);
      }
      if (action === "schedule") {
        if (draftId) setHistory((current) => current.filter((item) => item.id !== draftId));
        setDraftId(null);
        setScheduleOpen(false);
        setReschedulingCampaign(null);
        if (rescheduling) {
          setHistory((current) => current.map((item) => item.id === rescheduling.id ? {
            ...item, scheduledAt: new Date(scheduleLocal).toISOString(), scheduledTimeZone: scheduleTimeZone, rowVersion: item.rowVersion + 1,
          } : item));
        } else setHistory((current) => [{
          id: data.campaignId, subject, previewText, body, templateKey, imageUrl: imageUrl || null, imageAlt: imageAlt || null, imageCaption: imageCaption || null, imageLink: imageLink || null, status: "SCHEDULED", recipientMode: mode,
          selection: { groupIds, clientIds }, recipientCount, sentCount: 0, failedCount: 0,
          createdAt: new Date().toISOString(), sentAt: null, scheduledAt: data.scheduledAt,
          scheduledTimeZone: scheduleTimeZone, rowVersion: 1, createdBy: { displayName: "You" },
          delivery: { accepted: 0, delivered: 0, failed: 0, awaitingConfirmation: 0 },
        }, ...current]);
      } else if (action === "send" && data.sent > 0) {
        if (draftId) setHistory((current) => current.filter((item) => item.id !== draftId));
        setDraftId(null);
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The request could not be completed." });
    } finally {
      setBusy(null);
    }
  }

  function resumeDraft(campaign: Campaign) {
    if ((subject.trim() || previewText.trim() || body.trim()) && campaign.id !== draftId && !window.confirm("Replace the current composer with this saved draft?")) return;
    setSubject(campaign.subject === "Untitled email" ? "" : campaign.subject);
    setPreviewText(campaign.previewText ?? "");
    setBody(campaign.body);
    setTemplateKey(normalizeEmailTemplateKey(campaign.templateKey));
    restoreCampaignImage(campaign);
    setMode(["ALL", "GROUPS", "INDIVIDUALS"].includes(campaign.recipientMode) ? campaign.recipientMode as Mode : "ALL");
    setGroupIds(campaign.selection.groupIds ?? []);
    setClientIds(campaign.selection.clientIds ?? []);
    setDraftId(campaign.id);
    setViewingCampaign(null);
    setMessage({ tone: "ok", text: "Draft reopened in the composer. Review recipients before testing, scheduling, or sending." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteDraft(campaign: Campaign) {
    if (!window.confirm(`Delete the draft “${campaign.subject}”? This cannot be undone.`)) return;
    setBusy(`delete:${campaign.id}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/email-campaigns/${campaign.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The draft could not be deleted.");
      setHistory((current) => current.filter((item) => item.id !== campaign.id));
      if (draftId === campaign.id) setDraftId(null);
      setMessage({
        tone: "ok",
        text: draftId === campaign.id
          ? "Saved draft deleted. Its content remains in the composer until you clear it or save it again."
          : "Draft deleted.",
      });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The draft could not be deleted." });
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
        setSubject(campaign.subject); setPreviewText(campaign.previewText ?? ""); setBody(campaign.body); setTemplateKey(normalizeEmailTemplateKey(campaign.templateKey)); restoreCampaignImage(campaign);
        setDraftId(campaign.id);
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

  const disabled = !canSend || busy !== null || !subject.trim() || !body.trim() || Boolean(imageUrl && !imageAlt.trim());
  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">01 · Audience</p><h2 className="mt-2 text-2xl font-light text-white">Choose recipients</h2></div><p className="rounded-full border border-[#e7ddc8]/20 bg-[#e7ddc8]/[0.07] px-4 py-2 text-sm text-[#e7ddc8]">{recipientCount} eligible</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{(["ALL", "GROUPS", "INDIVIDUALS"] as Mode[]).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-xl border px-4 py-3 text-left text-sm transition ${mode === value ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/10 text-white" : "border-white/[0.12] bg-white/[0.025] text-white/65 hover:border-[var(--helios-orange)]/35 hover:text-white"}`}>{value === "ALL" ? "All clients" : value === "GROUPS" ? "Groups" : "Individuals"}</button>)}</div>
        {mode === "GROUPS" && <div className="mt-5 grid gap-2 sm:grid-cols-2">{groups.map((group) => <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] px-4 py-3 text-sm text-white/55"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggle(group.id, groupIds, setGroupIds)} /><span className="flex-1">{group.name}</span><span className="text-xs text-white/25">{group.count}</span></label>)}</div>}
        {mode === "INDIVIDUALS" && <div className="mt-5"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients…" className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/25" /><div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-white/[0.07]">{filteredClients.map((client) => <label key={client.id} className="flex cursor-pointer items-center gap-3 border-b border-white/[0.06] px-4 py-3 last:border-0"><input type="checkbox" checked={clientIds.includes(client.id)} onChange={() => toggle(client.id, clientIds, setClientIds)} /><span className="min-w-0"><span className="block truncate text-sm text-white/65">{client.displayName}</span><span className="block truncate text-xs text-white/30">{client.email}</span></span></label>)}</div></div>}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]">02 · Message</p><h2 className="mt-2 text-2xl font-light text-white">Compose email</h2>
        <div className="mt-5 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.54rem] font-semibold uppercase tracking-[0.16em] text-[var(--helios-orange)]">Write with AI</p><p className="mt-2 text-xs leading-5 text-white/35">Generate a reviewable draft only. AI cannot choose recipients, schedule, approve, or send.</p></div><button type="button" aria-expanded={aiExpanded} aria-controls="email-ai-assistant" onClick={() => setAiExpanded(value => !value)} className="admin-btn-secondary">{aiExpanded ? "Collapse" : "Open assistant"}</button>{busy==="ai"&&<span role="status" className="text-sm text-emerald-300">AI is writing…</span>}</div>
          <div id="email-ai-assistant" hidden={!aiExpanded}>
          <textarea rows={4} maxLength={5000} value={aiBrief} onChange={e=>setAiBrief(e.target.value)} placeholder="Describe the purpose, verified facts, audience, and desired call to action…" className="mt-4 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]"/>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-white/35">Tone<select value={aiTone} onChange={e=>setAiTone(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white"><option>Refined and warm</option><option>Professional and direct</option><option>Conversational</option><option>Celebratory</option></select></label><label className="text-xs text-white/35">Length<select value={aiLength} onChange={e=>setAiLength(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white"><option>Concise</option><option>Standard</option><option>Detailed</option></select></label></div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy!==null||aiBrief.trim().length<12} onClick={writeWithAi} className="admin-btn-primary">{aiDraft?"Retry":"Generate"}</button>{aiDraft&&<><button type="button" onClick={acceptAiDraft} className="admin-btn-secondary">Accept draft</button><button type="button" onClick={()=>setAiDraft(null)} className="admin-btn-link">Discard</button></>}</div>
          {aiDraft&&<div className="mt-4 rounded-xl border border-white/[0.08] bg-black/25 p-4 text-sm text-white/55"><p className="font-medium text-white/75">{aiDraft.subjectOptions?.[0]||"Subject option unavailable"}</p>{aiDraft.previewText&&<p className="mt-2 text-xs text-white/35">{aiDraft.previewText}</p>}<p className="mt-4 whitespace-pre-wrap leading-6">{aiDraft.body}</p>{aiDraft.cta&&<p className="mt-3 text-[var(--helios-orange)]">{aiDraft.cta}</p>}</div>}
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className="text-xs text-white/35">Email template</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">{EMAIL_TEMPLATES.map((template) => <button key={template.key} type="button" aria-pressed={templateKey === template.key} onClick={() => setTemplateKey(template.key)} className={`rounded-xl border p-4 text-left transition ${templateKey === template.key ? "border-[var(--helios-orange)]/55 bg-[var(--helios-orange)]/[0.08]" : "border-white/[0.09] bg-black/20 hover:border-white/20"}`}><span className="flex items-center gap-3"><span aria-hidden="true" className="h-7 w-7 rounded-full border border-white/15" style={{ background: template.swatch }} /><span className="text-sm text-white/75">{template.name}</span></span><span className="mt-2 block text-xs leading-5 text-white/30">{template.description}</span></button>)}</div>
          <p className="mt-3 text-xs leading-5 text-white/25">Templates control presentation only. Your wording, recipients, and sending choices remain unchanged.</p>
        </fieldset>
        <div className="mt-5 space-y-4">
          <label className="block text-xs text-white/35">Subject<input ref={subjectRef} value={subject} maxLength={160} onFocus={() => setActiveField("subject")} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label>
          <label className="block text-xs text-white/35">Preview text <span className="text-white/20">(optional)</span><input ref={previewRef} value={previewText} maxLength={180} onFocus={() => setActiveField("previewText")} onChange={(event) => setPreviewText(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label>
          <div><div className="flex flex-wrap items-center justify-between gap-3"><label htmlFor="email-message" className="text-xs text-white/35">Message</label><div className="flex flex-wrap gap-1" role="toolbar" aria-label="Message formatting"><button type="button" onClick={() => wrapBodySelection("**", "**", "important text")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-white/55" title="Bold">B</button><button type="button" onClick={() => wrapBodySelection("*", "*", "emphasized text")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs italic text-white/55" title="Italic">I</button><button type="button" onClick={() => prefixBodySelection("### ", "Section heading")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/55" title="Heading">H</button><button type="button" onClick={() => prefixBodySelection("- ", "List item")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/55" title="Bulleted list">List</button><button type="button" onClick={() => wrapBodySelection("[", "](https://)", "link text")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/55" title="Link">Link</button><button type="button" onClick={() => setBody((value) => `${value.trimEnd()}\n\n---\n\n`)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/55" title="Divider">Divider</button></div></div><textarea id="email-message" ref={bodyRef} value={body} maxLength={20000} onFocus={() => setActiveField("body")} onChange={(event) => setBody(event.target.value)} rows={12} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal leading-7 text-white" /><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" disabled={!body.trim() || busy !== null} onClick={cleanFormatting} className="admin-btn-secondary">Clean Up Formatting</button><button type="button" disabled={body.trim().length < 12 || busy !== null} onClick={formatWithAi} className="admin-btn-secondary">{busy === "format-ai" ? "Formatting…" : "Format with AI"}</button><span className="text-xs text-white/25">Formatting changes presentation, not your message.</span></div></div>
        </div>
        <section className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4" aria-labelledby="campaign-image-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p id="campaign-image-title" className="text-xs uppercase tracking-[0.14em] text-white/35">Email image <span className="normal-case tracking-normal text-white/20">(optional)</span></p><p className="mt-2 text-xs leading-5 text-white/30">One responsive image appears above the message body for every recipient.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy !== null} onClick={() => { setImagePickerOpen(true); void loadMediaImages(); }} className="admin-btn-secondary">Media Library</button><button type="button" disabled={busy !== null} onClick={() => fileInputRef.current?.click()} className="admin-btn-secondary">{busy === "upload-image" ? "Uploading…" : "Upload Image"}</button></div></div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEmailImage(file); }} />
          {imageUrl && <div className="mt-4 grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]"><div><Image unoptimized src={imageUrl} alt={imageAlt || "Selected campaign image"} width={1200} height={675} className="aspect-video w-full rounded-lg object-cover" /><button type="button" onClick={() => { setImageUrl(""); setImageAlt(""); setImageCaption(""); setImageLink(""); }} className="mt-2 text-[0.68rem] text-red-200/60 transition hover:text-red-200">Remove image</button></div><div className="grid gap-3"><label className="text-xs text-white/35">Accessibility description <span className="text-red-200/60">required to send</span><input value={imageAlt} maxLength={300} onChange={(event) => setImageAlt(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-white/35">Caption <span className="text-white/20">(optional)</span><input value={imageCaption} maxLength={500} onChange={(event) => setImageCaption(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-white/35">Click-through link <span className="text-white/20">(optional HTTPS URL)</span><input type="url" value={imageLink} onChange={(event) => setImageLink(event.target.value)} placeholder="https://" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white" /></label></div></div>}
        </section>
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-white/35">Personalization Variables</p>
          <p className="mt-2 text-xs leading-5 text-white/30">Variables are replaced separately for each recipient. Select a field, then insert a token at the cursor.</p>
          <div className="mt-3 flex flex-wrap gap-2">{variables.map(([label, token]) => <button key={token} type="button" onClick={() => insertVariable(token)} className="rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-white/55 outline-none transition hover:border-[var(--helios-orange)]/55 hover:bg-[var(--helios-orange)]/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]"><span className="block">{insertedToken === token ? "Inserted" : label}</span><span className="text-[10px] text-white/25">{token}</span></button>)}</div>
          <p className="sr-only" aria-live="polite">{insertedToken ? `Inserted ${insertedToken}` : ""}</p>
          <p className="mt-3 whitespace-pre-line text-xs text-white/25">{"Example:\nHello {{FIRST_NAME}},\n\nI wanted to share a quick update with you."}</p>
        </div>
      </section>
      {message && <p role="status" className={`rounded-xl border px-5 py-4 text-sm ${message.tone === "ok" ? "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80" : "border-red-400/20 bg-red-400/[0.06] text-red-200/80"}`}>{message.text}</p>}
      <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5">
        <div className="grid gap-3 md:grid-cols-2"><label className="text-xs text-white/35">Test recipient<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white" /></label><label className="text-xs text-white/35">Preview/Test personalization<select value={previewClientId} onChange={(event) => setPreviewClientId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm font-normal text-white"><option value="">Preview Recipient</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName} · {client.email}</option>)}</select></label></div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end"><button type="button" disabled={busy !== null || (!subject.trim() && !body.trim())} onClick={() => submit("draft")} className="admin-btn-secondary">{busy === "draft" ? "Saving…" : draftId ? "Update Draft" : "Save Draft"}</button><button type="button" disabled={disabled} onClick={() => submit("test")} className="admin-btn-secondary">{busy === "test" ? "Sending test…" : "Send Test"}</button><button type="button" disabled={disabled || recipientCount === 0} onClick={() => openSchedule()} className="admin-btn-secondary">Schedule Email</button><button type="button" disabled={disabled || recipientCount === 0} onClick={() => submit("send")} className="admin-btn-primary">{busy === "send" ? "Sending…" : "Send Now"}</button></div>
      </section>
      {!canSend && <p className="text-xs text-amber-200/65">Owner or administrator access is required to test, schedule, or send campaigns.</p>}
    </div>
    <aside className="space-y-6 xl:self-start">
      <section className="relative rounded-2xl border border-white/[0.08] bg-[#111] p-5">
        <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.16em] text-white/30">Live preview</p><button type="button" onClick={() => setPersonalizedPreview((value) => !value)} className="text-xs text-[#e7ddc8]/60">{personalizedPreview ? "Personalized" : "Template"}</button></div>
        {personalizedPreview && <p className="mt-2 text-xs text-white/25">Previewing as {previewProfile.fullName}; final content varies by recipient.</p>}
        <EmailTemplatePreview templateKey={templateKey} subject={preview.subject} previewText={preview.previewText} body={preview.body} imageUrl={imageUrl} imageAlt={imageAlt} imageCaption={imageCaption} imageLink={imageLink} />
      </section>
      <section className="relative z-10 rounded-2xl border border-white/[0.08] bg-[#111] p-5"><p className="text-[0.64rem] uppercase tracking-[0.16em] text-[var(--helios-orange)]">Campaign history</p><p className="mt-1 text-[0.64rem] leading-5 text-white/25">Resume drafts or inspect delivered email snapshots.</p><div className="mt-3 divide-y divide-white/[0.06]">{history.map((campaign) => <article key={campaign.id} className="py-3 first:pt-0"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-[0.74rem] leading-[1.15rem] text-white/65">{campaign.subject}</p><span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-white/30">{campaign.status}</span></div><p className="mt-1 text-[0.62rem] leading-[1.05rem] text-white/25">{campaignHistorySummary(campaign)} · {new Date(campaign.createdAt).toLocaleDateString()}</p>{campaign.status === "DRAFT" ? <div className="relative z-20 mt-2 flex flex-wrap items-center gap-1"><button type="button" disabled={busy !== null} onClick={() => resumeDraft(campaign)} className="rounded-md px-2 py-1.5 text-[0.56rem] font-medium text-[#e7ddc8]/75 transition hover:bg-white/[0.07] hover:text-[#e7ddc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:opacity-40">Resume Draft</button><button type="button" disabled={busy !== null} onClick={() => deleteDraft(campaign)} className="rounded-md px-2 py-1.5 text-[0.56rem] text-red-200/55 transition hover:bg-red-400/[0.08] hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40">{busy === `delete:${campaign.id}` ? "Deleting…" : "Delete Draft"}</button></div> : <button type="button" ref={campaign.id === viewingCampaign?.id ? historyTriggerRef : undefined} aria-label={`View campaign: ${campaign.subject}`} onClick={(event)=>{historyTriggerRef.current=event.currentTarget;setViewingCampaign(campaign);}} className="mt-2 rounded-md px-2 py-1.5 text-[0.56rem] text-[#e7ddc8]/65 transition hover:bg-white/[0.07] hover:text-[#e7ddc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]">View</button>}{campaign.status === "SCHEDULED" && <div className="relative z-20 mt-2 flex flex-wrap gap-1"><button type="button" disabled={busy !== null} onClick={() => openSchedule(campaign)} className="rounded-md px-2 py-1.5 text-[0.56rem] text-[#e7ddc8]/65 transition hover:bg-white/[0.07] hover:text-[#e7ddc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:opacity-40">Reschedule</button><button type="button" disabled={busy !== null} onClick={() => manageCampaign(campaign, "send-now")} className="rounded-md px-2 py-1.5 text-[0.56rem] text-[#e7ddc8]/65 transition hover:bg-white/[0.07] hover:text-[#e7ddc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:opacity-40">Send Now</button><button type="button" disabled={busy !== null} onClick={() => manageCampaign(campaign, "edit")} className="rounded-md px-2 py-1.5 text-[0.56rem] text-white/40 transition hover:bg-white/[0.07] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] disabled:opacity-40">Edit</button><button type="button" disabled={busy !== null} onClick={() => manageCampaign(campaign, "cancel")} className="rounded-md px-2 py-1.5 text-[0.56rem] text-red-200/55 transition hover:bg-red-400/[0.08] hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40">Cancel</button></div>}</article>)}{!history.length && <p className="py-6 text-[0.72rem] text-white/30">No campaigns yet.</p>}</div></section>
    </aside>
    {imagePickerOpen && <div role="dialog" aria-modal="true" aria-labelledby="media-picker-title" className="fixed inset-0 z-[110] overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:p-8"><div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#111] p-5 shadow-2xl sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Email image</p><h2 id="media-picker-title" className="mt-2 text-2xl font-light text-white">Choose from Media Library</h2><p className="mt-2 text-xs leading-5 text-white/35">Select one approved image. You can add its accessibility description after choosing it.</p></div><button type="button" onClick={() => setImagePickerOpen(false)} className="admin-btn-secondary">Close</button></div><form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void loadMediaImages(mediaSearch); }}><label className="sr-only" htmlFor="media-image-search">Search media</label><input id="media-image-search" type="search" value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} placeholder="Search media…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-white/25"/><button type="submit" disabled={mediaLoading} className="admin-btn-secondary">{mediaLoading ? "Searching…" : "Search"}</button></form>{mediaLoading ? <p className="py-12 text-center text-sm text-white/35">Loading images…</p> : mediaItems.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{mediaItems.map((item) => <button key={item.id} type="button" onClick={() => { setImageUrl(item.url); setImageAlt(item.altText?.trim() || item.label); setImagePickerOpen(false); }} className="group overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 text-left transition hover:border-[var(--helios-orange)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]"><Image unoptimized src={item.thumbnailUrl || item.url} alt="" width={600} height={400} className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"/><span className="block truncate px-3 py-2 text-[0.68rem] text-white/55 group-hover:text-white/80">{item.label}</span></button>)}</div> : <p className="py-12 text-center text-sm text-white/35">No matching images found.</p>}</div></div>}
    {scheduleOpen && <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl"><h2 id="schedule-title" className="text-2xl font-light text-white">{reschedulingCampaign ? "Reschedule Email" : "Schedule Email"}</h2><p className="mt-2 text-sm text-white/35">{reschedulingCampaign?.recipientCount ?? recipientCount} recipients · {reschedulingCampaign?.subject || subject || "Untitled campaign"}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/35">Send date and time<input type="datetime-local" value={scheduleLocal} min={minimumScheduleLocal} onChange={(event) => setScheduleLocal(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white" /></label><label className="text-xs text-white/35">Timezone<select value={scheduleTimeZone} onChange={(event) => setScheduleTimeZone(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white"><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="America/Chicago">Central Time</option><option value="America/New_York">Eastern Time</option></select></label></div><p className="mt-4 text-xs leading-5 text-white/30">Delivery time is saved in UTC while preserving the selected timezone. Recipient membership and personalization values are frozen when scheduled; compliance is checked again before delivery.</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setScheduleOpen(false); setReschedulingCampaign(null); }} className="admin-btn-secondary">Cancel</button><button type="button" disabled={!scheduleLocal || busy !== null} onClick={() => submit("schedule")} className="admin-btn-primary">{busy === "schedule" ? "Scheduling…" : reschedulingCampaign ? "Confirm Reschedule" : "Confirm Schedule"}</button></div></div></div>}
    {viewingCampaign && <div role="dialog" aria-modal="true" aria-labelledby="sent-email-title" className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:p-8"><div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#111] p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Immutable sent snapshot</p><h2 id="sent-email-title" className="mt-3 text-2xl font-light text-white">{viewingCampaign.subject}</h2>{viewingCampaign.previewText && <p className="mt-2 text-sm text-white/35">{viewingCampaign.previewText}</p>}</div><button autoFocus type="button" aria-label="Close sent email" onClick={()=>{setViewingCampaign(null);window.setTimeout(()=>historyTriggerRef.current?.focus(),0);}} className="admin-btn-secondary">Close</button></div><dl className="mt-6 grid gap-4 text-xs text-white/40 sm:grid-cols-2"><div><dt className="uppercase tracking-[.12em] text-white/25">Sender</dt><dd className="mt-1">{viewingCampaign.createdBy.displayName}</dd></div><div><dt className="uppercase tracking-[.12em] text-white/25">Audience</dt><dd className="mt-1">{viewingCampaign.recipientMode.replaceAll("_"," ")} · {viewingCampaign.recipientCount} eligible recipients</dd></div><div><dt className="uppercase tracking-[.12em] text-white/25">Sent</dt><dd className="mt-1">{viewingCampaign.sentAt ? new Date(viewingCampaign.sentAt).toLocaleString("en-US", { timeZone: "America/Denver", timeZoneName: "short" }) : "Not recorded"}</dd></div><div><dt className="uppercase tracking-[.12em] text-white/25">Provider-confirmed delivery</dt><dd className="mt-1">{viewingCampaign.delivery.delivered} delivered · {viewingCampaign.delivery.accepted} provider accepted · {viewingCampaign.delivery.failed} failed{viewingCampaign.delivery.awaitingConfirmation ? ` · ${viewingCampaign.delivery.awaitingConfirmation} awaiting confirmation` : ""}</dd></div></dl><SentCampaignSnapshot body={viewingCampaign.body} templateKey={viewingCampaign.templateKey} imageUrl={viewingCampaign.imageUrl} imageAlt={viewingCampaign.imageAlt} imageCaption={viewingCampaign.imageCaption} imageLink={viewingCampaign.imageLink} /><p className="mt-4 text-xs leading-5 text-white/25">This read-only view is rendered from the immutable payload recorded at send time. Historical content is not regenerated.</p></div></div>}
  </div>;
}

function EmailTemplatePreview({ templateKey, subject, previewText, body, imageUrl, imageAlt, imageCaption, imageLink }: { templateKey: EmailTemplateKey; subject: string; previewText?: string | null; body: string; imageUrl?: string; imageAlt?: string; imageCaption?: string; imageLink?: string }) {
  const light = templateKey === "EDITORIAL_LIGHT" || templateKey === "PERSONAL_LETTER";
  const theme = light ? { outer: "#e8e2d7", card: "#f7f3eb", text: "#4f4942", heading: "#211f1c", border: "#d8d0c3" } : { outer: "#0b0b0b", card: "#121211", text: "#d7d1c8", heading: "#f5f1e8", border: templateKey === "OFFER_SPOTLIGHT" ? "#d96b2b" : "#2c2a27" };
  const name = EMAIL_TEMPLATES.find((template) => template.key === templateKey)?.name ?? "Helios Signature";
  const html = renderFormattedEmailBody(body || "Your message preview will appear here.", { textColor: theme.text, mutedColor: theme.text, headingColor: theme.heading });
  const previewImage = imageUrl ? <Image unoptimized src={imageUrl} alt={imageAlt || ""} width={1200} height={675} className="h-auto w-full" /> : null;
  return <div className="mt-5 p-5" style={{ background: theme.outer }}><p className="text-[10px] uppercase tracking-[0.18em] text-[var(--helios-orange)]">{name}</p><h3 className="mt-5 font-serif text-xl font-light" style={{ color: theme.heading }}>{subject || "Your email subject"}</h3>{previewText && <p className="mt-2 text-xs opacity-50" style={{ color: theme.text }}>{previewText}</p>}<div className={`mt-5 p-5 ${templateKey === "OFFER_SPOTLIGHT" ? "border-t-4 border-t-[var(--helios-orange)]" : ""}`} style={{ background: theme.card, borderColor: theme.border }}>{previewImage && (imageLink ? <a href={imageLink} target="_blank" rel="noreferrer">{previewImage}</a> : previewImage)}{imageCaption && <p className="mt-2 text-[0.65rem] leading-4 opacity-60" style={{ color: theme.text }}>{imageCaption}</p>}<div className={imageUrl ? "mt-4" : ""} dangerouslySetInnerHTML={{ __html: html }} /></div></div>;
}
