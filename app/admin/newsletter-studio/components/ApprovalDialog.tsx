"use client";
import { useEffect, useRef } from "react";
import type { NewsletterEdition } from "../types";
export default function ApprovalDialog({ edition, open, busy, onClose, onConfirm }: { edition: NewsletterEdition; open: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  if (!open) return null;
  return <div role="presentation" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="approval-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-[#111] p-5 shadow-2xl sm:p-7">
      <p className="eyebrow text-[var(--helios-orange)]">Final confirmation</p><h2 id="approval-title" className="mt-3 text-3xl font-light text-white">Approve &amp; schedule</h2><p className="mt-3 text-sm leading-6 text-white/40">Confirm the exact content, audience, and schedule below. Approval applies only to this saved version.</p>
      <dl className="mt-6 divide-y divide-white/[0.07] rounded-xl border border-white/[0.08]">{[["Subject", edition.subject],["Send time", edition.intendedSendAt ? new Date(edition.intendedSendAt).toLocaleString() : "Not set"],["Recipient groups", edition.groupNames.join(", ") || "None"],["Eligible", `${edition.eligibleCount}`],["Excluded", `${edition.excludedCount}`]].map(([term, value]) => <div key={term} className="grid gap-1 p-4 sm:grid-cols-[8rem_1fr]"><dt className="text-xs uppercase tracking-[.12em] text-white/25">{term}</dt><dd className="text-sm text-white/65">{value}</dd></div>)}</dl>
      {edition.warnings.length > 0 && <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-amber-100">Warnings</p><ul className="mt-2 space-y-1 text-sm text-amber-100/70">{edition.warnings.map(item => <li key={item}>• {item}</li>)}</ul></div>}
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button ref={closeRef} disabled={busy} onClick={onClose} className="admin-btn-secondary">Go back</button><button disabled={busy || !edition.intendedSendAt || edition.eligibleCount < 1} onClick={onConfirm} className="admin-btn-primary">{busy ? "Approving…" : "Confirm approval"}</button></div>
    </div>
  </div>;
}
