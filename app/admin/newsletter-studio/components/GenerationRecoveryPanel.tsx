"use client";

import { useEffect, useRef, useState } from "react";
import AccessibleDialog from "./AccessibleDialog";
import { requestGenerationRecovery, type GenerationRecoveryReview } from "./generation-recovery-client";

export default function GenerationRecoveryPanel({ editionId }: { editionId: string }) {
  const [review, setReview] = useState<GenerationRecoveryReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function load(recover = false) {
    if (pending.current || (recover && (!open || !confirmed || !review?.eligible || !review.runId))) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setMessage(""); setOpen(false); setConfirmed(false);
    let updated = false;
    try {
      if (recover) {
        await requestGenerationRecovery(editionId, { expectedVersion: review!.rowVersion, runId: review!.runId! }, controller.signal);
        updated = true;
        if (controller.signal.aborted) return;
        setReview(null);
        setMessage("Generation returned to review. Existing content is preserved. Reload the edition when ready to refresh its status; unsaved editor changes have not been replaced.");
      }
      const latest = await requestGenerationRecovery(editionId, undefined, controller.signal);
      if (!controller.signal.aborted) setReview(latest);
    } catch (error) {
      if (!controller.signal.aborted) {
        setReview(null);
        setMessage(updated
          ? "Generation returned to review, but the updated status could not be loaded. Load a fresh review. Your editor changes have not been replaced."
          : error instanceof Error ? error.message : "Load a fresh generation review before trying again.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }

  const close = () => { if (!busy) { setOpen(false); setConfirmed(false); } };
  return <section aria-labelledby="generation-recovery-title" className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="generation-recovery-title" className="text-2xl font-light text-white">Generation recovery</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Check an interrupted generation and return it to review when recovery is available. Recovery preserves existing content and does not generate or send anything.</p></div>
      <button className="admin-btn-secondary" disabled={busy} onClick={() => void load()}>{busy ? "Checking generation…" : review ? "Refresh generation review" : "Load generation review"}</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-white/75">{message}</p>
    {review && <>
      <p className="text-sm text-white/70">Recorded edition state: {review.editionStatus.replaceAll("_", " ").toLowerCase()}.</p>
      {review.eligible ? <>
        <p className="text-sm text-white/70">The recorded background generation has expired and can be returned to review. No retry will be started.</p>
        <button className="admin-btn-secondary" disabled={busy} onClick={() => { setOpen(true); setConfirmed(false); }}>Return generation to review</button>
      </> : <p className="text-sm text-white/60">Recovery is unavailable for the current records. Active work or missing recovery evidence can prevent this action. Refresh the review to check again.</p>}
    </>}
    <AccessibleDialog open={open} onClose={close} labelledBy="generation-confirm-title" size="max-w-lg">
      <div className="space-y-5 p-6"><h3 id="generation-confirm-title" className="text-xl text-white">Return generation to review?</h3>
        <p className="text-sm text-white/70">This ends the expired generation attempt, cancels pending generation work and removes any current approval. Existing content remains available for review.</p>
        <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I want to return this generation to review. No content will be generated or sent.</label>
        <div className="flex flex-wrap gap-3"><button className="admin-btn-secondary" onClick={close}>Cancel</button><button className="admin-btn-primary" disabled={busy || !confirmed} onClick={() => void load(true)}>Confirm recovery</button></div>
      </div>
    </AccessibleDialog>
  </section>;
}
