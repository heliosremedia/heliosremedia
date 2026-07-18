"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import WorkCard from "./WorkCard";
import { portfolioItems } from "./portfolio";

const ease = [0.22, 1, 0.36, 1] as const;

export default function WorkShowcase({ items = portfolioItems }: { items?: typeof portfolioItems }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="work"
      className="relative overflow-hidden bg-[var(--background)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[24rem] bg-gradient-to-b from-[rgba(10,10,10,0.88)] via-[var(--background)] to-[var(--background)]" />

        <div className="absolute right-[-18rem] top-[10rem] h-[34rem] w-[34rem] rounded-full bg-[rgba(217,107,43,0.035)] blur-[160px]" />

        <div className="absolute bottom-[-18rem] left-[-18rem] h-[34rem] w-[34rem] rounded-full bg-white/[0.015] blur-[160px]" />

        <div className="hero-grain absolute inset-0 opacity-[0.018] mix-blend-soft-light" />
      </div>

      <div className="relative z-10 pb-[clamp(10rem,14vw,14rem)] pt-[clamp(8rem,12vw,11rem)]">
        <div className="mx-auto w-full max-w-[68rem] px-6 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1px_0.9fr] lg:items-center lg:gap-14">
            <motion.h2
              className="max-w-[34rem] font-display text-[clamp(3rem,4.6vw,5rem)] font-light leading-[0.92] tracking-[-0.045em]"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 28,
                      filter: "blur(8px)",
                    }
              }
              whileInView={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
              }}
              viewport={{
                once: true,
                amount: 0.35,
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.9,
                ease,
              }}
            >
              <span className="block text-[var(--foreground)]">Crafted to</span>

              <span className="block text-white/80">Capture</span>

              <span className="block italic text-[var(--helios-orange)]">
                Attention.
              </span>
            </motion.h2>

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
                delay: shouldReduceMotion ? 0 : 0.08,
                ease,
              }}
            >
              <div className="flex items-center gap-4">
                <span className="h-px w-10 bg-[var(--helios-orange)]" />

                <span className="eyebrow text-[var(--helios-orange)]">
                  Our Work
                </span>
              </div>

              <p className="mt-7 text-sm leading-7 text-white/48 md:text-[0.95rem]">
                Every image, every frame, and every film is crafted to elevate
                perception, command attention, and inspire confidence before
                the first showing.
              </p>

              <Link
                href="/portfolio"
                className="group mt-8 inline-flex flex-col items-start"
              >
                <span className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-white transition-opacity duration-500 group-hover:opacity-70">
                  Explore Portfolio

                  <span
                    aria-hidden="true"
                    className="transition-transform duration-500 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>

                <span className="mt-3 h-px w-0 bg-[var(--helios-orange)] transition-all duration-700 ease-[var(--ease-luxury)] group-hover:w-[55%]" />
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="mx-auto mt-[clamp(4rem,7vw,6rem)] w-full max-w-[76rem] px-5 sm:px-8 lg:px-10"
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
            amount: 0.14,
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.9,
            ease,
          }}
        >
          <WorkCard
            {...items[0]}
            priority
            className="h-[clamp(28rem,56vw,42rem)] rounded-[4px]"
          />
        </motion.div>

        <div className="mx-auto mt-[clamp(1.5rem,2.5vw,2.25rem)] w-full max-w-[76rem] px-5 sm:px-8 lg:px-10">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {items.slice(1).map((item, index) => (
              <motion.div
                key={item.title}
                className="relative"
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
                  amount: 0.2,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.75,
                  delay: shouldReduceMotion ? 0 : index * 0.08,
                  ease,
                }}
              >
                <WorkCard
                  {...item}
                  className="h-[25rem] rounded-[4px] sm:h-[27rem] xl:h-[25rem]"
                />
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mx-auto mt-[clamp(4rem,6vw,5.5rem)] max-w-[62rem] px-6 text-center sm:px-8 lg:px-10"
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
            amount: 0.35,
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.85,
            ease,
          }}
        >
          <span className="eyebrow text-[var(--helios-orange)]">
            Complete Portfolio
          </span>

          <h3 className="mt-5 font-display text-[clamp(2.6rem,4.4vw,4.15rem)] font-light leading-[0.96] tracking-[-0.04em] text-[var(--foreground)]">
            Explore the Full Collection.
          </h3>

          <Link
            href="/portfolio"
            className="group mt-8 inline-flex flex-col items-center"
          >
            <span className="flex items-center gap-4 text-[0.68rem] font-medium uppercase tracking-[0.3em] text-white/78 transition-colors duration-500 group-hover:text-white">
              View Complete Portfolio

              <span
                aria-hidden="true"
                className="transition-transform duration-500 ease-[var(--ease-luxury)] group-hover:translate-x-1"
              >
                →
              </span>
            </span>

            <span className="mt-3 h-px w-full origin-center scale-x-[0.55] bg-white/20 transition-all duration-700 ease-[var(--ease-luxury)] group-hover:scale-x-100 group-hover:bg-[var(--helios-orange)]" />
          </Link>
        </motion.div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[30rem]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(16,16,16,0.12)_20%,rgba(16,16,16,0.34)_46%,rgba(17,17,17,0.72)_76%,#111111_100%)]" />

        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.014),transparent_72%)]" />

        <div className="hero-grain absolute inset-0 opacity-[0.012] mix-blend-soft-light" />
      </div>
    </section>
  );
}
