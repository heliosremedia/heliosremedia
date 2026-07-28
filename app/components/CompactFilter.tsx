import Link from "next/link";
import type { ReactNode } from "react";

export const compactFilterClass = "inline-flex min-h-11 max-w-full items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-[0.54rem] font-semibold uppercase leading-[1.2] tracking-[0.14em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]";

export function CompactFilterLink({
  href, active = false, children, analyticsLabel,
}: { href: string; active?: boolean; children: ReactNode; analyticsLabel?: string }) {
  return <Link
    href={href}
    aria-current={active ? "true" : undefined}
    data-analytics-event="PORTFOLIO_FILTER_USE"
    data-analytics-channel="portfolio"
    data-analytics-label={analyticsLabel}
    className={`${compactFilterClass} ${active
      ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
      : "border-white/10 text-white/45 hover:border-white/25 hover:text-white"}`}
  >{children}</Link>;
}

export function CompactFilterAnchor({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className={`${compactFilterClass} border-white/10 text-white/45 hover:border-white/25 hover:text-white`}>{children}</a>;
}
