"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { displayTestimonial } from "@/lib/testimonials";

const ease = [0.22, 1, 0.36, 1] as const;

export type TestimonialCard = {
  id: string;
  quote: string;
  name: string;
  jobTitle: string | null;
  brokerage: string | null;
  image: string | null;
  imageAlt: string;
  focalX: number;
  focalY: number;
  rating: number;
  sourceUrl: string | null;
};

export type GoogleReviewCard = { id: string; agentName: string; testimonial: string; rating: number; sourceUrl: string | null; reviewedAt: string | null };

type CardPosition = "active" | "left" | "right";

function getRelativePosition(
  index: number,
  activeIndex: number,
  total: number,
): CardPosition {
  const distance = (index - activeIndex + total) % total;

  if (distance === 0) return "active";
  if (distance === 1) return "right";

  return "left";
}

export default function InTheirWords({ testimonials, googleReviews }: { testimonials: TestimonialCard[]; googleReviews: GoogleReviewCard[] }) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  const showPrevious = useCallback(() => {
    setActiveIndex(
      (currentIndex) =>
        (currentIndex - 1 + testimonials.length) % testimonials.length,
    );
  }, [testimonials.length]);

  const showNext = useCallback(() => {
    setActiveIndex(
      (currentIndex) => (currentIndex + 1) % testimonials.length,
    );
  }, [testimonials.length]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = window.setInterval(showNext, 11000);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion, showNext]);

  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="relative isolate overflow-hidden bg-[#080808] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0b0b0b] to-transparent"
      />

      <motion.div
        aria-hidden="true"
        animate={{
          x:
            activeIndex === 0
              ? "-10%"
              : activeIndex === 1
                ? "10%"
                : "0%",
          opacity: 1,
        }}
        transition={{
          duration: prefersReducedMotion ? 0 : 1.45,
          ease,
        }}
        className="pointer-events-none absolute left-1/2 top-[55%] -z-10 h-[28rem] w-[49rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(129,55,33,0.095)_0%,rgba(88,34,23,0.032)_42%,transparent_72%)] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[1500px] px-6 pb-16 pt-20 sm:px-8 sm:pb-20 sm:pt-24 lg:px-12 lg:pb-24 lg:pt-28 xl:px-16">
        <motion.header
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 16,
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
          className="mx-auto max-w-3xl text-center"
        >
          <div className="flex items-center justify-center gap-5">
            <span className="h-px w-10 bg-[#f06b24]" />

            <p
              id="testimonials-heading"
              className="text-[0.67rem] font-medium uppercase tracking-[0.32em] text-[#f06b24] sm:text-xs"
            >
              In Their Words
            </p>

            <span className="h-px w-10 bg-[#f06b24]" />
          </div>

          <h2 className="mt-6 font-serif text-[clamp(2.4rem,4.2vw,4.35rem)] leading-[0.94] tracking-[-0.05em] text-[#f2ede7]">
            Confidence,
            <span className="italic text-white"> earned.</span>
          </h2>
        </motion.header>

        <div className="relative mt-11 h-[35rem] sm:mt-13 sm:h-[36rem] md:h-[30.5rem] lg:h-[31.5rem]">
          {testimonials.map((testimonial, index) => {
            const position = getRelativePosition(index, activeIndex, testimonials.length);
            const isActive = position === "active";

            const positionClasses: Record<CardPosition, string> = {
              active:
                "left-1/2 z-30 w-[min(90%,39.5rem)] -translate-x-1/2",
              left: "left-[10%] z-10 hidden w-[25rem] lg:block",
              right: "right-[10%] z-20 hidden w-[25rem] lg:block",
            };

            return (
              <motion.article
                key={testimonial.id}
                role={isActive ? "group" : "button"}
                tabIndex={isActive ? -1 : 0}
                aria-hidden={!isActive}
                onClick={() => {
                  if (!isActive) setActiveIndex(index);
                }}
                onKeyDown={(event) => {
                  if (
                    !isActive &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    setActiveIndex(index);
                  }
                }}
                animate={{
                  opacity: isActive ? 1 : 0.25,
                  scale: isActive ? 1 : 0.83,
                  y: isActive ? -8 : 24,
                  rotate:
                    isActive ? 0 : position === "left" ? -1.8 : 1.8,
                  filter: isActive ? "blur(0px)" : "blur(1.6px)",
                }}
                transition={{
                  opacity: {
                    duration: prefersReducedMotion ? 0 : 0.9,
                    delay: prefersReducedMotion ? 0 : 0.08,
                    ease,
                  },
                  filter: {
                    duration: prefersReducedMotion ? 0 : 1.15,
                    ease,
                  },
                  rotate: {
                    duration: prefersReducedMotion ? 0 : 1.25,
                    ease,
                  },
                  scale: prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 72,
                        damping: 19,
                        mass: 1.2,
                      },
                  x: prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 66,
                        damping: 18,
                        mass: 1.25,
                      },
                  y: prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 68,
                        damping: 19,
                        mass: 1.2,
                      },
                }}
                className={`absolute top-0 h-[31.5rem] cursor-pointer overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#0d0d0d] shadow-[0_26px_76px_rgba(0,0,0,0.4)] sm:h-[32.5rem] md:h-[27rem] lg:h-[28.5rem] ${positionClasses[position]}`}
              >
                <div className="grid h-full grid-rows-[13rem_minmax(0,1fr)] sm:grid-rows-[14rem_minmax(0,1fr)] md:grid-cols-[0.95fr_1.05fr] md:grid-rows-[minmax(0,1fr)]">
                  <div className="relative order-2 flex min-h-0 flex-col p-6 sm:p-7 md:order-1 lg:p-8">
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div
                        aria-hidden="true"
                        className="font-serif text-[2.9rem] leading-none text-[#f06b24]"
                      >
                        “
                      </div>

                      <blockquote className="-mt-3 max-w-[25rem] overflow-hidden font-serif text-[clamp(1.35rem,1.85vw,2.05rem)] leading-[1.05] tracking-[-0.032em] text-[#f2ede7] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8]">
                        {displayTestimonial(testimonial.quote)}
                      </blockquote>
                    </div>

                    <div className="mt-5 shrink-0">
                      <span
                        aria-hidden="true"
                        className="block h-px w-7 bg-white/36"
                      />

                      <p className="mt-4 text-[0.66rem] font-medium uppercase tracking-[0.27em] text-white sm:text-[0.7rem]">
                        {testimonial.name}
                      </p>

                      {(testimonial.jobTitle || testimonial.brokerage) && <p className="mt-2 text-[0.54rem] uppercase tracking-[0.23em] text-white/40 sm:text-[0.58rem]">{[testimonial.jobTitle, testimonial.brokerage].filter(Boolean).join(" · ")}</p>}

                      <p
                        aria-label="Five out of five stars"
                        className="mt-3 text-[0.58rem] tracking-[0.2em] text-[#f06b24]"
                      >
                        {"★".repeat(testimonial.rating)}<span className="text-white/15">{"★".repeat(5 - testimonial.rating)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="relative order-1 min-h-0 overflow-hidden bg-white/[0.03] md:order-2">
                    <motion.div
                      animate={{
                        scale: isActive ? 1 : 1.045,
                      }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 1.25,
                        ease,
                      }}
                      className="absolute inset-0"
                    >
                      {testimonial.image ? <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={testimonial.image}
                          alt={testimonial.imageAlt}
                          loading={index === 0 ? "eager" : "lazy"}
                          style={{
                            "--testimonial-focal-x": `${testimonial.focalX * 100}%`,
                            "--testimonial-focal-y": `${testimonial.focalY * 100}%`,
                            "--testimonial-mobile-y": `${Math.min(testimonial.focalY, 0.28) * 100}%`,
                          } as CSSProperties}
                          className="absolute inset-0 h-full w-full object-cover grayscale contrast-[1.04] [object-position:var(--testimonial-focal-x)_var(--testimonial-mobile-y)] md:[object-position:var(--testimonial-focal-x)_var(--testimonial-focal-y)]"
                        />
                      </> : <div className="flex h-full items-center justify-center font-serif text-8xl text-white/10">{testimonial.name.charAt(0)}</div>}
                    </motion.div>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-[#0d0d0d]/10 md:from-[#0d0d0d]/14 md:to-transparent" />

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d0d0d]/70 via-transparent to-transparent" />
                  </div>
                </div>
              </motion.article>
            );
          })}

          <button
            type="button"
            onClick={showPrevious}
            aria-label="Show previous testimonial"
            className="absolute bottom-0 left-0 z-40 flex h-11 items-center gap-3 text-[0.59rem] font-medium uppercase tracking-[0.24em] text-white/32 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
          >
            <span aria-hidden="true" className="text-lg">
              ←
            </span>
            Previous
          </button>

          <button
            type="button"
            onClick={showNext}
            aria-label="Show next testimonial"
            className="absolute bottom-0 right-0 z-40 flex h-11 items-center gap-3 text-[0.59rem] font-medium uppercase tracking-[0.24em] text-white/32 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
          >
            Next
            <span aria-hidden="true" className="text-lg">
              →
            </span>
          </button>

          <div className="absolute bottom-0 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3">
            {testimonials.map((testimonial, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={testimonial.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Show testimonial from ${testimonial.name}`}
                  aria-current={isActive ? "true" : undefined}
                  className="flex h-10 items-center"
                >
                  <motion.span
                    animate={{
                      width: isActive ? 24 : 5,
                      opacity: isActive ? 1 : 0.27,
                    }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.55,
                      ease,
                    }}
                    className={`block h-[4px] rounded-full ${
                      isActive ? "bg-[#f06b24]" : "bg-white"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {googleReviews.length > 0 && <GoogleReviewRibbon reviews={googleReviews} reducedMotion={Boolean(prefersReducedMotion)} />}

        <motion.footer
          initial={{
            opacity: 0,
            y: prefersReducedMotion ? 0 : 10,
          }}
          whileInView={{
            opacity: 1,
            y: 0,
          }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.85,
            delay: prefersReducedMotion ? 0 : 0.1,
            ease,
          }}
          className="mt-10 flex items-center justify-center gap-7 border-t border-white/[0.07] pt-8 sm:gap-10"
        >
          <span className="text-[0.54rem] font-medium uppercase tracking-[0.34em] text-white/32 sm:text-[0.59rem]">
            Real Relationships.
          </span>

          <span
            aria-hidden="true"
            className="h-7 w-px bg-gradient-to-b from-transparent via-[#f06b24] to-transparent"
          />

          <span className="text-[0.54rem] font-medium uppercase tracking-[0.34em] text-white/32 sm:text-[0.59rem]">
            Proven Results.
          </span>
        </motion.footer>
      </div>
    </section>
  );
}

function GoogleReviewRibbon({ reviews, reducedMotion }: { reviews: GoogleReviewCard[]; reducedMotion: boolean }) {
  const repeated = reviews.length > 1 ? [...reviews, ...reviews] : reviews;
  return <div className="group/reviews relative mt-12 overflow-hidden border-y border-white/[0.065] py-7 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]" aria-label="Selected Google reviews">
    <div className={`flex w-max gap-5 ${reducedMotion || reviews.length === 1 ? "flex-wrap justify-center" : "animate-[google-review-ribbon_72s_linear_infinite] group-hover/reviews:[animation-play-state:paused] group-focus-within/reviews:[animation-play-state:paused]"}`}>
      {repeated.map((review, index) => {
        const content = <><div className="flex items-center justify-between gap-5"><span className="text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-white/38">Google review</span><span aria-label={`${review.rating} out of 5 stars`} className="text-[0.55rem] tracking-[0.15em] text-[#f06b24]">{"★".repeat(review.rating)}</span></div><p className="mt-4 line-clamp-3 font-serif text-[1.05rem] leading-6 text-[#eee8e1]/68">“{displayTestimonial(review.testimonial)}”</p><p className="mt-4 text-[0.54rem] font-medium uppercase tracking-[0.2em] text-white/45">{review.agentName}</p></>;
        const className = "block w-[19rem] shrink-0 rounded-xl border border-white/[0.065] bg-white/[0.018] p-5 transition-colors hover:border-white/15 focus-visible:border-[#f06b24]/40 focus-visible:outline-none sm:w-[22rem]";
        return review.sourceUrl ? <a key={`${review.id}-${index}`} href={review.sourceUrl} target="_blank" rel="noreferrer" className={className}>{content}</a> : <article key={`${review.id}-${index}`} className={className}>{content}</article>;
      })}
    </div>
  </div>;
}
