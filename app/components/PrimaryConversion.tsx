"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useSiteSettings } from "./SiteSettingsProvider";
import type { PublicCta } from "@/lib/ctas";

const ease = [0.22, 1, 0.36, 1] as const;

function resolveAction(type: PublicCta["primaryActionType"] | null, value: string | null, settings: ReturnType<typeof useSiteSettings>) {
  if (type === "BOOKING") return settings.bookingUrl || "/inquire";
  if (type === "PHONE") return `tel:${settings.phoneE164}`;
  if (type === "EMAIL") return value ? `mailto:${value}` : settings.email ? `mailto:${settings.email}` : `tel:${settings.phoneE164}`;
  return value || "#";
}

export default function PrimaryConversion({ cta }: { cta: PublicCta }) {
  const settings = useSiteSettings();
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="book"
      aria-labelledby="primary-conversion-heading"
      className="relative isolate overflow-hidden bg-[#080808] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
      />

      <div className="relative mx-auto max-w-[1600px]">
        <div className="grid min-h-[43rem] lg:grid-cols-[minmax(0,1.55fr)_minmax(26rem,0.78fr)]">
          <motion.div
            initial={{
              opacity: 0,
              scale: prefersReducedMotion ? 1 : 1.025,
            }}
            whileInView={{
              opacity: 1,
              scale: 1,
            }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 1.35,
              ease,
            }}
            className="relative min-h-[28rem] overflow-hidden sm:min-h-[35rem] lg:min-h-[43rem]"
          >
            <Image
              src="/standard/standard-16.jpg"
              alt="Architectural living room photographed by Helios Real Estate Media"
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover object-[48%_54%]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-black/18"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080808]/68 via-black/[0.04] to-black/10 lg:bg-gradient-to-r lg:from-black/10 lg:via-black/[0.08] lg:to-[#080808]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38%] bg-gradient-to-r from-transparent via-[#080808]/62 to-[#080808] lg:block"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-[#080808]/82 lg:hidden"
            />

            <motion.p
              initial={{
                opacity: 0,
                y: prefersReducedMotion ? 0 : 12,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.85,
                delay: prefersReducedMotion ? 0 : 0.3,
                ease,
              }}
              className="absolute bottom-7 left-6 z-10 max-w-[18rem] text-[0.52rem] font-medium uppercase tracking-[0.34em] text-white/38 sm:bottom-9 sm:left-8 lg:bottom-10 lg:left-12 xl:left-16"
            >
              Presentation shapes perception.
            </motion.p>
          </motion.div>

          <div className="relative flex items-center px-6 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-20 xl:px-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 hidden h-[72%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-white/[0.1] to-transparent lg:block"
            />

            <motion.div
              initial={{
                opacity: 0,
                x: prefersReducedMotion ? 0 : 24,
              }}
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 1,
                delay: prefersReducedMotion ? 0 : 0.12,
                ease,
              }}
              className="w-full max-w-[32rem]"
            >
              <h2
                id="primary-conversion-heading"
                className="font-serif text-[clamp(2.85rem,4.35vw,4.85rem)] leading-[0.93] tracking-[-0.048em] text-[#f2ede7]"
              >
                {cta.headline}
              </h2>

              <p className="mt-12 max-w-[28rem] text-[0.97rem] leading-[1.85] text-white/62 sm:mt-14 sm:text-[1.05rem]">
                {cta.body}
              </p>

              <Link
                href={resolveAction(cta.primaryActionType, cta.primaryValue, settings)}
                className="group mt-12 flex min-h-[4.75rem] w-full items-center justify-between border border-[#f06b24] px-7 transition-all duration-500 hover:bg-[#f06b24] focus-visible:bg-[#f06b24] focus-visible:outline-none sm:mt-14 sm:px-8"
              >
                <span className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-white">
                  {cta.primaryLabel}
                </span>

                <span
                  aria-hidden="true"
                  className="text-xl text-[#f06b24] transition-all duration-500 group-hover:translate-x-1.5 group-hover:text-white"
                >
                  →
                </span>
              </Link>

              {cta.secondaryLabel && cta.secondaryActionType && <Link
                href={resolveAction(cta.secondaryActionType, cta.secondaryValue, settings)}
                className="group mt-7 inline-flex items-center gap-4 text-[0.57rem] font-medium uppercase tracking-[0.28em] text-white/32 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
              >
                {cta.secondaryLabel}
                <span
                  aria-hidden="true"
                  className="h-px w-8 bg-white/16 transition-all duration-500 group-hover:w-12 group-hover:bg-[#f06b24]"
                />
              </Link>}

              <div className="mt-12 border-t border-white/[0.08] pt-7">
                <p className="text-[0.56rem] font-medium uppercase leading-[1.9] tracking-[0.25em] text-white/27">
                  Photography
                  <span className="mx-2 text-[#f06b24]">•</span>
                  Cinematic Film
                  <span className="mx-2 text-[#f06b24]">•</span>
                  Drone
                  <span className="mx-2 text-[#f06b24]">•</span>
                  Floor Plans
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#070707]"
      />
    </section>
  );
}
