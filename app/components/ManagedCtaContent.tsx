"use client";

import type { PublicCta } from "@/lib/ctas";
import RichText from "./RichText";
import SiteActionLink from "./SiteActionLink";

export default function ManagedCtaContent({ cta, availabilityMessage }: { cta: PublicCta; availabilityMessage?: string | null }) {
  return <section className="relative overflow-hidden border-y border-white/[0.08] bg-[#0d0d0d]">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(217,107,43,0.14),transparent_31%)]" />
    <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.025]" />
    <div className="container-shell relative flex flex-col gap-10 py-24 sm:py-32 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {cta.eyebrow && <p className="eyebrow text-[var(--helios-orange)]">{cta.eyebrow}</p>}
        <h2 className={`${cta.eyebrow ? "mt-6" : ""} max-w-4xl font-display text-[clamp(3rem,6.5vw,6rem)] font-light leading-[1.04] tracking-[-0.052em] text-white`}>{cta.headline}</h2>
        {cta.body && <RichText content={cta.body} className="mt-12 max-w-xl text-sm leading-7 text-white/38" />}
      </div>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
        <SiteActionLink type={cta.primaryActionType} value={cta.primaryValue} className="inline-flex min-h-14 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-8 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[var(--helios-orange-hover)]">{cta.primaryLabel}</SiteActionLink>
        {cta.secondaryLabel && cta.secondaryActionType && <SiteActionLink type={cta.secondaryActionType} value={cta.secondaryValue} className="inline-flex min-h-14 items-center justify-center rounded-[3px] border border-white/15 px-8 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/55 transition hover:border-white/35 hover:text-white">{cta.secondaryLabel}</SiteActionLink>}
        {availabilityMessage && <p className="mt-2 flex max-w-xs items-start gap-2.5 text-xs leading-5 text-white/42 sm:basis-full lg:mt-3">
          <span aria-hidden="true" className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--helios-orange)] shadow-[0_0_12px_rgba(217,107,43,0.55)]" />
          {availabilityMessage}
        </p>}
      </div>
    </div>
  </section>;
}
