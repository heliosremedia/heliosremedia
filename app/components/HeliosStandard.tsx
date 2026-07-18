"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const principles = [
  {
    number: "01",
    title: "Intentional",
    description:
      "Every frame is composed with purpose—guiding attention, creating emotion, and revealing what makes the property exceptional.",
  },
  {
    number: "02",
    title: "Authentic",
    description:
      "Natural light, honest color, and thoughtful storytelling preserve the character of the home while presenting it at its best.",
  },
  {
    number: "03",
    title: "Cinematic",
    description:
      "Measured movement and refined pacing transform a listing into an experience that feels immersive, elevated, and memorable.",
  },
  {
    number: "04",
    title: "Elevated",
    description:
      "Every deliverable is designed to strengthen perception, support the agent’s brand, and communicate value before the first showing.",
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

const wordVariants = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
  },
};

export default function HeliosStandard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="standard"
      className="relative -mt-px bg-[var(--background)]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-18rem] top-[-10rem] h-[36rem] w-[36rem] rounded-full bg-[rgba(217,107,43,0.04)] blur-[160px]" />

        <div className="absolute bottom-[-16rem] left-[-20rem] h-[36rem] w-[36rem] rounded-full bg-white/[0.018] blur-[160px]" />

        <div className="hero-grain absolute inset-0 opacity-[0.018] mix-blend-soft-light" />
      </div>

      <div className="relative z-10 pb-[clamp(4.5rem,7vw,6.5rem)] pt-[clamp(5rem,9vw,8rem)]">
        <div className="mx-auto w-full max-w-[68rem] px-6 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1px_1.1fr] lg:items-center lg:gap-14">
            <motion.div
              className="max-w-[23rem]"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 22,
                    }
              }
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
                amount: 0.45,
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.85,
                ease,
              }}
            >
              <div className="flex items-center gap-4">
                <span className="h-px w-10 bg-[var(--helios-orange)]" />

                <span className="eyebrow text-[var(--helios-orange)]">
                  The Helios Standard
                </span>
              </div>

              <p className="mt-7 text-sm leading-7 text-white/48 md:text-[0.95rem]">
                Exceptional homes deserve more than documentation. They deserve
                a presentation that shapes how they are seen, remembered, and
                valued.
              </p>
            </motion.div>

            <motion.div
              aria-hidden="true"
              className="hidden h-40 w-px origin-center bg-white/[0.12] lg:block"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      scaleY: 0,
                    }
              }
              whileInView={{
                opacity: 1,
                scaleY: 1,
              }}
              viewport={{
                once: true,
                amount: 0.4,
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.9,
                delay: shouldReduceMotion ? 0 : 0.12,
                ease,
              }}
            />

            <motion.h2
              className="max-w-[34rem] font-display text-[clamp(3rem,4.6vw,5rem)] font-light leading-[0.92] tracking-[-0.045em]"
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.3,
              }}
            >
              <motion.span
                className="block text-[var(--foreground)]"
                variants={wordVariants}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.9,
                  ease,
                }}
              >
                Presentation
              </motion.span>

              <motion.span
                className="block text-white/80"
                variants={wordVariants}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.9,
                  delay: shouldReduceMotion ? 0 : 0.12,
                  ease,
                }}
              >
                Changes
              </motion.span>

              <motion.span
                className="block italic text-[var(--helios-orange)]"
                variants={wordVariants}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.9,
                  delay: shouldReduceMotion ? 0 : 0.24,
                  ease,
                }}
              >
                Perception.
              </motion.span>
            </motion.h2>
          </div>
        </div>

        <motion.div
          className="mx-auto mt-[clamp(5rem,8vw,7rem)] w-full max-w-[76rem] px-5 sm:px-8 lg:px-10"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 30,
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{
            once: true,
            amount: 0.18,
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.9,
            ease,
          }}
        >
          <div className="relative overflow-hidden rounded-[4px] bg-black shadow-[0_28px_85px_rgba(0,0,0,0.34)]">
            <div className="relative aspect-[16/9] sm:aspect-[2/1] lg:aspect-[2.35/1]">
              <Image
                src="/standard/standard-8.jpg"
                alt="Luxury interior photographed by Helios Real Estate Media"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 94vw, 1216px"
                className="object-cover object-[center_40%]"
              />

              <div className="pointer-events-none absolute inset-0 bg-black/20" />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/42" />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10" />

              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

              <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-soft-light" />
            </div>
          </div>
        </motion.div>

        <div className="container-shell mt-[clamp(1.5rem,2.5vw,2.25rem)]">
          <div className="grid overflow-hidden rounded-[4px] border border-white/[0.12] lg:grid-cols-4">
            {principles.map((principle, index) => {
              const hasDivider = index < principles.length - 1;

              return (
                <motion.article
                  key={principle.title}
                  className={`group relative px-7 py-9 sm:px-9 sm:py-10 lg:min-h-[15.5rem] lg:px-7 lg:py-11 xl:px-9 ${
                    hasDivider
                      ? "border-b border-white/[0.12] lg:border-b-0 lg:border-r"
                      : ""
                  }`}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 24,
                        }
                  }
                  whileInView={{
                    opacity: 1,
                    y: 0,
                  }}
                  viewport={{
                    once: true,
                    amount: 0.35,
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.75,
                    delay: shouldReduceMotion ? 0 : index * 0.08,
                    ease,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 origin-bottom scale-y-0 bg-white/[0.018] transition-transform duration-700 ease-[var(--ease-luxury)] group-hover:scale-y-100" />

                  <div className="relative z-10 flex items-baseline gap-5">
                    <span className="text-sm font-medium tracking-[0.06em] text-[var(--helios-orange)]">
                      {principle.number}
                    </span>

                    <h3 className="font-display text-[clamp(2rem,2.5vw,2.75rem)] font-light leading-none tracking-[-0.032em] text-[var(--foreground)] transition-transform duration-700 ease-[var(--ease-luxury)] group-hover:translate-x-1">
                      {principle.title}
                    </h3>
                  </div>

                  <p className="relative z-10 mt-7 max-w-[17rem] text-sm leading-7 text-white/46 transition-colors duration-700 group-hover:text-white/64">
                    {principle.description}
                  </p>

                  <span className="absolute bottom-0 left-0 z-10 h-px w-0 bg-[var(--helios-orange)] transition-all duration-700 ease-[var(--ease-luxury)] group-hover:w-full" />
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
