import Link from "next/link";
import type { ReactNode } from "react";

export const compactFilterClass = "inline-flex min-h-11 max-w-full items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-[0.54rem] font-semibold uppercase leading-[1.2] tracking-[0.14em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]";
export const compactFilterSectionClass = "flex flex-col gap-6";
export const compactFilterGroupClass = "grid grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:items-stretch sm:justify-start sm:gap-2";
export const compactFilterItemClass = "h-12 w-full px-2 sm:h-11 sm:w-auto sm:px-3.5";
export const compactFilterLeadClass = "col-span-2 h-12 w-[calc((100%-0.5rem)/2)] justify-self-start px-2 sm:col-span-1 sm:h-11 sm:w-auto sm:px-4";

export function CompactFilterLink({
  href, active = false, children, analyticsLabel, className = "",
}: { href: string; active?: boolean; children: ReactNode; analyticsLabel?: string; className?: string }) {
  return <Link
    href={href}
    aria-current={active ? "true" : undefined}
    data-analytics-event="PORTFOLIO_FILTER_USE"
    data-analytics-channel="portfolio"
    data-analytics-target={analyticsLabel || href}
    data-analytics-label={analyticsLabel}
    className={`${compactFilterClass} ${active
      ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
      : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"} ${className}`}
  >{children}</Link>;
}

export function CompactFilterAnchor({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={`${compactFilterClass} border-white/10 text-white/45 hover:border-white/25 hover:text-white ${className}`}>{children}</a>;
}
