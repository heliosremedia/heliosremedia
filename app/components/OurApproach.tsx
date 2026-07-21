"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import type { PublicSiteSettings } from "@/lib/site-settings";

const principles = [
  {
    number: "01",
    title: "Intentional",
    copy: "Every frame is composed with purpose—guiding attention, creating emotion, and revealing what makes the property exceptional.",
  },
  {
    number: "02",
    title: "Story Driven",
    copy: "Beautiful imagery earns attention. Thoughtful storytelling gives people a reason to remember the home.",
  },
  {
    number: "03",
    title: "Elevated Experience",
    copy: "From preparation through final delivery, every interaction reflects the same care and attention as the finished media.",
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function OurApproach({ settings }: { settings: PublicSiteSettings }) {
  const signatureRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const [activePrinciple, setActivePrinciple] = useState<number | null>(null);

  const { scrollYProgress: signatureProgress } = useScroll({
    target: signatureRef,
    offset: ["start 92%", "center 68%"],
  });

  const signatureColor = useTransform(
    signatureProgress,
    [0, 0.45, 1],
    ["rgba(255,255,255,0.28)", "rgba(255,255,255,0.6)", "rgba(255,255,255,1)"],
  );

  const signatureLetterSpacing = useTransform(
    signatureProgress,
    [0, 1],
    ["0.46em", "0.54em"],
  );

  const signatureLineOpacity = useTransform(
    signatureProgress,
    [0, 1],
    [0.2, 1],
  );

  return (
    <section
      id="our-approach"
      className="relative isolate -mt-px overflow-hidden bg-[#090909] text-white"
    >
      {/* Overlapping atmospheric handoff from Our Work */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[linear-gradient(to_bottom,#111111_0%,#101010_14%,#0e0e0e_38%,#0b0b0b_68%,#090909_100%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.018),transparent_72%)]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-72 top-[24rem] h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(circle,rgba(177,43,23,0.05)_0%,rgba(177,43,23,0.012)_42%,transparent_72%)] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-72 bottom-0 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(112,27,18,0.04)_0%,transparent_70%)] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[1440px] px-6 pb-32 pt-20 sm:px-8 sm:pb-36 sm:pt-24 lg:px-12 lg:pb-40 lg:pt-28 xl:px-16">
        <motion.header
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 28,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.95,
            ease,
          }}
          className="grid gap-10 lg:grid-cols-[0.92fr_1px_1.08fr] lg:items-center lg:gap-14 xl:gap-16"
        >
          <div className="lg:pr-6">
            <div className="flex items-center gap-5">
              <span className="h-px w-11 bg-[#f06b24]" />

              <span className="text-[0.67rem] font-medium uppercase tracking-[0.31em] text-[#f06b24] sm:text-xs">
                {settings.approachEyebrow || "Our Approach"}
              </span>
            </div>

            <p className="mt-6 max-w-[35rem] text-sm leading-7 text-white/56 sm:text-base sm:leading-8">
              {settings.approachBody || "Every listing is treated like a campaign. Every image, frame, and film is shaped to capture attention, create emotion, and elevate the way a property is perceived."}
            </p>
          </div>

          <span
            aria-hidden="true"
            className="hidden h-44 w-px bg-white/12 lg:block"
          />

          <h2 className="max-w-[46rem] font-serif text-[clamp(3.25rem,5.5vw,6.5rem)] font-normal leading-[0.88] tracking-[-0.055em] text-[#f3eee8]">
            {settings.approachHeadingLineOne || "We Build"}
            <span className="block italic text-white">{settings.approachHeadingLineTwo || "Perceived Value."}</span>
          </h2>
        </motion.header>

        <div className="mt-10 sm:mt-12 lg:mt-14">
          <div className="grid border-b border-white/10 lg:grid-cols-3">
            {principles.map((principle, index) => {
              const isActive = activePrinciple === index;

              return (
                <motion.article
                  key={principle.number}
                  initial={{
                    opacity: 0,
                    y: prefersReducedMotion ? 0 : 22,
                  }}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.85,
                    delay: prefersReducedMotion ? 0 : index * 0.08,
                    ease,
                  }}
                  onMouseEnter={() => setActivePrinciple(index)}
                  onMouseLeave={() => setActivePrinciple(null)}
                  onFocus={() => setActivePrinciple(index)}
                  onBlur={() => setActivePrinciple(null)}
                  tabIndex={0}
                  className={`group relative isolate min-h-[27rem] overflow-hidden border-white/10 px-7 py-10 outline-none sm:min-h-[28rem] sm:px-9 sm:py-12 lg:min-h-[29rem] lg:border-l lg:px-10 lg:py-14 first:lg:border-l-0 xl:px-12 ${
                    index > 0 ? "border-t lg:border-t-0" : ""
                  }`}
                >
                  <motion.div
                    aria-hidden="true"
                    animate={{
                      opacity: isActive ? 1 : 0,
                    }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.65,
                      ease,
                    }}
                    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_28%_46%,rgba(240,107,36,0.11),rgba(240,107,36,0.024)_40%,transparent_72%)]"
                  />

                  <motion.span
                    aria-hidden="true"
                    animate={{
                      opacity: isActive ? 1 : 0,
                      scaleY: isActive ? 1 : 0.2,
                    }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.55,
                      ease,
                    }}
                    className="absolute left-0 top-1/2 h-24 w-px -translate-y-1/2 origin-center bg-[#f06b24]"
                  />

                  <div className="flex h-full items-center">
                    <motion.div
                      animate={{
                        y: prefersReducedMotion || !isActive ? 0 : -5,
                      }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.5,
                        ease,
                      }}
                      className="w-full max-w-[26rem]"
                    >
                      <span
                        className={`block font-serif text-[1.4rem] leading-none transition-colors duration-500 ${
                          isActive ? "text-[#f06b24]" : "text-[#f06b24]/72"
                        }`}
                      >
                        {principle.number}
                      </span>

                      <div className="mt-9 min-h-[7.75rem] sm:min-h-[8.25rem]">
                        <h3
                          className={`max-w-[19rem] font-serif text-[clamp(2.5rem,3.45vw,4.15rem)] leading-[0.92] tracking-[-0.045em] transition-colors duration-500 ${
                            isActive ? "text-white" : "text-[#ece6df]"
                          }`}
                        >
                          {principle.title}
                        </h3>
                      </div>

                      <p
                        className={`mt-8 max-w-[25rem] text-sm leading-7 transition-colors duration-500 sm:text-base sm:leading-8 ${
                          isActive ? "text-white/74" : "text-white/56"
                        }`}
                      >
                        {principle.copy}
                      </p>
                    </motion.div>
                  </div>

                  <motion.span
                    aria-hidden="true"
                    animate={{
                      scaleX: isActive ? 1 : 0,
                    }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.75,
                      ease,
                    }}
                    className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-[#f06b24] via-[#f06b24]/35 to-transparent"
                  />
                </motion.article>
              );
            })}
          </div>
        </div>

        <motion.footer
          ref={signatureRef}
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 18,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.9,
            ease,
          }}
          className="relative z-10 pt-16 text-center sm:pt-20"
        >
          <motion.p
            style={
              prefersReducedMotion
                ? {
                    color: "rgba(255,255,255,0.72)",
                    letterSpacing: "0.5em",
                  }
                : {
                    color: signatureColor,
                    letterSpacing: signatureLetterSpacing,
                  }
            }
            className="text-[0.62rem] font-medium uppercase sm:text-[0.68rem]"
          >
            Light. Clarity. Vision.
          </motion.p>

          <motion.span
            aria-hidden="true"
            style={
              prefersReducedMotion
                ? { opacity: 0.7 }
                : { opacity: signatureLineOpacity }
            }
            className="mx-auto mt-7 block h-10 w-px bg-gradient-to-b from-[#f06b24] to-transparent sm:h-12"
          />

          <Link
            href="/about"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 px-6 text-[0.56rem] font-semibold uppercase tracking-[0.17em] text-white/45 transition hover:border-white/30 hover:text-white"
          >
            Discover Helios
          </Link>
        </motion.footer>
      </div>
    </section>
  );
}
