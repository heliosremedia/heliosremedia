"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type FeaturedProjectCard = {
  id: string;
  title: string;
  slug: string;
  location: string;
  imageUrl: string;
  imageAlt: string;
  badges: { id: string; name: string }[];
};

const ROTATION_INTERVAL = 7000;

export default function FeaturedProjectCarousel({
  projects,
}: {
  projects: FeaturedProjectCard[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const count = projects.length;

  const select = useCallback(
    (index: number) => setActiveIndex((index + count) % count),
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % count);
    }, ROTATION_INTERVAL);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (!count) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured projects"
      className="group/carousel relative mt-8 overflow-hidden border border-white/[0.08] bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(distance) > 45) select(activeIndex + (distance < 0 ? 1 : -1));
        touchStart.current = null;
      }}
    >
      <div className="relative aspect-[16/10] sm:aspect-[16/9] xl:aspect-[2.35/1]">
        {projects.map((project, index) => {
          const active = index === activeIndex;
          return (
            <article
              key={project.id}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-luxury)] ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <Link href={`/portfolio/${project.slug}`} tabIndex={active ? 0 : -1} aria-label={`View ${project.title}`} className="absolute inset-0 z-20" />
              {project.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.imageUrl} alt={project.imageAlt} className={`h-full w-full object-cover transition-transform duration-[7000ms] ease-linear ${active && count > 1 ? "scale-[1.035]" : "scale-100"}`} />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(217,107,43,0.18),transparent_34%),#111]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent opacity-95" />
              <span className="absolute left-5 top-5 rounded-full border border-[var(--helios-orange)]/35 bg-[var(--helios-orange)] px-3 py-1.5 text-[0.52rem] font-semibold uppercase tracking-[0.15em] text-black sm:left-7 sm:top-7">Featured project</span>
              <div className="absolute inset-x-0 bottom-0 p-6 pb-16 sm:p-8 sm:pb-20">
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/55">{project.location || "Helios project"}</p>
                <h3 className="mt-3 max-w-4xl font-display text-3xl font-light leading-none tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">{project.title}</h3>
                <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
                  {project.badges.map((badge) => <span key={badge.id} className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[0.5rem] font-semibold uppercase tracking-[0.13em] text-white/65 backdrop-blur-md">{badge.name}</span>)}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && <div className="absolute inset-x-0 bottom-5 z-30 flex items-center justify-between px-5 sm:bottom-7 sm:px-7">
        <div className="flex items-center gap-2" role="tablist" aria-label="Choose featured project">
          {projects.map((project, index) => <button key={project.id} type="button" role="tab" aria-selected={index === activeIndex} aria-label={`Show ${project.title}`} onClick={() => select(index)} className={`h-1.5 rounded-full transition-all duration-500 ${index === activeIndex ? "w-8 bg-[var(--helios-orange)]" : "w-1.5 bg-white/35 hover:bg-white/65"}`} />)}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => select(activeIndex - 1)} aria-label="Previous featured project" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/75 backdrop-blur-md transition hover:border-white/45 hover:text-white"><span aria-hidden="true">←</span></button>
          <button type="button" onClick={() => select(activeIndex + 1)} aria-label="Next featured project" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white/75 backdrop-blur-md transition hover:border-white/45 hover:text-white"><span aria-hidden="true">→</span></button>
        </div>
      </div>}
      <p className="sr-only" aria-live="polite">Featured project {activeIndex + 1} of {count}: {projects[activeIndex]?.title}</p>
    </section>
  );
}
