"use client";

import type { ReactNode } from "react";
import AdminCardHeading from "@/app/admin/components/AdminCardHeading";

export default function ProjectSettingsPanel({
  title,
  summary,
  description,
  dirty,
  busy,
  warning,
  children,
}: {
  title: string;
  summary: string;
  description: string;
  dirty: boolean;
  busy: boolean;
  warning?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-[#111]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <AdminCardHeading inline eyebrow="Portfolio organization" title={title} description={description} />
          <span className="mt-1 block text-xs text-white/55">{summary}</span>
          {warning ? <span className="mt-1 block text-xs text-amber-200">{warning}</span> : null}
        </span>
        {busy || dirty ? (
          <span role="status" className="shrink-0 text-xs text-amber-200">
            {busy ? "Saving…" : "Unsaved changes"}
          </span>
        ) : null}
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl font-light text-white/70"><span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span>
      </summary>
      {/* Native details keeps children mounted, including all unsaved editor state. */}
      <div className="border-t border-white/[0.07] p-5">{children}</div>
    </details>
  );
}
