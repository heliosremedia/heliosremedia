"use client";

import { useState } from "react";
import AccessibleDialog from "./AccessibleDialog";

export default function ScheduleChangeDialog({ currentDate, busy, onClose, onConfirm }: {
  currentDate?: string | null; busy: boolean; onClose: () => void;
  onConfirm: (intendedSendAt: string) => Promise<boolean>;
}) {
  const [date, setDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || needsReload || !confirmed) return;
    const chosen = new Date(`${date}:00Z`);
    if (!date || !Number.isFinite(chosen.getTime()) || chosen.getTime() <= Date.now()) {
      setError("Choose a future date and time in UTC."); return;
    }
    setError("");
    if (await onConfirm(chosen.toISOString())) onClose();
    else { setNeedsReload(true); setError("The result could not be confirmed. Close this dialog and reload the edition before changing its date again."); }
  }
  return <AccessibleDialog open onClose={() => { if (!busy) onClose(); }} labelledBy="schedule-change-title" size="max-w-lg">
    <form onSubmit={event => void submit(event)} className="space-y-5 p-6">
      <h2 id="schedule-change-title" className="text-2xl font-light text-white">Change send date</h2>
      <p className="text-sm text-white/70">Current date: {currentDate ? new Date(currentDate).toUTCString() : "Not set"}.</p>
      <p className="text-sm text-white/70">Changing the date revokes the existing approval and returns this edition to review. No email is sent. You must approve the edition again before it can be scheduled.</p>
      <label className="block text-sm text-white/80">New send date and time (UTC)
        <input required type="datetime-local" value={date} disabled={busy} onChange={event => { setDate(event.target.value); setConfirmed(false); }} className="mt-2 w-full rounded-lg border border-white/20 bg-black p-3 text-white" />
      </label>
      <p className="text-xs text-white/60">Enter UTC, not your device’s local time. Review the date carefully before confirming.</p>
      <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I reviewed the new date and understand that approval is required again.</label>
      {error && <p role="alert" className="text-sm text-amber-100">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={onClose} disabled={busy} className="admin-btn-secondary">Cancel</button><button type="submit" disabled={busy || needsReload || !confirmed || !date} className="admin-btn-primary">{busy ? "Changing date…" : "Change date and require review"}</button></div>
    </form>
  </AccessibleDialog>;
}
