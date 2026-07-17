"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

const exploreLinks = [
  { label: "Our Work", href: "/portfolio" },
  { label: "Services", href: "/services" },
  { label: "About Helios", href: "/about" },
  { label: "Client Stories", href: "/#testimonials" },
];

const connectLinks = [
  { label: "Book Your Shoot", href: "tel:+19706825533" },
  { label: "Call 970.682.5533", href: "tel:+19706825533" },
];

export default function Footer() {
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
              <span
                id="footer-heading"
                className="font-helios block text-[clamp(5.25rem,9vw,8rem)] font-normal leading-[0.9] tracking-[0.035em] text-[var(--helios-orange)] transition-colors duration-500 group-hover:text-[var(--helios-orange-hover)]"
              >
                HELIOS
              </span>

              <span className="mt-2 ml-[0.12em] block text-[0.88rem] font-medium uppercase tracking-[0.42em] text-white/60">
                Real Estate Media
              </span>
            </Link>

            <p className="mt-8 max-w-[31rem] font-serif text-[clamp(1.55rem,2.4vw,2.5rem)] leading-[1.08] tracking-[-0.035em] text-white/72">
              Presentation shapes perception.
            </p>

            <p className="mt-6 max-w-[31rem] text-[0.94rem] leading-[1.8] text-white/38 sm:text-[1rem]">
              Photography, cinematic film, aerial media, and marketing content
              created for real estate professionals across Northern Colorado.
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
                  href="tel:+19706825533"
                  className="mt-4 inline-block whitespace-nowrap font-serif text-[clamp(1.7rem,2.25vw,2.4rem)] leading-none tracking-[-0.03em] text-[#f2ede7] transition-colors duration-300 hover:text-[#f06b24] focus-visible:outline-none focus-visible:text-[#f06b24]"
                >
                  970.682.5533
                </a>

                <p className="mt-5 whitespace-nowrap text-[0.55rem] font-medium uppercase tracking-[0.25em] text-white/28">
                  Fort Collins, Colorado
                </p>
              </div>
            </nav>
          </div>
        </div>

        <div className="mt-20 border-t border-white/[0.08] pt-7 sm:mt-24">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[52rem] text-[0.53rem] uppercase leading-[1.9] tracking-[0.2em] text-white/20">
              Serving Fort Collins, Loveland, Windsor, Timnath, Greeley,
              Wellington, Berthoud, Boulder, and surrounding Northern Colorado
              communities.
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
