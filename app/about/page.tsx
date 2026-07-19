import type { Metadata } from "next";
import Image from "next/image";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { getAboutPageContent } from "@/lib/about-page";
import { defaultPageCtas } from "@/lib/ctas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Helios | Real Estate Media in Northern Colorado",
  description:
    "Meet Helios Real Estate Media—a Northern Colorado studio creating intentional photography, cinematic film, aerial media, and marketing content for properties and real estate professionals.",
  alternates: {
    canonical: "/about",
  },
};

export default async function AboutPage() {
  const content = await getAboutPageContent();
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar />

      <section className="relative min-h-[88vh] overflow-hidden bg-[#111]">
        <Image
          src={content.heroImageUrl ?? "/approach/helios-approach.jpg"}
          alt={content.heroImageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/42 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/38" />
        <div className="hero-grain absolute inset-0 opacity-[0.035] mix-blend-soft-light" />

        <div className="container-shell relative flex min-h-[88vh] items-end pb-16 pt-40 sm:pb-24">
          <div className="max-w-6xl">
            <p className="eyebrow text-[var(--helios-orange)]">{content.heroEyebrow}</p>
            <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.7rem,9.2vw,9rem)] font-light leading-[0.9] tracking-[-0.062em] text-white">
              {content.heroHeadline}
            </h1>
            <p className="mt-10 max-w-2xl text-sm leading-7 text-white/58 sm:text-base sm:leading-8">
              {content.heroBody}
            </p>
          </div>
        </div>
      </section>

      <section className="container-shell grid gap-14 border-b border-white/[0.08] py-20 sm:py-28 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-24 lg:py-36">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">{content.storyEyebrow}</p>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/40 sm:text-base sm:leading-8">
            {content.storyIntro}
          </p>
        </div>

        <div>
          <h2 className="max-w-4xl font-display text-[clamp(2.9rem,5.8vw,6rem)] font-light leading-[1] tracking-[-0.052em] text-[#f2ede7]">
            {content.storyHeadline}
          </h2>
          <div className="mt-12 grid gap-7 border-t border-white/[0.1] pt-8 sm:grid-cols-2">
            <p className="text-sm leading-7 text-white/40">
              {content.storyBodyLeft}
            </p>
            <p className="text-sm leading-7 text-white/40">
              {content.storyBodyRight}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] bg-[#0c0c0c]">
        <div className="container-shell py-20 sm:py-28 lg:py-36">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                {content.principlesEyebrow}
              </p>
              <h2 className="mt-6 max-w-3xl font-display text-[clamp(3rem,6vw,6rem)] font-light leading-[0.98] tracking-[-0.052em] text-white">
                {content.principlesHeadline}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/35">
              {content.principlesIntro}
            </p>
          </div>

          <div className="mt-14 grid border-b border-white/[0.09] lg:grid-cols-4">
            {content.principles.map((principle, index) => (
              <article
                key={principle.number}
                className={`group relative min-h-80 border-white/[0.09] px-1 py-10 lg:min-h-[28rem] lg:px-8 lg:py-12 ${
                  index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
                }`}
              >
                <span className="font-display text-xl text-[var(--helios-orange)]/70">
                  {principle.number}
                </span>
                <div className="mt-20 lg:mt-28">
                  <h3 className="font-display text-4xl font-light leading-none tracking-[-0.04em] text-white/85">
                    {principle.title}
                  </h3>
                  <p className="mt-6 text-sm leading-7 text-white/36 transition group-hover:text-white/55">
                    {principle.copy}
                  </p>
                </div>
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[var(--helios-orange)] to-transparent transition duration-700 group-hover:scale-x-100" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell grid gap-5 border-b border-white/[0.08] py-20 sm:grid-cols-2 sm:py-28 lg:grid-cols-[1.25fr_0.75fr] lg:py-36">
        <div className="relative min-h-[32rem] overflow-hidden bg-[#111] sm:min-h-[42rem]">
          <Image
            src={content.galleryOneUrl ?? "/standard/standard-8.jpg"}
            alt={content.galleryOneAlt}
            fill
            sizes="(max-width: 640px) 100vw, 65vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        </div>

        <div className="grid gap-5">
          <div className="relative min-h-64 overflow-hidden bg-[#111]">
            <Image
              src={content.galleryTwoUrl ?? "/standard/standard-3.jpg"}
              alt={content.galleryTwoAlt}
              fill
              sizes="(max-width: 640px) 100vw, 35vw"
              className="object-cover"
            />
          </div>
          <div className="relative min-h-64 overflow-hidden bg-[#111]">
            <Image
              src={content.galleryThreeUrl ?? "/standard/standard-12.jpg"}
              alt={content.galleryThreeAlt}
              fill
              sizes="(max-width: 640px) 100vw, 35vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08]">
        <div className="container-shell py-20 sm:py-28 lg:py-36">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-24">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                {content.processEyebrow}
              </p>
              <h2 className="mt-6 font-display text-[clamp(3rem,5.5vw,5.5rem)] font-light leading-[0.98] tracking-[-0.05em] text-white">
                {content.processHeadline}
              </h2>
            </div>

            <div className="border-t border-white/[0.1]">
              {content.process.map((step) => (
                <article
                  key={step.number}
                  className="grid gap-5 border-b border-white/[0.1] py-8 sm:grid-cols-[4rem_11rem_minmax(0,1fr)] sm:items-start"
                >
                  <span className="font-display text-xl text-[var(--helios-orange)]/65">
                    {step.number}
                  </span>
                  <h3 className="font-display text-3xl font-light tracking-[-0.035em] text-white/80">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-7 text-white/35">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ManagedCtaSection slot="ABOUT_FOOTER" fallback={defaultPageCtas.ABOUT_FOOTER} />

      <Footer />
    </main>
  );
}
