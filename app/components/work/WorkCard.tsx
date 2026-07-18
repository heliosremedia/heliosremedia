"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

type WorkCardProps = {
  title: string;
  href: string;
  image: string;
  size?: "hero" | "supporting";
  className?: string;
  priority?: boolean;
  imageAlt?: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function WorkCard({
  title,
  href,
  image,
  size = "supporting",
  className = "",
  priority = false,
  imageAlt,
}: WorkCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const imageSizes =
    size === "hero"
      ? "(max-width: 640px) 100vw, (max-width: 1280px) 94vw, 1216px"
      : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 304px";

  return (
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{
        rest: {
          scale: 1,
          y: 0,
          zIndex: 1,
          boxShadow: "0 18px 55px rgba(0, 0, 0, 0.16)",
        },
        hover: {
          scale: shouldReduceMotion ? 1 : 1.025,
          y: shouldReduceMotion ? 0 : -8,
          zIndex: 20,
          boxShadow: "0 32px 90px rgba(0, 0, 0, 0.5)",
        },
      }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.7,
        ease,
      }}
      className={`group relative isolate overflow-hidden bg-black will-change-transform ${className}`}
    >
      <Link
        href={href}
        aria-label={`View the ${title} portfolio`}
        className="absolute inset-0 z-30"
      />

      <motion.div
        variants={{
          rest: {
            scale: 1,
            filter: "brightness(1) saturate(1)",
          },
          hover: {
            scale: shouldReduceMotion ? 1 : 1.065,
            filter: "brightness(1.08) saturate(1.06)",
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 1.05,
          ease,
        }}
        className="absolute inset-0 will-change-transform"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={imageAlt || `${title} portfolio by Helios Real Estate Media`}
          loading={priority ? "eager" : "lazy"}
          sizes={imageSizes}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </motion.div>

      <motion.div
        aria-hidden="true"
        variants={{
          rest: {
            opacity: 0.04,
          },
          hover: {
            opacity: 0,
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.65,
          ease,
        }}
        className="pointer-events-none absolute inset-0 bg-black"
      />

      <motion.div
        aria-hidden="true"
        variants={{
          rest: {
            opacity: 1,
          },
          hover: {
            opacity: 0.88,
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.75,
          ease,
        }}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,5,5,0.94)_0%,rgba(5,5,5,0.72)_17%,rgba(5,5,5,0.38)_34%,rgba(5,5,5,0.12)_52%,rgba(5,5,5,0)_72%)]"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/[0.08] via-transparent to-black/[0.04]" />

      <motion.div
        aria-hidden="true"
        variants={{
          rest: {
            opacity: 0,
          },
          hover: {
            opacity: 1,
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.7,
          ease,
        }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.06),transparent_52%)]"
      />

      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.08]" />

      <motion.div
        aria-hidden="true"
        variants={{
          rest: {
            opacity: 0.08,
          },
          hover: {
            opacity: 0.17,
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.65,
          ease,
        }}
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white"
      />

      <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.018] mix-blend-soft-light" />

      <motion.div
        variants={{
          rest: {
            y: 0,
          },
          hover: {
            y: shouldReduceMotion ? 0 : -5,
          },
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.6,
          ease,
        }}
        className="absolute inset-x-0 bottom-0 z-20 px-7 pb-7 sm:px-8 sm:pb-8"
      >
        <motion.h3
          variants={{
            rest: {
              color: "rgba(255, 255, 255, 0.92)",
            },
            hover: {
              color: "rgba(255, 255, 255, 1)",
            },
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.5,
            ease,
          }}
          className="font-display text-[clamp(1.85rem,2.25vw,2.5rem)] font-light leading-[0.98] tracking-[-0.035em]"
        >
          {title}
        </motion.h3>

        <div className="mt-5 inline-flex flex-col items-start">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-[0.67rem] font-medium uppercase tracking-[0.28em] text-white/76 transition-colors duration-500 group-hover:text-white">
              View Portfolio
            </span>

            <motion.span
              aria-hidden="true"
              variants={{
                rest: {
                  x: 0,
                  color: "rgba(255, 255, 255, 0.76)",
                },
                hover: {
                  x: shouldReduceMotion ? 0 : 5,
                  color: "rgba(255, 255, 255, 1)",
                },
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.5,
                ease,
              }}
              className="text-sm"
            >
              →
            </motion.span>
          </div>

          <motion.span
            aria-hidden="true"
            variants={{
              rest: {
                scaleX: 0,
              },
              hover: {
                scaleX: 1,
              },
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.7,
              ease,
            }}
            className="mt-3 h-px w-[55%] origin-left bg-[var(--helios-orange)]"
          />
        </div>
      </motion.div>
    </motion.article>
  );
}
