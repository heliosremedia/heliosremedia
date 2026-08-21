import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildPageMetadata({ title: "Helios Studio Google Reviews", description: "Learn how authorized Helios administrators connect Google Business Profile reviews to Helios Studio for private review and curation.", path: "/google-business-integration", settings });
}

const safeguards = [
  ["Administrator controlled", "Only authorized Helios administrators can connect the company’s Google Business Profile or run a review synchronization."],
  ["Review before publish", "Synchronized reviews enter a private administrative review workflow. They are not automatically published to the Helios website."],
  ["Curated presentation", "An administrator intentionally selects which imported reviews become Featured Google Reviews and controls their public presentation."],
] as const;

export default async function GoogleBusinessIntegrationPage() {
  const settings = await getSiteSettings();
  const supportEmail = settings.email || "jake@heliosrealestatemedia.com";
  return <main className="min-h-screen bg-[#090909] text-white">
    <Navbar variant="solid" />
    <section className="relative overflow-hidden border-b border-white/[0.08] pt-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,107,43,0.14),transparent_34%)]" />
      <div className="container-shell relative py-20 sm:py-28 lg:py-32">
        <p className="eyebrow text-[var(--helios-orange)]">Google Business Profile integration</p>
        <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.25rem,7vw,7rem)] font-light leading-[0.9] tracking-[-0.055em]">Helios Studio<br /><span className="text-white/52">Google Reviews</span></h1>
        <p className="mt-8 max-w-3xl text-base leading-8 text-white/48 sm:text-lg">This application allows authorized Helios administrators to connect the company’s Google Business Profile and synchronize customer reviews into Helios Studio for administrative review and curation.</p>
      </div>
    </section>

    <section className="container-shell py-16 sm:py-20 lg:py-24">
      <div className="grid gap-5 lg:grid-cols-3">{safeguards.map(([title, body], index) => <article key={title} className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6 sm:p-7"><p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--helios-orange)]">0{index + 1}</p><h2 className="mt-5 font-display text-3xl font-light text-white/90">{title}</h2><p className="mt-4 text-sm leading-7 text-white/42">{body}</p></article>)}</div>

      <div className="mt-16 grid gap-12 border-t border-white/[0.08] pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(30rem,1.2fr)] lg:gap-20">
        <div><p className="eyebrow text-[var(--helios-orange)]">How it works</p><h2 className="mt-5 font-display text-4xl font-light leading-tight tracking-[-0.035em] sm:text-5xl">A managed source for an existing Helios feature.</h2></div>
        <div className="space-y-7 text-[0.98rem] leading-8 text-white/48">
          <p>After an authorized administrator grants access, Helios Studio can retrieve review details associated with the selected company profile, including reviewer attribution, rating, review text, timestamps, and a business reply when available.</p>
          <p>Synchronization does not automatically place a review on the public website. Imported reviews remain in Helios Studio until an administrator creates an unpublished Featured Google Review draft, reviews its presentation, and separately chooses to publish it.</p>
          <p>Helios Studio does not claim partnership with, sponsorship by, certification from, or endorsement by Google.</p>
        </div>
      </div>

      <div className="mt-16 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.09] p-6 sm:p-8"><h2 className="font-display text-3xl font-light">Disconnecting access</h2><p className="mt-4 text-sm leading-7 text-white/44">An authorized administrator can disconnect Google Business Profile from the Featured Google Reviews area in Helios Studio. Helios removes the stored Google authorization and attempts to revoke access with Google. Previously curated Featured Google Reviews are not automatically deleted.</p></section>
        <section className="rounded-2xl border border-white/[0.09] p-6 sm:p-8"><h2 className="font-display text-3xl font-light">Data deletion requests</h2><p className="mt-4 text-sm leading-7 text-white/44">To request deletion of data associated with this integration, email <a className="text-[var(--helios-orange)] underline decoration-white/20 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)]" href={`mailto:${supportEmail}?subject=Google%20Business%20Profile%20data%20deletion%20request`}>{supportEmail}</a>. Helios will verify the request before removing administrative integration data.</p></section>
      </div>

      <nav aria-label="Integration policies" className="mt-16 flex flex-col gap-3 border-t border-white/[0.08] pt-10 sm:flex-row sm:items-center">
        <Link href="/privacy" className="public-btn public-btn-compact min-h-11 justify-center">Privacy Policy</Link>
        <Link href="/terms" className="public-btn public-btn-compact min-h-11 justify-center">Terms of Service</Link>
        <Link href="/contact" className="public-btn public-btn-compact min-h-11 justify-center">Contact Helios</Link>
      </nav>
    </section>
    <Footer />
  </main>;
}
