import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import { prisma } from "@/lib/prisma";
import { getAbsoluteUrl } from "@/lib/site";

import FaqExplorer from "./FaqExplorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Helios Real Estate Media",
  description: "Answers about booking, preparing a property, real estate photography, video, aerial media, delivery, and working with Helios Real Estate Media.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const categories = await prisma.faqCategory.findMany({
    where: { active: true, faqs: { some: { published: true } } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      faqs: {
        where: { published: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, question: true, answer: true },
      },
    },
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": getAbsoluteUrl("/faq"),
    mainEntity: categories.flatMap((category) => category.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    }))),
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="border-b border-white/[0.08] bg-[#090909]/95 backdrop-blur-xl">
        <div className="container-shell flex min-h-24 items-center justify-between gap-6 py-5">
          <Link href="/" aria-label="Helios Real Estate Media home"><Image src="/brand/helios-logo.png" alt="Helios Real Estate Media" width={260} height={90} priority className="h-auto w-40 sm:w-48" /></Link>
          <nav className="flex items-center gap-5 sm:gap-8" aria-label="Frequently asked questions">
            <Link href="/portfolio" className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-white">Portfolio</Link>
            <Link href="/services" className="hidden text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/45 transition hover:text-white sm:inline">Services</Link>
            <a href="tel:+19706825533" className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-5 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)]">Book now</a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,107,43,0.17),transparent_34%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light" />
        <div className="container-shell relative py-24 sm:py-32 lg:py-36">
          <p className="eyebrow text-[var(--helios-orange)]">Helpful answers, clearly framed</p>
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-end">
            <h1 className="max-w-5xl font-display text-[clamp(3.7rem,8.8vw,8.5rem)] font-light leading-[0.85] tracking-[-0.06em] text-white">Before the camera arrives.</h1>
            <div><p className="text-sm leading-7 text-white/42 sm:text-base">Everything you need to know about planning, production, delivery, and making the most of your Helios media.</p><p className="mt-7 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-white/22">Can&apos;t find your answer? Call 970.682.5533</p></div>
          </div>
        </div>
      </section>

      <FaqExplorer categories={categories} />

      <section className="border-t border-white/[0.08] bg-[#0d0d0d]">
        <div className="container-shell flex flex-col gap-8 py-20 sm:py-24 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="eyebrow text-[var(--helios-orange)]">Still curious?</p><h2 className="mt-5 max-w-3xl font-display text-5xl font-light tracking-[-0.045em] text-white sm:text-6xl">Let&apos;s talk through your project.</h2></div>
          <a href="tel:+19706825533" className="inline-flex min-h-12 items-center justify-center self-start rounded-[3px] bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[var(--helios-orange-hover)] lg:self-auto">Call Helios</a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
