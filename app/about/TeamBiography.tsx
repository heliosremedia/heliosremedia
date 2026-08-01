"use client";

import { useEffect, useId, useRef, useState } from "react";

import RichText from "@/app/components/RichText";

export default function TeamBiography({ biography }: { biography: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setOverflowing(content.scrollHeight > content.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [biography, expanded]);

  function toggle() {
    setExpanded((value) => !value);
    if (expanded) {
      requestAnimationFrame(() =>
        contentRef.current?.scrollIntoView({ block: "nearest" }),
      );
    }
  }

  return (
    <div className="mt-5">
      <div
        id={contentId}
        ref={contentRef}
        className={expanded ? "" : "line-clamp-5 sm:line-clamp-6"}
      >
        <RichText content={biography} className="text-sm leading-7 text-white/42" />
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggle}
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-[0.56rem] font-semibold uppercase tracking-[0.13em] text-white/45 transition hover:text-[var(--helios-orange)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)]"
        >
          {expanded ? "Show Less" : "Read More"}
          <svg aria-hidden="true" viewBox="0 0 12 8" className={`h-2 w-3 fill-none stroke-current transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}>
            <path d="m1 1 5 5 5-5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
