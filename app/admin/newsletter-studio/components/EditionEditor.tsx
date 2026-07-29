"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApprovalDialog from "./ApprovalDialog";
import NewsletterPreview from "./NewsletterPreview";
import PreviewDialog from "./PreviewDialog";
import StatusBadge from "./StatusBadge";
import TestSendDialog from "./TestSendDialog";
import ImageSourcePanel from "./ImageSourcePanel";
import type { BlockType, NewsletterBlock, NewsletterEdition } from "../types";

const blockLabels: Record<BlockType, string> = { HERO: "Hero", OPENING_NOTE: "Opening Note", FEATURED_STORY: "Featured Story", PORTFOLIO_SPOTLIGHT: "Portfolio Spotlight", HELPFUL_TIP: "Helpful Tip", SERVICE_SPOTLIGHT: "Service Spotlight", EVENT_ANNOUNCEMENT: "Event or Announcement", IMAGE: "Image", CALL_TO_ACTION: "Button or Call to Action", DIVIDER: "Divider", SPACER: "Spacer", CLOSING_NOTE: "Closing Note" };
const input = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]";
const placeholder: NewsletterEdition = { id: "", seriesId: "", seriesName: "", subject: "", previewText: "", status: "AWAITING_GENERATION", groupNames: [], eligibleCount: 0, excludedCount: 0, warnings: [], publishableNotes: "", internalNotes: "", blocks: [] };

