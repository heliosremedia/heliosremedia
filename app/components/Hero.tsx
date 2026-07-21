"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { PublicSiteSettings } from "@/lib/site-settings";

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function Hero({ settings }: { settings: PublicSiteSettings }) {
  const bookingHref = settings.heroPrimaryDestination || settings.bookingUrl || "/inquire";
  const shouldReduceMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);
  const poster = settings.heroPosterUrl || undefined;
  const posterAlt = settings.heroPosterAlt?.trim() || "";

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[var(--background)]">
      {poster ? (
        <div
          aria-hidden={posterAlt ? undefined : true}
          aria-label={posterAlt || undefined}
          role={posterAlt ? "img" : undefined}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${JSON.stringify(poster)})` }}
        />
      ) : null}

      {settings.heroVideoUrl && !shouldReduceMotion ? (
        <video
          key={settings.heroVideoUrl}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${videoReady ? "opacity-100" : "opacity-0"}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-hidden="true"
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
        >
          <source src={settings.heroVideoUrl} />
        </video>
      ) : null}

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

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl items-end px-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-[calc(7.5rem+env(safe-area-inset-top))] sm:px-8 md:items-center md:px-10 md:pb-24 md:pt-52 lg:px-16">
        <div className="w-full max-w-[58rem] md:translate-y-5">
          {settings.heroEyebrow ? <motion.p className="mb-4 text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-[var(--helios-orange)]" variants={reveal} initial={shouldReduceMotion ? false : "hidden"} animate="visible" transition={{ duration: shouldReduceMotion ? 0 : 0.75, delay: shouldReduceMotion ? 0 : 0.42, ease }}>{settings.heroEyebrow}</motion.p> : null}
          <motion.h1
            className="font-display text-[clamp(3rem,14vw,4rem)] font-light leading-[0.9] tracking-[-0.045em] text-[var(--foreground)] md:text-[clamp(4rem,7.2vw,7rem)] md:leading-[0.92]"
            variants={reveal}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.9,
              delay: shouldReduceMotion ? 0 : 0.55,
              ease,
            }}
          >
            <span className="block">{settings.heroHeadlineLineOne || "Luxury Marketing"}</span>
            <span className="block">{settings.heroHeadlineLineTwo || "for Exceptional Homes"}</span>
          </motion.h1>

          <motion.div
            className="mt-5 h-px bg-[var(--helios-orange)] md:mt-10"
            initial={shouldReduceMotion ? false : { width: 0, opacity: 0 }}
            animate={{ width: 104, opacity: 1 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 0.95,
              ease,
            }}
          />

          <motion.p
            className="mt-5 max-w-2xl text-sm leading-6 text-[var(--helios-muted)] md:mt-8 md:text-lg md:leading-8"
            variants={reveal}
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{
              duration: shouldReduceMotion ? 0 : 0.85,
              delay: shouldReduceMotion ? 0 : 1.1,
              ease,
            }}
          >
            {settings.heroBody || `Photography, cinematic films, aerial imagery, and branding crafted to elevate ${settings.serviceArea}'s most exceptional homes.`}
          </motion.p>


          {settings.availabilityEnabled && settings.availabilityMessage ? (
            <motion.p
              className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 py-2 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-white/68 backdrop-blur-sm"
              variants={reveal}
              initial={shouldReduceMotion ? false : "hidden"}
              animate="visible"
              transition={{ duration: shouldReduceMotion ? 0 : 0.75, delay: shouldReduceMotion ? 0 : 1.2, ease }}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--helios-orange)] shadow-[0_0_12px_rgba(217,107,43,0.6)]" />
              <span>{settings.availabilityLabel ? `${settings.availabilityLabel}: ` : ""}{settings.availabilityMessage}</span>
            </motion.p>
          ) : null}

          <motion.div
            className="mt-7 grid w-full grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-5 md:mt-11"
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
              href={bookingHref}
              className="flex min-h-12 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_35px_rgba(0,0,0,0.25)] sm:min-h-14 sm:px-10 sm:text-xs sm:tracking-[0.23em]"
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
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              {settings.heroPrimaryLabel || "Book Now"}
            </motion.a>

            <motion.a
              href={settings.heroSecondaryDestination || "/portfolio"}
              className="flex min-h-12 items-center justify-center rounded-[3px] border border-white/40 bg-black/10 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm sm:min-h-14 sm:px-10 sm:text-xs sm:tracking-[0.23em]"
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
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
            >
              {settings.heroSecondaryLabel || "View Portfolio"}
            </motion.a>
          </motion.div>
        </div>
      </div>

      <motion.a
        href="#standard"
        aria-label="Scroll to the Helios Standard"
        className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-20 hidden -translate-x-1/2 text-center md:block"
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
          animate={shouldReduceMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          ↓
        </motion.span>
      </motion.a>
    </section>
  );
}
