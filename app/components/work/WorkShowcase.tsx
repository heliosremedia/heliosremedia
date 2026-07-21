"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import WorkCard from "./WorkCard";
import { portfolioItems } from "./portfolio";
import type { PublicSiteSettings } from "@/lib/site-settings";

const ease = [0.22, 1, 0.36, 1] as const;

type FeaturedFilm = { enabled: boolean; videoSrc: string | null; poster: string | null; href: string | null };

export default function WorkShowcase({ items = portfolioItems, featuredFilm, featuredProject, settings }: { items?: typeof portfolioItems; featuredFilm?: FeaturedFilm; featuredProject?: (typeof portfolioItems)[number] | null; settings: PublicSiteSettings }) {
  const shouldReduceMotion = useReducedMotion();
  const displayItems = featuredFilm?.enabled && featuredFilm.videoSrc
    ? [{ ...items[0], title: "Cinematic Films", href: featuredFilm.href || "/portfolio?service=cinematic-films", image: featuredFilm.poster || portfolioItems[0].image }, ...items.slice(1)]
    : items;

  return (
    <section
      id="work"
      className="relative overflow-hidden bg-[var(--background)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-[-18rem] top-[10rem] h-[34rem] w-[34rem] rounded-full bg-[rgba(217,107,43,0.035)] blur-[160px]" />

        <div className="absolute bottom-[-18rem] left-[-18rem] h-[34rem] w-[34rem] rounded-full bg-white/[0.015] blur-[160px]" />

        <div className="hero-grain absolute inset-0 opacity-[0.018] mix-blend-soft-light" />
      </div>

      <div className="relative z-10 pb-[clamp(7rem,9vw,9.5rem)] pt-[clamp(7rem,10vw,9rem)]">
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
              <span className="block text-[var(--foreground)]">{settings.workHeadingLineOne || "Crafted to"}</span>

              <span className="block text-white/80">{settings.workHeadingLineTwo || "Capture"}</span>

              <span className="block italic text-[var(--helios-orange)]">
                {settings.workHeadingAccent || "Attention."}
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
                  {settings.workEyebrow || "Our Work"}
                </span>
              </div>

              <p className="mt-7 text-sm leading-7 text-white/48 md:text-[0.95rem]">
                {settings.workBody || "Every image, every frame, and every film is crafted to elevate perception, command attention, and inspire confidence before the first showing."}
              </p>

              <Link
                href={settings.workButtonDestination || "/portfolio"}
                className="group mt-8 inline-flex flex-col items-start"
              >
                <span className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-white transition-opacity duration-500 group-hover:opacity-70">
                  {settings.workButtonLabel || "Explore Portfolio"}

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

        {featuredProject ? <motion.div
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
          <div className="mb-5 flex items-center gap-4"><span className="h-px w-10 bg-[var(--helios-orange)]" /><span className="eyebrow text-[var(--helios-orange)]">{settings.featuredProjectEyebrow || "Featured Project"}</span></div>
          <WorkCard
            {...featuredProject}
            priority
            className="h-[clamp(28rem,56vw,42rem)] rounded-[4px]"
          />
        </motion.div> : null}

        <motion.div
          className={`mx-auto w-full max-w-[76rem] px-5 sm:px-8 lg:px-10 ${featuredProject ? "mt-[clamp(2.5rem,4vw,4rem)]" : "mt-[clamp(4rem,7vw,6rem)]"}`}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.14 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.9, ease }}
        >
          <WorkCard
            {...displayItems[0]}
            videoSrc={displayItems[0].videoSrc || (featuredFilm?.enabled ? featuredFilm.videoSrc : null)}
            priority={!featuredProject}
            className="h-[clamp(28rem,56vw,42rem)] rounded-[4px]"
          />
        </motion.div>

        <div className="mx-auto mt-[clamp(1.5rem,2.5vw,2.25rem)] w-full max-w-[76rem] px-5 sm:px-8 lg:px-10">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {displayItems.slice(1).map((item, index) => (
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
            {settings.portfolioEyebrow || "Complete Portfolio"}
          </span>

          <h3 className="mt-5 font-display text-[clamp(2.6rem,4.4vw,4.15rem)] font-light leading-[0.96] tracking-[-0.04em] text-[var(--foreground)]">
            {settings.portfolioHeading || "Explore the Full Collection."}
          </h3>

          <Link
            href={settings.portfolioButtonDestination || "/portfolio"}
            className="group mt-8 inline-flex flex-col items-center"
          >
            <span className="flex items-center gap-4 text-[0.68rem] font-medium uppercase tracking-[0.3em] text-white/78 transition-colors duration-500 group-hover:text-white">
              {settings.portfolioButtonLabel || "View Complete Portfolio"}

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
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[20rem]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(16,16,16,0.12)_20%,rgba(16,16,16,0.34)_46%,rgba(17,17,17,0.72)_76%,#111111_100%)]" />

        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.014),transparent_72%)]" />

        <div className="hero-grain absolute inset-0 opacity-[0.012] mix-blend-soft-light" />
      </div>
    </section>
  );
}