export default function EditionEditor({ editionId }: { editionId: string }) {
  const router = useRouter();
  const [edition, setEdition] = useState(placeholder); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop"); const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState<string | null>("load"); const [message, setMessage] = useState<string | null>(null); const [approvalOpen, setApprovalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false); const [testOpen, setTestOpen] = useState(false); const [defaultTestRecipient, setDefaultTestRecipient] = useState("");
  const [testError, setTestError] = useState("");
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const originalActionsRef = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [slowAi, setSlowAi] = useState(false);
  useEffect(() => { void (async () => { try { const response = await fetch(`/api/admin/newsletters/editions/${editionId}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Edition could not be loaded."); setEdition(result.edition); setDefaultTestRecipient(result.defaultTestRecipient || ""); setSelectedId(result.edition.blocks[0]?.id || null); } catch (error) { setMessage(error instanceof Error ? error.message : "Edition could not be loaded."); } finally { setBusy(null); } })(); }, [editionId]);
  const selected = useMemo(() => edition.blocks.find(block => block.id === selectedId) || null, [edition.blocks, selectedId]);
  const aiStatus = busy === "regenerate" ? "AI is preparing the newsletter draft…" : busy === "regenerate-block" ? "AI is regenerating this block…" : busy === "shorten-block" ? "AI is shortening this block…" : busy === "expand-block" ? "AI is expanding this block…" : busy === "rewrite-block" ? "AI is adjusting the tone…" : null;
  useEffect(() => {
    if (!aiStatus) return;
    const timer = window.setTimeout(() => setSlowAi(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [aiStatus]);
  useEffect(() => {
    const target = originalActionsRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setShowFloatingActions(!entry.isIntersecting), { threshold: 0.15 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [busy]);
  useEffect(() => {
    if (!selectedId) return;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.querySelector(`[data-newsletter-list-block="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
    document.querySelector(`[data-newsletter-editor-block="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest", behavior });
    const preview = document.querySelector(`[data-newsletter-preview-block="${CSS.escape(selectedId)}"]`);
    preview?.scrollIntoView({ block: "center", behavior });
    preview?.classList.remove("newsletter-preview-highlight");
    requestAnimationFrame(() => preview?.classList.add("newsletter-preview-highlight"));
  }, [selectedId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function saveAndClose() {
    if (await perform("save")) router.push("/admin/newsletter-studio");
  }
  function patchEdition(values: Partial<NewsletterEdition>) { setDirty(true); setEdition(current => ({ ...current, ...values })); }
  function patchBlock(values: Partial<NewsletterBlock>) { setDirty(true); setEdition(current => ({ ...current, blocks: current.blocks.map(block => block.id === selectedId ? { ...block, ...values, manuallyEdited: true } : block) })); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= edition.blocks.length) return; const blocks = [...edition.blocks]; [blocks[index], blocks[target]] = [blocks[target], blocks[index]]; patchEdition({ blocks }); }
  function add(type: BlockType) { const block: NewsletterBlock = { id: `local-${crypto.randomUUID()}`, type, label: blockLabels[type], heading: "", body: "", alignment: "left", provenance: [], aiGenerated: false, manuallyEdited: true }; patchEdition({ blocks: [...edition.blocks, block] }); setSelectedId(block.id); }
  async function perform(action: string, extra: Record<string, unknown> = {}) { if (busy) return false; setSlowAi(false); setBusy(action); setMessage(null); try { const response = await fetch(`/api/admin/newsletters/editions/${editionId}`, { method: action === "save" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "save" ? { action, edition } : { action, ...extra }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "The request could not be completed."); if (result.edition) { setEdition(result.edition); if (selectedId && !result.edition.blocks.some((block: NewsletterBlock) => block.id === selectedId)) setSelectedId(result.edition.blocks[0]?.id || null); } if (action === "save") setDirty(false); setMessage(result.message || "Updated."); if (action === "approve") setApprovalOpen(false); return true; } catch (error) { setMessage(error instanceof Error ? error.message : "The request could not be completed."); return false; } finally { setBusy(null); } }
  async function prepareApproval() {
    if (dirty && !(await perform("save"))) return;
    setApprovalOpen(true);
  }
  async function sendTest(recipient: string) {
    setBusy("test"); setMessage(null); setTestError("");
    try {
      const response = await fetch(`/api/admin/newsletters/editions/${editionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", recipient, edition }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The test newsletter could not be sent.");
      if (result.edition) setEdition(result.edition);
      setDirty(false);
      setMessage(result.message);
      setTestOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The test newsletter could not be sent.";
      setTestError(detail);
      setMessage(detail);
    } finally {
      setBusy(null);
    }
  }
  async function sendNow() {
    if (dirty && !(await perform("save"))) return;
    const confirmed = confirm(
      `Send this approved newsletter now?\n\nSubject: ${edition.subject}\nSender: ${edition.senderName || "Helios Real Estate Media"}\nReply-to: ${edition.replyTo || "Not configured"}\nEligible recipients: ${edition.eligibleCount}\nSuppressed or excluded: ${edition.excludedCount}\nEstimated delivery volume: ${edition.eligibleCount}\n\nThis replaces the existing schedule. Cancel keeps the current schedule.`
    );
    if (confirmed) await perform("send-now", { confirmation: "REPLACE_SCHEDULE_AND_SEND_NOW" });
  }
  if (busy === "load") return <div className="h-80 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.02]" />;
  return <div className="space-y-6">
    <section ref={originalActionsRef} className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 xl:flex-row xl:items-end xl:justify-between"><div className="min-w-0 flex-1"><Link href="/admin/newsletter-studio" onClick={event=>{if(dirty&&!confirm("Leave this edition with unsaved changes?"))event.preventDefault();}} className="admin-btn-link">← Back to Newsletter Studio</Link><div className="mt-3 flex flex-wrap items-center gap-3"><p className="eyebrow text-[var(--helios-orange)]">Newsletter Studio</p><StatusBadge status={edition.status} /></div><h1 className="mt-3 max-w-4xl break-words text-3xl font-light leading-tight text-white sm:text-4xl">{edition.subject || "Untitled edition"}</h1><p className="mt-2 text-sm text-white/35">{edition.seriesName}</p></div><div className="flex flex-wrap gap-2 xl:justify-end"><button onClick={() => perform("save")} disabled={Boolean(busy)} className="admin-btn-secondary">Save Draft</button><button onClick={()=>void saveAndClose()} disabled={Boolean(busy)} className="admin-btn-secondary">Save &amp; Close</button><button onClick={() => setPreviewOpen(true)} className="admin-btn-secondary">Preview</button><button onClick={() => void prepareApproval()} disabled={Boolean(busy) || edition.status !== "NEEDS_REVIEW"} className="admin-btn-primary">Approve &amp; schedule</button></div></section>
    {aiStatus && <p role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.04] px-4 py-3 text-sm text-white/65"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-[var(--helios-orange)]" aria-hidden="true" /><span>{aiStatus}{slowAi && <span className="mt-1 block text-xs text-white/38">Still writing—this may take a moment.</span>}</span></p>}
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">{message}</p>}
    <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-1 lg:hidden"><button onClick={() => setTab("edit")} className={`flex-1 rounded-md py-2 text-xs ${tab === "edit" ? "bg-white/10 text-white" : "text-white/35"}`}>Editor</button><button onClick={() => setTab("preview")} className={`flex-1 rounded-md py-2 text-xs ${tab === "preview" ? "bg-white/10 text-white" : "text-white/35"}`}>Preview</button></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.72fr)]">
      <main className={`${tab === "preview" ? "hidden lg:block" : "block"} space-y-5`}>
        <section className="rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.035] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.56rem] font-semibold uppercase tracking-[.16em] text-[var(--helios-orange)]">Content Notes</p><h2 className="mt-2 text-2xl font-light text-white">Direction for this edition</h2></div><button disabled={Boolean(busy)} onClick={() => perform("regenerate")} className="admin-btn-secondary">Regenerate entire draft</button></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-xs text-white/40">Publishable information<textarea rows={5} className={input} value={edition.publishableNotes} onChange={e => patchEdition({ publishableNotes: e.target.value })} placeholder="Events, promotions, priorities, approved links…" /></label><label className="text-xs text-white/40">Internal instructions — never published<textarea rows={5} className={input} value={edition.internalNotes} onChange={e => patchEdition({ internalNotes: e.target.value })} placeholder="Items to exclude, private context, editorial guidance…" /></label></div></section>
        <section className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">Subject <span className="text-white/20">({edition.subject.length}/60 recommended)</span><input maxLength={160} className={input} value={edition.subject} onChange={e => patchEdition({ subject: e.target.value })} /></label><label className="text-xs text-white/40">Preview text <span className="text-white/20">({edition.previewText.length}/100 recommended)</span><input maxLength={180} className={input} value={edition.previewText} onChange={e => patchEdition({ previewText: e.target.value })} /></label></div></section>
        <section className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)]"><aside className="xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1"><p className="mb-3 text-[0.56rem] font-semibold uppercase tracking-[.16em] text-white/30">Content blocks</p><div className="space-y-2">{edition.blocks.map((block, index) => <div key={block.id} data-newsletter-list-block={block.id} className={`rounded-xl border p-3 ${selectedId === block.id ? "border-[var(--helios-orange)]/70 bg-[var(--helios-orange)]/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}><button onClick={() => setSelectedId(block.id)} aria-pressed={selectedId === block.id} className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"><span className="block text-sm text-white/65">{block.label}</span><span className="mt-1 block text-[0.5rem] uppercase tracking-[.12em] text-white/25">{blockLabels[block.type]}</span></button><div className="mt-2 flex gap-1"><button aria-label={`Move ${block.label} up`} disabled={index === 0} onClick={() => move(index, -1)} className="admin-btn-link">↑</button><button aria-label={`Move ${block.label} down`} disabled={index === edition.blocks.length - 1} onClick={() => move(index, 1)} className="admin-btn-link">↓</button><button aria-label={`Remove ${block.label}`} onClick={() => { patchEdition({ blocks: edition.blocks.filter(item => item.id !== block.id) }); setSelectedId(null); }} className="admin-btn-link-destructive">Remove</button></div></div>)}</div><details className="mt-3 rounded-xl border border-white/[0.08] p-3"><summary className="cursor-pointer text-xs text-white/50">Add block</summary><div className="mt-2 space-y-1">{(Object.keys(blockLabels) as BlockType[]).map(type => <button key={type} onClick={() => add(type)} className="block w-full rounded-md px-2 py-2 text-left text-xs text-white/45 hover:bg-white/[0.05] hover:text-white">{blockLabels[type]}</button>)}</div></details></aside>
        <div data-newsletter-editor-block={selectedId || undefined} className="min-w-0 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1">{selected ? <BlockForm block={selected} onPatch={patchBlock} onAction={(action, instruction) => perform(action, { blockId: selected.id, instruction })} busy={Boolean(busy)} /> : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/30">Select a content block to edit it.</div>}</div></section>
        <section className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#111] p-5"><button disabled={Boolean(busy)} onClick={() => { setTestError(""); setTestOpen(true); }} className="admin-btn-secondary">Send test</button>{edition.status === "SCHEDULED" ? <button disabled={Boolean(busy)} onClick={() => void sendNow()} className="admin-btn-primary">{busy === "send-now" ? "Sending…" : "Send Now"}</button> : null}{edition.status === "APPROVED" || edition.status === "SCHEDULED" ? <button disabled={Boolean(busy)} onClick={() => perform("revoke-approval")} className="admin-btn-destructive">Revoke approval</button> : null}<button disabled={Boolean(busy)} onClick={() => perform("duplicate")} className="admin-btn-secondary">Duplicate edition</button>{edition.status === "SCHEDULED" && <button disabled={Boolean(busy)} onClick={() => confirm("Cancel this scheduled edition? It will not be sent.") && perform("cancel")} className="admin-btn-destructive">Cancel scheduled edition</button>}</section>
      </main>
      <aside className={`${tab === "edit" ? "hidden lg:block" : "block"} min-w-0`}><div className="sticky top-24 space-y-4"><div className="flex items-center justify-between"><p className="text-[0.56rem] font-semibold uppercase tracking-[.16em] text-white/30">Email preview</p><div className="flex rounded-lg border border-white/10 p-1"><button onClick={() => setPreviewMode("desktop")} className={`rounded px-3 py-1.5 text-xs ${previewMode === "desktop" ? "bg-white/10 text-white" : "text-white/30"}`}>Desktop</button><button onClick={() => setPreviewMode("mobile")} className={`rounded px-3 py-1.5 text-xs ${previewMode === "mobile" ? "bg-white/10 text-white" : "text-white/30"}`}>Mobile</button></div></div><div ref={previewScrollRef} className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#090909] p-3 sm:p-5"><NewsletterPreview edition={edition} mode={previewMode} selectedId={selectedId} /></div></div></aside>
    </div>
    {showFloatingActions && <div className="sticky bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-[#151515]/95 p-3 shadow-2xl backdrop-blur"><span className={`mr-auto px-2 text-xs ${dirty ? "text-amber-200/70" : "text-white/30"}`}>{dirty ? "Unsaved changes" : "Edition saved"}</span><button disabled={Boolean(busy)} onClick={() => perform("save")} className="admin-btn-secondary">{busy === "save" ? "Saving…" : "Save Draft"}</button><button onClick={() => setPreviewOpen(true)} className="admin-btn-secondary">Preview</button><button disabled={Boolean(busy)} onClick={() => { setTestError(""); setTestOpen(true); }} className="admin-btn-secondary">Send Test</button><button onClick={() => void prepareApproval()} disabled={Boolean(busy) || edition.status !== "NEEDS_REVIEW"} title={edition.status !== "NEEDS_REVIEW" ? "This edition must be in review before it can be scheduled." : undefined} className="admin-btn-primary">Approve &amp; Schedule</button></div>}
    <ApprovalDialog edition={edition} open={approvalOpen} busy={busy === "approve"} onClose={() => setApprovalOpen(false)} onConfirm={() => perform("approve", { contentVersion: edition })} />
    <PreviewDialog edition={edition} mode={previewMode} open={previewOpen} onModeChange={setPreviewMode} onClose={() => setPreviewOpen(false)} />
    {testOpen && <TestSendDialog open defaultRecipient={defaultTestRecipient} subject={edition.subject} busy={busy === "test"} failure={testError} onClose={() => setTestOpen(false)} onSend={sendTest} />}
  </div>;
}

function BlockForm({ block, onPatch, onAction, busy }: { block: NewsletterBlock; onPatch: (values: Partial<NewsletterBlock>) => void; onAction: (action: string, instruction?: string) => void; busy: boolean }) {
  const [instruction, setInstruction] = useState("");
  return <section className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[0.54rem] uppercase tracking-[.14em] text-white/25">{blockLabels[block.type]}</p><h3 className="mt-2 text-2xl font-light text-white">{block.label}</h3></div><span className="text-[0.5rem] uppercase tracking-[.12em] text-white/25">{block.aiGenerated ? "AI generated" : "Manual"}{block.manuallyEdited ? " · Edited" : ""}</span></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">Internal label<input className={input} value={block.label} onChange={e => onPatch({ label: e.target.value })} /></label><label className="text-xs text-white/40">Eyebrow<input className={input} value={block.eyebrow || ""} onChange={e => onPatch({ eyebrow: e.target.value })} /></label></div><label className="block text-xs text-white/40">Heading<input className={input} value={block.heading || ""} onChange={e => onPatch({ heading: e.target.value })} /></label><label className="block text-xs text-white/40">Body copy<textarea rows={8} className={input} value={block.body || ""} onChange={e => onPatch({ body: e.target.value })} /></label>
    {!["DIVIDER", "SPACER", "CLOSING_NOTE"].includes(block.type) && <ImageSourcePanel block={block} onPatch={onPatch} />}
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-white/40">CTA link<input type="url" className={input} value={block.link || ""} onChange={e => onPatch({ link: e.target.value })} /></label><label className="text-xs text-white/40">Button label<input className={input} value={block.buttonLabel || ""} onChange={e => onPatch({ buttonLabel: e.target.value })} /></label></div>
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="text-[0.54rem] font-semibold uppercase tracking-[.14em] text-white/30">Verified sources</p>{block.provenance?.length ? <ul className="mt-3 space-y-2 text-sm text-white/50">{block.provenance.map(source => <li key={source}>• {source}</li>)}</ul> : <p className="mt-3 text-sm text-amber-100/55">No source provenance is attached. Add verified input before approval.</p>}</div>
    <label className="block text-xs text-white/40">AI adjustment instruction<input className={input} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Example: Warmer, while preserving every verified fact." /></label><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => onAction("regenerate-block", instruction)} className="admin-btn-secondary">Regenerate block</button><button disabled={busy} onClick={() => onAction("shorten-block")} className="admin-btn-secondary">Shorten</button><button disabled={busy} onClick={() => onAction("expand-block")} className="admin-btn-secondary">Expand</button><button disabled={busy || !instruction.trim()} onClick={() => onAction("rewrite-block", instruction)} className="admin-btn-secondary">Adjust tone</button></div>
  </section>;
}
