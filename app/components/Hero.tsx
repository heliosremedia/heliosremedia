"use client";

import { motion, useReducedMotion } from "motion/react";

const reveal = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[var(--background)]">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/media/hero-video.mp4" type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-0 bg-black/25" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-black/5" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(20rem,46vh,36rem)]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15, 15, 16, 0) 0%, rgba(15, 15, 16, 0.14) 24%, rgba(15, 15, 16, 0.52) 54%, rgba(15, 15, 16, 0.9) 82%, var(--background) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-2 bg-[var(--background)]" />

      <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-soft-light" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl items-center px-6 pb-24 pt-48 md:px-10 md:pt-52 lg:px-16">
        <div className="max-w-3xl translate-y-5">
          <motion.h1
            className="font-display text-[clamp(4rem,7.2vw,7rem)] font-light leading-[0.84] tracking-[-0.045em] text-[var(--foreground)]"
            variants={reveal}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.9,
              delay: shouldReduceMotion ? 0 : 0.55,
              ease,
            }}
          >
            <span className="block">Luxury Marketing</span>
            <span className="block">for Exceptional Homes</span>
          </motion.h1>

          <motion.div
            className="mt-10 h-px bg-[var(--helios-orange)]"
            initial={
              shouldReduceMotion
                ? false
                : {
                    width: 0,
                    opacity: 0,
                  }
            }
            animate={{
              width: 104,
              opacity: 1,
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 0.95,
              ease,
            }}
          />

          <motion.p
            className="mt-8 max-w-2xl text-base leading-8 text-[var(--helios-muted)] md:text-lg"
            variants={reveal}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 1.1,
              ease,
            }}
          >
            Photography, cinematic films, aerial imagery, and branding crafted
            to elevate Northern Colorado&apos;s most exceptional homes.
          </motion.p>

          <motion.div
            className="mt-11 flex flex-wrap gap-5"
            variants={reveal}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 1.28,
              ease,
            }}
          >
            <motion.a
              href="#booking"
              className="flex min-h-14 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-10 text-xs font-semibold uppercase tracking-[0.23em] text-white shadow-[0_12px_35px_rgba(0,0,0,0.25)]"
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: -4,
                      scale: 1.015,
                      backgroundColor: "#ed7a3c",
                      boxShadow: "0 18px 48px rgba(217,107,43,0.44)",
                    }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
              }}
            >
              Book Now
            </motion.a>

            <motion.a
              href="#work"
              className="flex min-h-14 items-center justify-center rounded-[3px] border border-white/40 bg-black/10 px-10 text-xs font-semibold uppercase tracking-[0.23em] text-white backdrop-blur-sm"
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: -4,
                      scale: 1.015,
                      color: "#0f0f10",
                      backgroundColor: "#f5f1ea",
                      borderColor: "#f5f1ea",
                      boxShadow: "0 18px 44px rgba(0,0,0,0.3)",
                    }
              }
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
              }}
            >
              View Portfolio
            </motion.a>
          </motion.div>
        </div>
      </div>

      <motion.a
        href="#standard"
        aria-label="Scroll to the Helios Standard"
        className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2 text-center"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.8,
          delay: shouldReduceMotion ? 0 : 1.75,
        }}
      >
        <span className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.38em] text-white/65">
          Scroll
        </span>

        <motion.span
          className="block text-3xl font-light text-[var(--helios-orange)]"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: [0, 8, 0],
                }
          }
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ↓
        </motion.span>
      </motion.a>
    </section>
  );
}