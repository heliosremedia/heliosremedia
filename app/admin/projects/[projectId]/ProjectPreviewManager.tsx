"use client";

import { useEffect, useRef, useState } from "react";

type Preview = { id: string; label: string | null; expiresAt: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; url?: string };

function validPreview(value: unknown): value is Preview & { url: string } {
  if (!value || typeof value !== "object") return false;
  const row = value as Preview;
  if (typeof row.id !== "string" || !row.id || typeof row.url !== "string" || !Number.isFinite(Date.parse(row.expiresAt)) || !Number.isFinite(Date.parse(row.createdAt)) || (row.label !== null && typeof row.label !== "string") || row.revokedAt !== null) return false;
  try { const url = new URL(row.url); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

export default function ProjectPreviewManager({ projectId, initialPreviews }: { projectId: string; initialPreviews: Preview[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const [items, setItems] = useState(initialPreviews);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const reviewRef = useRef(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function requireReview(message: string) {
    reviewRef.current = true;
    setReviewRequired(true);
    setError(message);
  }

  async function create() {
    if (busyRef.current || reviewRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    let rejected = false;
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/previews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, days }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        rejected = [400, 409].includes(response.status) && data.success === false;
        throw new Error(data.error || "Unable to create preview.");
      }
      if (!validPreview(data.preview)) throw new Error("The preview receipt could not be confirmed.");
      setItems(current => [data.preview, ...current]);
      setLabel("");
      setNotice("Private review link created. Open it to review this project, or copy it when you choose to share it.");
      // Creation and clipboard access are separate outcomes. A denied clipboard must never invite another POST.
    } catch (caught) {
      if (rejected) setError(caught instanceof Error ? caught.message : "Unable to create preview.");
      else requireReview("The creation result could not be confirmed. Your entries remain here. Reload to review existing links before creating another.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function revoke(id: string) {
    if (busyRef.current || reviewRef.current) return;
    if (!window.confirm("Revoke this private review link? Anyone using this link will lose access.")) return;
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/previews?previewId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error("Unconfirmed revocation");
      setItems(current => current.map(item => item.id === id ? { ...item, revokedAt: new Date().toISOString(), url: undefined } : item));
      setNotice("Private review link revoked.");
    } catch {
      requireReview("The revocation result could not be confirmed. Reload to check the saved link status before another change.");
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function copy(item: Preview) {
    if (!item.url) return;
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(item.id); setNotice("Private review link copied.");
    } catch {
      setCopied(null);
      setNotice("Clipboard access was unavailable. The link is still created; select and copy its address below.");
    }
  }

  return <section aria-labelledby="preview-heading" className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--helios-orange)]">Private review</p>
    <h2 id="preview-heading" className="mt-3 text-2xl text-white">Project preview links</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Review this project without publishing it. Anyone with a link can view the project until the link expires or you revoke it.</p>
    <form className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={event => { event.preventDefault(); void create(); }}>
      <div className="min-w-0 text-sm text-white/75"><label htmlFor="preview-link-label">Link label</label>
        <input id="preview-link-label" value={label} onChange={event => setLabel(event.target.value)} disabled={busy || reviewRequired} placeholder="Owner review (optional)" maxLength={120} className="mt-2 block w-full min-w-0 rounded-xl border border-white/20 bg-black/25 px-4 py-3 text-white" />
      </div>
      <div className="min-w-0 text-sm text-white/75"><label htmlFor="preview-link-expiration">Expires after</label>
        <select id="preview-link-expiration" value={days} onChange={event => setDays(Number(event.target.value))} disabled={busy || reviewRequired} className="mt-2 block w-full rounded-xl border border-white/20 bg-[#111] px-4 py-3 text-white">
          {[1, 3, 7, 14, 30].map(value => <option key={value} value={value}>{value} {value === 1 ? "day" : "days"}</option>)}
        </select>
      </div>
      <button type="submit" disabled={busy || reviewRequired} className="admin-btn-primary sm:self-end">{busy ? "Saving link" : "Create private link"}</button>
    </form>
    {error && <div role="alert" className="mt-5 rounded-xl border border-amber-200/30 p-4 text-sm text-amber-100">
      <p>{error}</p>
      {reviewRequired && <button type="button" className="mt-3 underline" onClick={() => { if (window.confirm("Reload saved links? Note your current label and expiration choice first. Newly created link addresses are only shown in this session.")) window.location.reload(); }}>Reload saved links</button>}
    </div>}
    {notice && <p role="status" className="mt-5 text-sm text-white/80">{notice}</p>}
    <div className="mt-5 space-y-3">{items.map(item => {
      const active = !item.revokedAt && new Date(item.expiresAt).getTime() > now;
      return <article key={item.id} aria-label={item.label || "Untitled preview"} className="min-w-0 rounded-xl border border-white/15 bg-black/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="min-w-0 break-words text-sm text-white/85">{item.label || "Untitled preview"}</h3>
          <span className="text-xs text-white/65">{active ? "Active" : item.revokedAt ? "Revoked" : "Expired"}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/65">Expires {new Date(item.expiresAt).toLocaleString()}{item.lastUsedAt ? ` · Last opened ${new Date(item.lastUsedAt).toLocaleString()}` : " · Not opened yet"}</p>
        {item.url && active && !reviewRequired && <>
          <label className="mt-4 block text-xs text-white/65">Private link address
            <input readOnly value={item.url} onFocus={event => event.target.select()} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-black/25 p-3 text-sm text-white" />
          </label>
          <div className="mt-3 flex flex-wrap gap-4">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open private review</a>
            <button type="button" onClick={() => void copy(item)} className="text-sm underline">{copied === item.id ? "Copied" : "Copy link"}</button>
          </div>
        </>}
        {!item.url && active && <p className="mt-3 text-xs leading-5 text-white/65">The address is only shown when a link is created. Revoke an unused link before creating a replacement.</p>}
        {active && <button type="button" disabled={busy || reviewRequired} onClick={() => void revoke(item.id)} className="mt-4 text-sm text-red-200 underline disabled:opacity-50">Revoke link</button>}
      </article>;
    })}
    {items.length === 0 && <p className="py-8 text-center text-sm text-white/65">No private review links yet. Create one when you are ready to review this draft.</p>}
    </div>
  </section>;
}
