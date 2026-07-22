import type { Metadata } from "next";

import Footer from "@/app/components/Footer";
import ManagedCtaSection from "@/app/components/ManagedCtaSection";
import Navbar from "@/app/components/Navbar";
import { PhoneLink } from "@/app/components/SiteActionLink";
import { prisma } from "@/lib/prisma";
import { getAbsoluteUrl } from "@/lib/site";
import { defaultPageCtas } from "@/lib/ctas";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

import FaqExplorer from "./FaqExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> { const settings = await getSiteSettings(); return buildPageMetadata({ title: "Frequently Asked Questions | Helios Real Estate Media", description: "Answers about booking, preparing a property, real estate photography, video, aerial media, delivery, and working with Helios Real Estate Media.", path: "/faq", settings }); }

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
      <Navbar variant="solid" />

      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,107,43,0.17),transparent_34%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-soft-light" />
        <div className="container-shell relative py-24 sm:py-32 lg:py-36">
          <p className="eyebrow text-[var(--helios-orange)]">Helpful answers, clearly framed</p>
          <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-end">
            <h1 className="max-w-5xl font-display text-[clamp(3.7rem,8.8vw,8.5rem)] font-light leading-[0.85] tracking-[-0.06em] text-white">Before the camera arrives.</h1>
            <div><p className="text-sm leading-7 text-white/42 sm:text-base">Everything you need to know about planning, production, delivery, and making the most of your Helios media.</p><PhoneLink prefix="Can't find your answer? Call " className="mt-7 block text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-white/22 transition hover:text-white/50" /></div>
          </div>
        </div>
      </section>

      <FaqExplorer categories={categories} />

      <ManagedCtaSection slot="FAQ_FOOTER" fallback={defaultPageCtas.FAQ_FOOTER} />
      <Footer />
    </main>
  );
}
