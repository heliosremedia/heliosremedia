import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import PhotoFinishComparison from "./PhotoFinishComparison";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildPageMetadata({
    title: "Compare Standard and Editorial Real Estate Photography | Helios",
    description:
      "Compare Helios Standard Finish with our architectural-inspired Editorial Finish for custom, luxury, and design-forward homes.",
    path: "/photo-finishes",
    settings,
  });
}

const comparisons = [
  {
    standardSrc: "/photo-finishes/standard-bathroom.jpg",
    editorialSrc: "/photo-finishes/editorial-bathroom.jpg",
    alt: "Luxury bathroom with walnut cabinetry and marble shower",
  },
  {
    standardSrc: "/photo-finishes/standard-staircase.jpg",
    editorialSrc: "/photo-finishes/editorial-staircase.jpg",
    alt: "Modern floating staircase with mountain views",
  },
  {
    standardSrc: "/photo-finishes/standard-kitchen.jpg",
    editorialSrc: "/photo-finishes/editorial-kitchen.jpg",
    alt: "Custom kitchen with wood cabinetry and waterfall island",
  },
];

const finishDetails = [
  {
    number: "01",
    title: "Standard Finish",
    positioning: "Bright, polished, and MLS-forward.",
    description:
      "Our signature listing finish is designed for clarity, consistency, and immediate impact across MLS, property websites, and social media.",
    items: [
      "Bright and inviting presentation",
      "Clean, accurate color",
      "Strong window and exterior visibility",
      "Broad appeal across property types",
      "Same-day photo delivery",
    ],
  },
  {
    number: "02",
    title: "Editorial Finish",
    positioning: "Refined, dimensional, and design-forward.",
    description:
      "An architectural-inspired treatment that brings greater attention to materials, natural light, tonal depth, and the atmosphere of the space.",
    items: [
      "Warmer, more natural tonal direction",
      "Controlled highlights and softer contrast",
      "Greater emphasis on materials and texture",
      "Ideal for custom and luxury homes",
      "Delivery within 48 hours",
    ],
  },
];

export default function PhotoFinishesPage() {
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar variant="solid" />

      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(217,107,43,0.15),transparent_34%)]" />
        <div className="container-shell relative py-16 sm:py-24 lg:py-28">
          <p className="eyebrow text-[var(--helios-orange)]">Photography finishes</p>
          <h1 className="mt-7 max-w-6xl font-display text-[clamp(3.2rem,7.6vw,7.25rem)] font-light leading-[0.9] tracking-[-0.055em]">
            Two ways to present a home.
            <span className="mt-2 block italic text-white/48">One uncompromising standard.</span>
          </h1>
          <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <p className="max-w-3xl text-base leading-8 text-white/48 sm:text-lg">
              Choose the bright clarity of our Standard Finish or the warmer, architectural-inspired depth of our Editorial Finish. Both are crafted with the same care. The right choice depends on the property and the story it needs to tell.
            </p>
            <Link href="#compare" className="public-btn public-btn-compact min-h-12 justify-center">
              Compare the finishes <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>
      </section>

      <section id="compare" className="container-shell scroll-mt-28 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="eyebrow text-[var(--helios-orange)]">See the difference</p>
          <h2 className="mt-5 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
            The same home, interpreted with a different visual intention.
          </h2>
          <p className="mt-6 text-sm leading-7 text-white/42 sm:text-base">
            Drag each image to compare the brighter Standard direction with the warmer, more restrained Editorial direction.
          </p>
        </div>

        <div className="mt-12 space-y-14 sm:mt-16 sm:space-y-20">
          {comparisons.map((comparison, index) => (
            <PhotoFinishComparison key={comparison.standardSrc} {...comparison} priority={index === 0} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[#0d0d0d]">
        <div className="container-shell py-20 sm:py-28">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.09] lg:grid-cols-2">
            {finishDetails.map((finish) => (
              <article key={finish.title} className="bg-[#0d0d0d] p-7 sm:p-10 lg:p-12">
                <div className="flex items-center justify-between gap-6">
                  <p className="eyebrow text-[var(--helios-orange)]">{finish.number}</p>
                  {finish.title === "Editorial Finish" && (
                    <span className="rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)]/[0.07] px-3 py-2 text-[0.48rem] font-semibold uppercase tracking-[0.17em] text-[var(--helios-orange)]">
                      Included with Luxe
                    </span>
                  )}
                </div>
                <h2 className="mt-7 font-display text-4xl font-light tracking-[-0.04em] sm:text-5xl">{finish.title}</h2>
                <p className="mt-4 text-sm font-medium uppercase tracking-[0.12em] text-white/52">{finish.positioning}</p>
                <p className="mt-6 max-w-xl text-sm leading-7 text-white/42 sm:text-base">{finish.description}</p>
                <ul className="mt-8 space-y-4 border-t border-white/[0.08] pt-8">
                  {finish.items.map((item) => (
                    <li key={item} className="flex gap-4 text-sm leading-6 text-white/58">
                      <span aria-hidden="true" className="mt-[0.68rem] h-px w-5 shrink-0 bg-[var(--helios-orange)]/75" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">Which finish fits?</p>
            <h2 className="mt-5 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
              Let the property lead the decision.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/42 sm:text-base">
              Standard is our recommendation for most listings. Editorial Finish is designed for homes where architecture, interior design, materials, and atmosphere are central to the marketing story.
            </p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.09]">
            <Image
              src="/photo-finishes/editorial-detail.jpg"
              alt="Editorial detail photograph of a custom luxury kitchen"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[radial-gradient(circle_at_75%_30%,rgba(217,107,43,0.13),transparent_33%),#0d0d0d]">
        <div className="container-shell py-20 sm:py-28">
          <div className="mx-auto max-w-5xl text-center">
            <p className="eyebrow text-center text-[var(--helios-orange)]">Helios Editorial Finish</p>
            <h2 className="mt-6 text-balance font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
              Add a more considered finish to your next listing.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
              Available as a $195 upgrade with Base or Pro photography and included with every Luxe package. Editorial galleries are delivered within 48 hours.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Link href="/book" className="inline-flex min-h-12 items-center rounded-full bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-[var(--helios-orange-hover)]">
                Book Editorial Finish
              </Link>
              <Link href="/inquire" className="inline-flex min-h-12 items-center rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 transition hover:border-white/30 hover:text-white">
                Ask which finish fits
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
