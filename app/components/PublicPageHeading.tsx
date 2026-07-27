import type { ReactNode } from "react";

export default function PublicPageHeading({ eyebrow, headline, summary, metadata, actions, className = "" }: {
  eyebrow?: ReactNode; headline: ReactNode; summary?: ReactNode; metadata?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return <header className={`public-page-heading max-w-5xl ${className}`}>
    {eyebrow&&<div className="eyebrow text-[var(--helios-orange)]">{eyebrow}</div>}
    <h1 className="mt-[clamp(1.25rem,3vw,2rem)] font-display text-[clamp(3rem,7vw,7rem)] font-light leading-[.94] tracking-[-.05em] text-balance">{headline}</h1>
    {summary&&<div className="mt-[clamp(1.5rem,3vw,2.25rem)] max-w-2xl text-base leading-8 text-white/52 sm:text-lg">{summary}</div>}
    {metadata&&<div className="mt-5 text-sm text-white/38">{metadata}</div>}
    {actions&&<div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
  </header>;
}
