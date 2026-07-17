"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

const logos = Array.from({ length: 9 }, (_, index) => ({
  src: `/trusted-by/trusted-by-logo-${index + 1}.avif`,
  alt: `Helios trusted real estate partner ${index + 1}`,
}));

const marqueeLogos = [...logos, ...logos];

export default function TrustedBy() {
  const shouldReduceMotion = useReducedMotion();

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
                  key={`${logo.src}-${index}`}
                  aria-hidden={isDuplicate ? true : undefined}
                  className="group flex h-24 w-[13.5rem] shrink-0 items-center justify-center px-7 sm:h-28 sm:w-[16rem] sm:px-9 lg:h-32 lg:w-[18rem] lg:px-11"
                >
                  <div className="relative h-[4.25rem] w-full sm:h-[4.75rem] lg:h-[5.25rem]">
                    <Image
                      src={logo.src}
                      alt={isDuplicate ? "" : logo.alt}
                      fill
                      sizes="288px"
                      className="object-contain grayscale opacity-[0.68] transition-[opacity,filter,transform] duration-700 ease-out group-hover:scale-[1.02] group-hover:grayscale-0 group-hover:opacity-95"
                    />
                  </div>
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