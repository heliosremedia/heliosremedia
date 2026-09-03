import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { getPhotoComparisonPage } from "@/lib/photo-comparison";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import PhotoFinishComparison from "./PhotoFinishComparison";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildPageMetadata({ title: "Compare Standard and Editorial Real Estate Photography | Helios", description: "Compare Helios Standard Finish with our architectural-inspired Editorial Finish for custom, luxury, and design-forward homes.", path: "/photo-finishes", settings });
}

export default async function PhotoFinishesPage() {
  const page = await getPhotoComparisonPage();
  if (!page.active) notFound();
  const { content } = page;
  const pairs = page.pairs.filter((pair) => pair.active);

  return <main className="min-h-screen bg-[#090909] text-white">
    <Navbar variant="solid" />
    <section className="relative overflow-hidden border-b border-white/[0.08]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(217,107,43,0.15),transparent_34%)]" />
      <div className="container-shell relative py-16 sm:py-24 lg:py-28">
        <p className="eyebrow text-[var(--helios-orange)]">{content.heroEyebrow}</p>
        <h1 className="mt-7 max-w-6xl font-display text-[clamp(3.2rem,7.6vw,7.25rem)] font-light leading-[0.9] tracking-[-0.055em]">{content.heroHeading}</h1>
        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><p className="max-w-3xl text-base leading-8 text-white/60 sm:text-lg">{content.heroBody}</p><Link href="#compare" className="public-btn public-btn-compact min-h-12 justify-center">Compare the finishes <span aria-hidden="true">↓</span></Link></div>
      </div>
    </section>

    <section id="compare" className="container-shell scroll-mt-28 py-16 sm:py-24">
      <div className="max-w-3xl"><p className="eyebrow text-[var(--helios-orange)]">{content.comparisonEyebrow}</p><h2 className="mt-5 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">{content.comparisonHeading}</h2><p className="mt-6 text-sm leading-7 text-white/42 sm:text-base">{content.comparisonBody}</p></div>
      <div className="mt-12 space-y-14 sm:mt-16 sm:space-y-20">{pairs.map((pair, index) => <PhotoFinishComparison key={pair.id} standardSrc={pair.standardImageUrl} editorialSrc={pair.editorialImageUrl} editorialStyle={pair.editorialStyle} alt={pair.alt} caption={pair.caption} priority={index === 0} />)}</div>
    </section>

    <section className="border-y border-white/[0.08] bg-[#0d0d0d]"><div className="container-shell py-16 sm:py-24"><div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.09] lg:grid-cols-2">
      {[{ number: "01", title: content.standardTitle, positioning: content.standardPositioning, description: content.standardDescription, items: content.standardFeatures }, { number: "02", title: content.editorialTitle, positioning: content.editorialPositioning, description: content.editorialDescription, items: content.editorialFeatures, badge: content.editorialBadge }].map((finish) => <article key={finish.number} className="bg-[#0d0d0d] p-7 sm:p-10 lg:p-12"><div className="flex items-center justify-between gap-6"><p className="eyebrow text-[var(--helios-orange)]">{finish.number}</p>{finish.badge && <span className="rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)]/[0.07] px-3 py-2 text-[0.48rem] font-semibold uppercase tracking-[0.17em] text-[var(--helios-orange)]">{finish.badge}</span>}</div><h2 className="mt-7 font-display text-4xl font-light tracking-[-0.04em] sm:text-5xl">{finish.title}</h2><p className="mt-4 text-sm font-medium uppercase tracking-[0.12em] text-white/52">{finish.positioning}</p><p className="mt-6 max-w-xl text-sm leading-7 text-white/42 sm:text-base">{finish.description}</p><ul className="mt-8 space-y-4 border-t border-white/[0.08] pt-8">{finish.items.map((item) => <li key={item} className="flex gap-4 text-sm leading-6 text-white/58"><span aria-hidden="true" className="mt-[0.68rem] h-px w-5 shrink-0 bg-[var(--helios-orange)]/75" />{item}</li>)}</ul></article>)}
    </div></div></section>

    <section className="container-shell py-16 sm:py-24"><div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div><p className="eyebrow text-[var(--helios-orange)]">{content.decisionEyebrow}</p><h2 className="mt-5 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">{content.decisionHeading}</h2><p className="mt-6 max-w-xl text-sm leading-7 text-white/42 sm:text-base">{content.decisionBody}</p></div><div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.09]"><Image src={page.detailImageUrl} alt={page.detailImageAlt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /><div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" /></div></div></section>

    <section className="border-y border-white/[0.08] bg-[radial-gradient(circle_at_75%_30%,rgba(217,107,43,0.13),transparent_33%),#0d0d0d]"><div className="container-shell py-14 sm:py-18"><div className="mx-auto grid max-w-6xl gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div><p className="eyebrow text-[var(--helios-orange)]">{content.ctaEyebrow}</p><h2 className="mt-4 max-w-3xl text-balance font-display text-4xl font-light tracking-[-0.04em] sm:text-5xl">{content.ctaHeading}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">{content.ctaBody}</p></div><div className="flex flex-wrap gap-3 lg:max-w-72 lg:justify-end"><Link href={content.primaryDestination} className="inline-flex min-h-12 items-center rounded-full bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[var(--helios-orange-hover)]">{content.primaryLabel}</Link><Link href={content.secondaryDestination} className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 transition hover:border-white/30 hover:text-white">{content.secondaryLabel}</Link></div></div></div></section>
    <Footer />
  </main>;
}
