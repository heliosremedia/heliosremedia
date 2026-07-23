import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import {
  getLocationPage,
  LOCATION_PAGES,
} from "@/lib/location-pages";
import { buildPageMetadata } from "@/lib/seo";
import { getAbsoluteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";

type LocationPageProps = {
  params: Promise<{ city: string }>;
};

const featuredServices = [
  {
    name: "Photography",
    slug: "photography",
    detail:
      "Interior, exterior, and architectural imagery shaped around the property’s strongest features.",
  },
  {
    name: "Cinematic Films",
    slug: "cinematic-films",
    detail:
      "Story-driven property films that build emotion, context, and a memorable first impression.",
  },
  {
    name: "Drone Media",
    slug: "drone-photography",
    detail:
      "Aerial perspectives that clarify location, lot, views, amenities, and the surrounding community.",
  },
  {
    name: "Vertical Reels",
    slug: "vertical-reels",
    detail:
      "Social-first video created to help listings and agents earn attention beyond the MLS.",
  },
];

export async function generateMetadata({
  params,
}: LocationPageProps): Promise<Metadata> {
  const { city } = await params;
  const location = getLocationPage(city);

  if (!location) {
    notFound();
  }

  const settings = await getSiteSettings();

  return buildPageMetadata({
    title: location.seoTitle,
    description: location.seoDescription,
    path: `/locations/${location.slug}`,
    settings,
  });
}

export default async function LocationLandingPage({
  params,
}: LocationPageProps) {
  const { city } = await params;
  const location = getLocationPage(city);

  if (!location) {
    notFound();
  }

  const settings = await getSiteSettings();
  const bookingHref = settings.bookingUrl || "/inquire";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings.businessName,
    url: getAbsoluteUrl(`/locations/${location.slug}`),
    telephone: settings.phoneE164,
    description: location.seoDescription,
    image:
      settings.heroPosterUrl || settings.brandLogoUrl || undefined,
    areaServed: {
      "@type": "City",
      name: location.city,
      containedInPlace: {
        "@type": "State",
        name: "Colorado",
      },
    },
    serviceType: [
      "Real estate photography",
      "Cinematic real estate video",
      "Drone photography",
      "Vertical real estate video",
      "Agent branding",
    ],
  };

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <Navbar variant="solid" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <section className="relative min-h-[78svh] overflow-hidden border-b border-white/[0.08]">
        {settings.heroPosterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.heroPosterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#090909_10%,rgba(9,9,9,0.9)_46%,rgba(9,9,9,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,rgba(217,107,43,0.18),transparent_35%)]" />
        <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.035]" />

        <div className="container-shell relative flex min-h-[78svh] items-end py-20 sm:py-28 lg:py-32">
          <div className="max-w-5xl">
            <p className="eyebrow text-[var(--helios-orange)]">
              Northern Colorado · {location.county}
            </p>
            <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.6rem,8.5vw,8rem)] font-light leading-[0.84] tracking-[-0.06em]">
              Real estate media in{" "}
              <span className="text-[var(--helios-orange)]">
                {location.city}.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-white/52 sm:text-lg">
              {location.heroLead}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={bookingHref} className="admin-btn-primary">
                Book your shoot
              </Link>
              <Link href="/portfolio" className="admin-btn-secondary">
                Explore our work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell grid gap-12 border-b border-white/[0.08] py-20 sm:py-28 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">
            Built for {location.city}
          </p>
          <h2 className="mt-6 font-display text-[clamp(2.8rem,5vw,5.2rem)] font-light leading-[0.92] tracking-[-0.05em]">
            {location.marketTitle}
          </h2>
        </div>
        <div className="lg:pt-10">
          <p className="text-base leading-8 text-white/48">
            {location.introduction}
          </p>
          <p className="mt-6 text-base leading-8 text-white/48">
            {location.marketCopy}
          </p>
          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {location.localDetails.map((detail) => (
              <li
                key={detail}
                className="flex items-start gap-3 border-t border-white/[0.08] pt-4 text-sm leading-6 text-white/42"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--helios-orange)]" />
                {detail}
              </li>
            ))}
          </ul>
          <p className="mt-9 text-xs uppercase tracking-[0.16em] text-white/28">
            {location.serviceArea}
          </p>
        </div>
      </section>

      <section className="container-shell py-20 sm:py-28">
        <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-[var(--helios-orange)]">
              Complete listing presentation
            </p>
            <h2 className="mt-5 font-display text-4xl font-light tracking-[-0.04em] sm:text-6xl">
              Media designed to work together.
            </h2>
          </div>
          <Link
            href="/services"
            className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/42 transition hover:text-white"
          >
            View every service →
          </Link>
        </div>

        <div className="grid border-x border-b border-white/[0.08] sm:grid-cols-2 xl:grid-cols-4">
          {featuredServices.map((service, index) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="group min-h-72 border-r border-t border-white/[0.08] p-6 transition hover:bg-white/[0.025] sm:p-7"
            >
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-8 font-display text-3xl font-light tracking-[-0.035em] text-white">
                {service.name}
              </h3>
              <p className="mt-5 text-sm leading-7 text-white/36">
                {service.detail}
              </p>
              <span className="mt-8 inline-block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/32 transition group-hover:text-white">
                Explore service →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-white/[0.015]">
        <div className="container-shell py-16 sm:py-20">
          <p className="text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/28">
            Helios across Northern Colorado
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {LOCATION_PAGES.map((item) => (
              <Link
                key={item.slug}
                href={`/locations/${item.slug}`}
                aria-current={
                  item.slug === location.slug ? "page" : undefined
                }
                className={`rounded-full border px-5 py-3 text-[0.58rem] font-semibold uppercase tracking-[0.14em] transition ${
                  item.slug === location.slug
                    ? "border-[var(--helios-orange)] bg-[var(--helios-orange)] text-black"
                    : "border-white/10 text-white/42 hover:border-white/25 hover:text-white"
                }`}
              >
                {item.city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-shell py-24 text-center sm:py-32">
        <p className="eyebrow text-[var(--helios-orange)]">
          Ready when you are
        </p>
        <h2 className="mx-auto mt-6 max-w-4xl font-display text-[clamp(3rem,6vw,6.5rem)] font-light leading-[0.9] tracking-[-0.055em]">
          Let&apos;s give your next {location.city} listing the presentation it
          deserves.
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href={bookingHref} className="admin-btn-primary">
            Book your shoot
          </Link>
          <Link href="/contact" className="admin-btn-secondary">
            Talk with Helios
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

