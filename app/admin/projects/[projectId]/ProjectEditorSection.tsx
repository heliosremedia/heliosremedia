"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function ProjectEditorSection({
  id,
  eyebrow,
  title,
  summary,
  status,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  summary: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bodyId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    const frame = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(frame);
  }, [id]);

  return (
    <section
      ref={sectionRef}
      id={id}
      tabIndex={-1}
      onInvalidCapture={(event) => {
        setExpanded(true);
        requestAnimationFrame(() => (event.target as HTMLElement).focus());
      }}
      className="scroll-mt-44 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]/70"
    >
      <div className={`flex items-start gap-4 px-5 py-5 sm:px-6 ${expanded ? "border-b border-white/[0.08]" : ""}`}>
        <div className="min-w-0 flex-1 pr-1">
          {eyebrow ? <p className="text-[0.62rem] font-semibold uppercase tracking-[0.19em] text-[var(--helios-orange)]">{eyebrow}</p> : null}
          <h2 className={`${eyebrow ? "mt-3" : ""} text-2xl font-normal text-white sm:text-3xl`}>{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/35">{summary}</p>
          {status ? <div className="mt-3">{status}</div> : null}
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
          onClick={() => setExpanded((current) => !current)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-xl font-light text-white/70 transition hover:border-[var(--helios-orange)]/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] motion-reduce:transition-none"
        >
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </div>
      <div id={bodyId} hidden={!expanded} className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}
