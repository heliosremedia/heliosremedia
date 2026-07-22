import type { Metadata } from "next";
import Image from "next/image";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { getAboutPageContent } from "@/lib/about-page";
import { defaultPageCtas } from "@/lib/ctas";
import { getVisibleTeamMembers, teamMemberCategoryLabels } from "@/lib/team-members";

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
  const [content, teamMembers] = await Promise.all([getAboutPageContent(), getVisibleTeamMembers()]);
  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar />

      <section className="relative min-h-[100svh] overflow-hidden bg-[#111] sm:min-h-[88vh]">
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

        <div className="container-shell relative flex min-h-[100svh] items-end pb-14 pt-32 sm:min-h-[88vh] sm:pb-24 sm:pt-40">
          <div className="max-w-6xl">
            <p className="eyebrow text-[var(--helios-orange)]">{content.heroEyebrow}</p>
            <h1 className="mt-7 max-w-6xl font-display text-[clamp(3.15rem,11vw,8rem)] font-light leading-[0.94] tracking-[-0.058em] text-white">
              {content.heroHeadline}
            </h1>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-white/62 sm:mt-10 sm:text-base sm:leading-8">
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
          <h2 className="max-w-5xl font-display text-[clamp(2.75rem,5vw,5.25rem)] font-light leading-[1] tracking-[-0.048em] text-[#f2ede7]">
            {content.storyHeadline}
          </h2>
          <div className="mt-12 grid gap-7 border-t border-white/[0.1] pt-8 sm:grid-cols-2">
            <p className="text-sm leading-7 text-white/46">
              {content.storyBodyLeft}
            </p>
            <p className="text-sm leading-7 text-white/46">
              {content.storyBodyRight}
            </p>
          </div>
        </div>
      </section>

      {content.founderEnabled && content.founderImageUrl && (
        <section className="border-b border-white/[0.08] bg-[#0c0c0c]">
          <div className="container-shell py-20 sm:py-28 lg:py-36">
            <div className="mx-auto max-w-6xl">
              <div className="text-center">
                <p className="eyebrow text-[var(--helios-orange)]">{content.founderEyebrow}</p>
                <span className="mx-auto mt-5 block h-px w-16 bg-[var(--helios-orange)]/70" />
              </div>

              <div className="mt-12 grid items-center gap-12 sm:mt-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-20">
                <div className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] overflow-hidden rounded-[1.1rem] border border-white/[0.1] bg-[#111]">
                  <Image
                    src={content.founderImageUrl}
                    alt={content.founderImageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                </div>

                <div>
                  <h2 className="font-display text-[clamp(3.5rem,7vw,7rem)] font-light leading-[0.92] tracking-[-0.055em] text-white">
                    Meet <span className="italic text-[var(--helios-orange)]">{content.founderFirstName}</span>
                  </h2>
                  <span className="mt-7 block h-px w-20 bg-[var(--helios-orange)]/75" />
                  <p className="mt-8 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/75">
                    {content.founderRole}
                  </p>
                  <p className="mt-7 max-w-xl whitespace-pre-line text-sm leading-7 text-white/58 sm:text-base sm:leading-8">
                    {content.founderBody}
                  </p>
                  <p className="mt-10 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-light italic leading-[1.08] tracking-[-0.035em] text-white/88">
                    {content.founderSignature}
                  </p>
                  <p className="mt-8 text-[0.62rem] font-semibold uppercase tracking-[0.25em] text-[var(--helios-orange)]">
                    {content.founderTitle}
                  </p>
                </div>
              </div>

              <blockquote className="relative mx-auto mt-16 max-w-5xl rounded-2xl border border-white/[0.16] px-7 py-8 text-center sm:px-14">
                <span aria-hidden="true" className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c0c] px-5 font-display text-5xl leading-none text-[var(--helios-orange)]">“</span>
                <p className="font-display text-xl font-light leading-7 tracking-[-0.02em] text-white/75 sm:text-2xl sm:leading-8">
                  {content.founderTeamNote}
                </p>
              </blockquote>
            </div>
          </div>
        </section>
      )}

      <section className="border-b border-white/[0.08] bg-[#090909]">
        <div className="container-shell py-20 sm:py-28 lg:py-36">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-end lg:gap-16">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">The team behind the frame</p>
              <h2 className="mt-6 max-w-4xl font-display text-[clamp(2.75rem,5vw,5rem)] font-light leading-[0.98] tracking-[-0.048em] text-white">
                A lean creative crew built for polished, dependable delivery.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/42 sm:text-base sm:leading-8">
              Helios pairs photographers, filmmakers, drone operators, editors, and client coordinators around one shared production standard: make the property feel considered before, during, and after the shoot.
            </p>
          </div>

          {teamMembers.length > 0 ? (
            <div className={`mt-10 grid gap-5 ${teamMembers.length === 1 ? "mx-auto max-w-5xl" : teamMembers.length === 2 ? "mx-auto max-w-5xl sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {teamMembers.map((member) => (
                <article key={member.id} className={`group overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.025] ${teamMembers.length === 1 ? "lg:grid lg:grid-cols-[0.85fr_1.15fr]" : ""}`}>
                  <div className={`relative bg-[#111] ${teamMembers.length === 1 ? "min-h-[28rem]" : "aspect-[4/5]"}`}>
                    {member.portraitUrl ? <Image src={member.portraitUrl} alt={member.portraitAlt ?? member.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover grayscale transition duration-700 group-hover:grayscale-0" style={{ objectPosition: `${member.focalX * 100}% ${member.focalY * 100}%` }} /> : <div className="flex h-full items-center justify-center font-display text-8xl text-white/12">{member.name.charAt(0)}</div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-transparent" />
                    <p className="absolute bottom-5 left-5 right-5 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">{teamMemberCategoryLabels[member.category]}</p>
                  </div>
                  <div className="p-6 sm:p-7">
                    <h3 className="font-display text-4xl font-light tracking-[-0.045em] text-white/90">{member.name}</h3>
                    <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/45">{member.title}</p>
                    <p className="mt-5 text-sm leading-7 text-white/42">{member.biography}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Production", "Photography, film, aerial, and property-detail coverage planned around the listing story."],
                ["Post-production", "Consistent color, pacing, retouching, and delivery prep across every campaign asset."],
                ["Client care", "Clear scheduling, expectations, and handoff so agents and sellers know what happens next."],
                ["Marketing support", "Reusable content thinking for listings, social channels, websites, and agent brands."],
              ].map(([title, copy]) => (
                <article key={title} className="rounded-2xl border border-white/[0.1] bg-white/[0.025] p-7 transition duration-500 hover:border-[var(--helios-orange)]/45 hover:bg-white/[0.04]">
                  <span className="block h-px w-10 bg-[var(--helios-orange)]/75" />
                  <h3 className="mt-8 font-display text-3xl font-light tracking-[-0.04em] text-white/88">{title}</h3>
                  <p className="mt-5 text-sm leading-7 text-white/38">{copy}</p>
                </article>
              ))}
            </div>
          )}
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

          <div className="mt-12 grid border-b border-white/[0.09] sm:mt-14 lg:grid-cols-4">
            {content.principles.map((principle, index) => (
              <article
                key={principle.number}
                className={`group relative min-h-72 border-white/[0.09] px-1 py-9 lg:min-h-[22rem] lg:px-8 lg:py-11 ${
                  index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
                }`}
              >
                <span className="font-display text-2xl font-light text-[var(--helios-orange)]/85">
                  {principle.number}
                </span>
                <div className="mt-12 lg:mt-14">
                  <h3 className="font-display text-4xl font-light leading-none tracking-[-0.04em] text-white/85">
                    {principle.title}
                  </h3>
                  <p className="mt-5 text-sm leading-7 text-white/46 transition group-hover:text-white/65">
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
