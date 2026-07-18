"use client";

import { motion, useReducedMotion } from "motion/react";

import TrustedLogoArtwork from "./TrustedLogoArtwork";

const ease = [0.22, 1, 0.36, 1] as const;

export type TrustedLogoItem = {
  id: string;
  organizationName: string;
  src: string;
  alt: string;
  websiteUrl: string | null;
  monochrome: boolean;
  displayColor: string;
  displayOpacity: number;
  displayScale: number;
};

export default function TrustedBy({ logos }: { logos: TrustedLogoItem[] }) {
  const shouldReduceMotion = useReducedMotion();
  const marqueeLogos = [...logos, ...logos];

  if (logos.length === 0) return null;

  return (
    <section
      aria-labelledby="trusted-by-heading"
      className="relative -mt-32 overflow-hidden bg-[var(--background)] pb-20 pt-16 sm:-mt-36 sm:pb-24 sm:pt-20 lg:-mt-40 lg:pb-28 lg:pt-24"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-transparent via-[var(--background)]/70 to-[var(--background)] sm:h-48 lg:h-56" />

      <div className="relative mx-auto w-full max-w-[1800px]">
        <motion.div
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 14,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.65,
          }}
          transition={{
            duration: 0.9,
            ease,
          }}
          className="px-6 text-center sm:px-10 lg:px-16"
        >
          <p
            id="trusted-by-heading"
            className="text-[0.64rem] font-medium uppercase tracking-[0.34em] text-white/50 sm:text-[0.7rem] lg:text-[0.72rem]"
          >
            Trusted by Northern Colorado&apos;s Leading Professionals
          </p>
        </motion.div>

        <div className="relative mt-9 overflow-hidden sm:mt-11 lg:mt-12">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/80 to-transparent sm:w-36 lg:w-56" />

          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[var(--background)] via-[var(--background)]/80 to-transparent sm:w-36 lg:w-56" />

          <motion.div
            className="flex w-max items-center"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    x: ["0%", "-50%"],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 72,
                    ease: "linear",
                    repeat: Infinity,
                  }
            }
          >
            {marqueeLogos.map((logo, index) => {
              const isDuplicate = index >= logos.length;

              return (
                <div
                  key={`${logo.id}-${index}`}
                  aria-hidden={isDuplicate ? true : undefined}
                  className="group flex h-24 w-[13.5rem] shrink-0 items-center justify-center px-7 sm:h-28 sm:w-[16rem] sm:px-9 lg:h-32 lg:w-[18rem] lg:px-11"
                >
                  {logo.websiteUrl && !isDuplicate ? (
                    <a href={logo.websiteUrl} target="_blank" rel="noreferrer" aria-label={`Visit ${logo.organizationName}`} className="relative flex h-[4.25rem] w-full items-center justify-center sm:h-[4.75rem] lg:h-[5.25rem]">
                      <TrustedLogoArtwork src={logo.src} alt={logo.alt} monochrome={logo.monochrome} color={logo.displayColor} opacity={logo.displayOpacity} scale={logo.displayScale} className="transition-opacity duration-700 group-hover:opacity-100" />
                    </a>
                  ) : (
                    <div className="relative flex h-[4.25rem] w-full items-center justify-center sm:h-[4.75rem] lg:h-[5.25rem]">
                      <TrustedLogoArtwork src={logo.src} alt={logo.alt} decorative={isDuplicate} monochrome={logo.monochrome} color={logo.displayColor} opacity={logo.displayOpacity} scale={logo.displayScale} className="transition-opacity duration-700 group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--background)]" />
    </section>
  );
}
