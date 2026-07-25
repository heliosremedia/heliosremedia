"use client";

import { useCallback, useId } from "react";
import type { NewsletterEdition } from "../types";
import AccessibleDialog from "./AccessibleDialog";
import NewsletterPreview from "./NewsletterPreview";

export default function PreviewDialog({
  edition,
  mode,
  open,
  onModeChange,
  onClose,
}: {
  edition: NewsletterEdition;
  mode: "desktop" | "mobile";
  open: boolean;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);

  return (
    <AccessibleDialog open={open} onClose={close} labelledBy={titleId}>
      <header className="flex flex-col gap-5 border-b border-white/[0.08] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="text-[0.54rem] font-semibold uppercase tracking-[.16em] text-[var(--helios-orange)]">Newsletter preview</p>
          <h2 id={titleId} className="mt-2 truncate text-2xl font-light text-white sm:text-3xl">{edition.subject || "Untitled edition"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/40">{edition.previewText || "No preview text has been added."}</p>
        </div>
        <button type="button" onClick={close} className="admin-btn-secondary self-start">Close</button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-7">
        <p className="text-[0.54rem] uppercase tracking-[.14em] text-white/30">Complete email</p>
        <div className="flex rounded-lg border border-white/10 p-1" aria-label="Preview size">
          <button type="button" aria-pressed={mode === "desktop"} onClick={() => onModeChange("desktop")} className={`rounded px-3 py-1.5 text-xs ${mode === "desktop" ? "bg-white/10 text-white" : "text-white/35"}`}>Desktop</button>
          <button type="button" aria-pressed={mode === "mobile"} onClick={() => onModeChange("mobile")} className={`rounded px-3 py-1.5 text-xs ${mode === "mobile" ? "bg-white/10 text-white" : "text-white/35"}`}>Mobile</button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto bg-[#090909] p-3 sm:p-7">
        <NewsletterPreview edition={edition} mode={mode} />
      </div>
    </AccessibleDialog>
  );
}
