import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import { BookingLink } from "@/app/components/SiteActionLink";
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

const principles = [
  {
    number: "01",
    title: "See the story",
    copy: "We look beyond rooms and square footage to find the light, rhythm, setting, and details that give a property its identity.",
  },
  {
    number: "02",
    title: "Create with intent",
    copy: "Every frame has a job: guide attention, build emotion, clarify value, or give the audience a reason to remember.",
  },
  {
    number: "03",
    title: "Protect the truth",
    copy: "Refined presentation should elevate what is already there. Honest color, natural perspective, and thoughtful composition keep the work credible.",
  },
  {
    number: "04",
    title: "Elevate the experience",
    copy: "The process matters as much as the final gallery. Preparation, communication, production, and delivery should all feel considered.",
  },
];

const process = [
  {
    number: "01",
    title: "Prepare",
    copy: "We align on the property, audience, deliverables, and the moments that deserve special attention before production begins.",
  },
  {
    number: "02",
    title: "Create",
    copy: "Photography, film, aerial, and supporting content are captured as one connected visual system—not isolated assets.",
  },
  {
    number: "03",
    title: "Refine",
    copy: "Every selection is edited for clarity, consistency, natural color, and the pacing required by its final destination.",
  },
  {
    number: "04",
    title: "Deliver",
    copy: "Organized, campaign-ready media arrives prepared for listings, websites, social platforms, and future marketing needs.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/[0.1] bg-black/20 backdrop-blur-xl">
        <div className="container-shell flex min-h-24 items-center justify-between gap-6 py-5">
          <Link href="/" aria-label="Helios Real Estate Media home">
            <Image
              src="/brand/helios-logo.png"
              alt="Helios Real Estate Media"
              width={260}
              height={90}
              priority
              className="h-auto w-40 sm:w-48"
            />
          </Link>

          <nav
            className="flex items-center gap-5 sm:gap-8"
            aria-label="About Helios"
          >
            <Link
              href="/portfolio"
              className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/55 transition hover:text-white"
            >
              Portfolio
            </Link>
            <Link
              href="/services"
              className="hidden text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/55 transition hover:text-white sm:inline"
            >
              Services
            </Link>
            <BookingLink
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-5 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]"
            >
              Book now
            </BookingLink>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[88vh] overflow-hidden bg-[#111]">
        <Image
          src="/approach/helios-approach.jpg"
          alt="Refined contemporary interior photographed by Helios Real Estate Media"
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
            <p className="eyebrow text-[var(--helios-orange)]">About Helios</p>
            <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.7rem,9.2vw,9rem)] font-light leading-[0.83] tracking-[-0.062em] text-white">
              Presentation shapes perception.
            </h1>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-white/58 sm:text-base sm:leading-8">
              Helios is a Northern Colorado real estate media studio built
              around one belief: thoughtful presentation changes how a property
              is seen, remembered, and valued.
            </p>
          </div>
        </div>
      </section>

      <section className="container-shell grid gap-14 border-b border-white/[0.08] py-20 sm:py-28 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-24 lg:py-36">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Why we exist</p>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/40 sm:text-base sm:leading-8">
            Real estate media is often treated as documentation. We see it as
            positioning—the first signal of care, quality, and value a buyer
            receives.
          </p>
        </div>

        <div>
          <h2 className="max-w-4xl font-display text-[clamp(2.9rem,5.8vw,6rem)] font-light leading-[0.94] tracking-[-0.052em] text-[#f2ede7]">
            We create the visual language that helps exceptional properties feel{" "}
            <span className="italic text-white">impossible to overlook.</span>
          </h2>
          <div className="mt-10 grid gap-7 border-t border-white/[0.1] pt-8 sm:grid-cols-2">
            <p className="text-sm leading-7 text-white/40">
              Photography, cinematic film, aerial perspectives, agent branding,
              and social content are approached as parts of the same campaign.
              The result is more coherent, more useful, and more memorable than
              a collection of disconnected deliverables.
            </p>
            <p className="text-sm leading-7 text-white/40">
              We work with agents, builders, designers, and property
              professionals who understand that presentation is not decoration.
              It is a strategic part of how trust is earned and value is
              communicated.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.08] bg-[#0c0c0c]">
        <div className="container-shell py-20 sm:py-28 lg:py-36">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                The Helios point of view
              </p>
              <h2 className="mt-6 max-w-3xl font-display text-[clamp(3rem,6vw,6rem)] font-light leading-[0.92] tracking-[-0.052em] text-white">
                Beauty with a purpose.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/35">
              A clear set of principles keeps the work consistent while every
              property remains distinct.
            </p>
          </div>

          <div className="mt-14 grid border-b border-white/[0.09] lg:grid-cols-4">
            {principles.map((principle, index) => (
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
            src="/standard/standard-8.jpg"
            alt="Luxury interior media created by Helios"
            fill
            sizes="(max-width: 640px) 100vw, 65vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        </div>

        <div className="grid gap-5">
          <div className="relative min-h-64 overflow-hidden bg-[#111]">
            <Image
              src="/standard/standard-3.jpg"
              alt="Architectural detail photographed by Helios"
              fill
              sizes="(max-width: 640px) 100vw, 35vw"
              className="object-cover"
            />
          </div>
          <div className="relative min-h-64 overflow-hidden bg-[#111]">
            <Image
              src="/standard/standard-12.jpg"
              alt="Elevated property photography by Helios"
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
                The client experience
              </p>
              <h2 className="mt-6 font-display text-[clamp(3rem,5.5vw,5.5rem)] font-light leading-[0.92] tracking-[-0.05em] text-white">
                Considered from first call to final delivery.
              </h2>
            </div>

            <div className="border-t border-white/[0.1]">
              {process.map((step) => (
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
