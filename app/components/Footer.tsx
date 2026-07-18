"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useSiteSettings } from "./SiteSettingsProvider";

const ease = [0.22, 1, 0.36, 1] as const;

const exploreLinks = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Services", href: "/services" },
  { label: "About Helios", href: "/about" },
  { label: "FAQs", href: "/faq" },
  { label: "Client Stories", href: "/#testimonials" },
];

export default function Footer() {
  const settings = useSiteSettings();
  const bookingHref = settings.bookingUrl || "/inquire";
  const connectLinks = [
    { label: "Book Your Shoot", href: bookingHref },
    { label: `Call ${settings.phoneDisplay}`, href: `tel:${settings.phoneE164}` },
    ...(settings.email ? [{ label: "Email Helios", href: `mailto:${settings.email}` }] : []),
  ];
  const prefersReducedMotion = useReducedMotion();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      aria-labelledby="footer-heading"
      className="relative overflow-hidden bg-[#070707] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
      />

      <motion.div
        initial={{
          opacity: 0,
          y: prefersReducedMotion ? 0 : 18,
        }}
        whileInView={{
          opacity: 1,
          y: 0,
        }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 1.05,
          ease,
        }}
        className="mx-auto max-w-[1500px] px-6 pb-8 pt-20 sm:px-8 sm:pb-10 sm:pt-24 lg:px-12 lg:pt-28 xl:px-16"
      >
        <div className="grid gap-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.75fr)] lg:gap-24 xl:gap-32">
          <div>
            <Link
              href="/"
              aria-label="Helios Real Estate Media home"
              className="group inline-block focus-visible:outline-none"
            >
              <Image
                id="footer-heading"
                src={settings.brandLogoUrl || "/brand/helios-logo.png"}
                alt={settings.brandLogoAlt || settings.businessName}
                width={520}
                height={180}
                unoptimized={Boolean(settings.brandLogoUrl?.startsWith("http"))}
                className="h-auto w-[clamp(17rem,28vw,22rem)] transition-opacity duration-500 group-hover:opacity-80"
              />
            </Link>

            <p className="mt-8 max-w-[31rem] font-serif text-[clamp(1.55rem,2.4vw,2.5rem)] leading-[1.08] tracking-[-0.035em] text-white/72">
              Presentation shapes perception.
            </p>

            <p className="mt-6 max-w-[31rem] text-[0.94rem] leading-[1.8] text-white/38 sm:text-[1rem]">
              {settings.footerDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-[1fr_1fr] lg:gap-14">
            <nav aria-label="Explore Helios">
              <p className="text-[0.57rem] font-medium uppercase tracking-[0.34em] text-[#f06b24]">
                Explore
              </p>

              <ul className="mt-7 space-y-4">
                {exploreLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-white/42 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
                    >
                      <span>{link.label}</span>

                      <span
                        aria-hidden="true"
                        className="h-px w-0 bg-[#f06b24] transition-all duration-500 group-hover:w-5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Connect with Helios">
              <p className="text-[0.57rem] font-medium uppercase tracking-[0.34em] text-[#f06b24]">
                Connect
              </p>

              <ul className="mt-7 space-y-4">
                {connectLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-white/42 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
                    >
                      <span>{link.label}</span>

                      <span
                        aria-hidden="true"
                        className="h-px w-0 bg-[#f06b24] transition-all duration-500 group-hover:w-5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-10 border-t border-white/[0.08] pt-7">
                <p className="text-[0.53rem] font-medium uppercase tracking-[0.29em] text-white/24">
                  Call or Text
                </p>

                <a
                  href={`tel:${settings.phoneE164}`}
                  className="mt-4 inline-block whitespace-nowrap font-serif text-[clamp(1.7rem,2.25vw,2.4rem)] leading-none tracking-[-0.03em] text-[#f2ede7] transition-colors duration-300 hover:text-[#f06b24] focus-visible:outline-none focus-visible:text-[#f06b24]"
                >
                  {settings.phoneDisplay}
                </a>

                <p className="mt-8 whitespace-nowrap text-[0.55rem] font-medium uppercase tracking-[0.25em] text-white/28">
                  {settings.locationLabel}
                </p>
              </div>
            </nav>
          </div>
        </div>

        <div className="mt-20 border-t border-white/[0.08] pt-7 sm:mt-24">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[52rem] text-[0.53rem] uppercase leading-[1.9] tracking-[0.2em] text-white/20">
              {settings.serviceAreaDescription}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <p className="text-[0.53rem] uppercase tracking-[0.21em] text-white/20">
                © {currentYear} Helios Real Estate Media LLC
              </p>

              <Link
                href="/privacy"
                className="text-[0.53rem] uppercase tracking-[0.21em] text-white/20 transition-colors duration-300 hover:text-white/60 focus-visible:outline-none focus-visible:text-white/60"
              >
                Privacy
              </Link>

              <Link
                href="/terms"
                className="text-[0.53rem] uppercase tracking-[0.21em] text-white/20 transition-colors duration-300 hover:text-white/60 focus-visible:outline-none focus-visible:text-white/60"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
