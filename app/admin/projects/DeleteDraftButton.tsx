"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Confirmation = { title: string; updatedAt: string; mediaCount: number };
export default function DeleteDraftButton({ projectId, onDeleted }: { projectId: string; onDeleted: () => void }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [typedTitle, setTypedTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (confirmation) dialog.current?.showModal(); }, [confirmation]);
  function cancel() { dialog.current?.close(); setConfirmation(null); setTypedTitle(""); setError(null); trigger.current?.focus(); }
  async function prepare() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/draft`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to check this draft.");
      setTypedTitle(""); setConfirmation(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to check this draft."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirmation || typedTitle !== confirmation.title || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/draft`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: typedTitle, updatedAt: confirmation.updatedAt }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to delete this draft.");
      cancel(); onDeleted(); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete this draft."); }
    finally { setBusy(false); }
  }
  return <div className="text-right">
    <button ref={trigger} type="button" onClick={() => void prepare()} disabled={busy} className="admin-btn-link-destructive min-h-11" style={{ fontSize: "0.625rem" }}>{busy && !confirmation ? "Checking…" : "Delete Draft"}</button>
    {!confirmation && error ? <p role="alert" className="max-w-xs text-xs text-red-200">{error}</p> : null}
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) cancel(); }} aria-labelledby={`delete-draft-${projectId}`} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-white/15 bg-[#151515] p-6 text-left text-white backdrop:bg-black/80">
      <h2 id={`delete-draft-${projectId}`} className="text-xl">Delete draft?</h2>
      <p className="mt-3 text-sm leading-6 text-white/70">Permanently delete “{confirmation?.title}” and its project details, media records, credits, and preview links. This cannot be undone. Original Cloudflare files are not deleted.</p>
      <p className="mt-2 text-xs text-white/50">{confirmation?.mediaCount ?? 0} media records will be removed from this project. Published projects cannot be deleted here.</p>
      <label className="mt-5 block text-sm">Type the exact project title to confirm<input autoFocus value={typedTitle} onChange={(event) => setTypedTitle(event.target.value)} disabled={busy} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 bg-black/30 px-3" /></label>
      {error ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={cancel} className="admin-btn-secondary">Cancel</button><button type="button" disabled={busy || !confirmation || typedTitle !== confirmation.title} onClick={() => void remove()} className="admin-btn-destructive">{busy ? "Deleting…" : "Permanently Delete Draft"}</button></div>
    </dialog>
  </div>;
}
