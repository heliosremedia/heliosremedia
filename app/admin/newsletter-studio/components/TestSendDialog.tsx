"use client";

import { useCallback, useId, useRef, useState } from "react";
import AccessibleDialog from "./AccessibleDialog";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function TestSendDialog({
  open,
  defaultRecipient,
  subject,
  busy,
  failure,
  onClose,
  onSend,
}: {
  open: boolean;
  defaultRecipient: string;
  subject: string;
  busy: boolean;
  failure: string;
  onClose: () => void;
  onSend: (recipient: string) => Promise<void>;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = recipient.trim().toLowerCase();
    if (!validEmail.test(normalized) || normalized.length > 320) {
      setError("Enter one valid email address.");
      inputRef.current?.focus();
      return;
    }
    setError("");
    await onSend(normalized);
  }

  return (
    <AccessibleDialog open={open} onClose={close} labelledBy={titleId} size="max-w-xl" initialFocus={inputRef}>
      <form onSubmit={submit} className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.54rem] font-semibold uppercase tracking-[.16em] text-[var(--helios-orange)]">Newsletter Studio</p>
            <h2 id={titleId} className="mt-2 text-2xl font-light text-white">Send a test newsletter</h2>
          </div>
          <button type="button" disabled={busy} onClick={close} aria-label="Close test-send dialog" className="admin-btn-icon-sm">×</button>
        </div>
        <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/20 p-4">
          <p className="text-[0.52rem] uppercase tracking-[.14em] text-white/30">Subject</p>
          <p className="mt-2 text-sm text-white/65">[TEST] {subject || "Untitled edition"}</p>
        </div>
        <label className="mt-6 block text-xs text-white/45">
          Send test to
          <input
            ref={inputRef}
            type="email"
            required
            autoComplete="email"
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              setError("");
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${titleId}-error` : `${titleId}-help`}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]"
          />
        </label>
        {error
          ? <p id={`${titleId}-error`} role="alert" className="mt-2 text-sm text-red-200/80">{error}</p>
          : <p id={`${titleId}-help`} className="mt-2 text-xs leading-5 text-white/30">Defaults to your administrator account email. You may replace it with one other valid test address.</p>}
        <div className="mt-6 rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-4 text-sm leading-6 text-white/50">
          <p>This is a test only. No client recipients will receive it.</p>
          <p>The exact content currently visible in the editor will be saved and sent.</p>
        </div>
        {failure && <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-sm leading-6 text-red-100/80">{failure}</p>}
        <div className="mt-7 flex justify-end gap-3 border-t border-white/[0.08] pt-6">
          <button type="button" disabled={busy} onClick={close} className="admin-btn-secondary">Cancel</button>
          <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "Sending test…" : "Send test"}</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
