"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { tryResolveExternalMedia } from "@/lib/external-media";

export type PortfolioFilmItem = {
  id: string;
  title: string;
  externalUrl: string;
  project: {
    title: string;
    slug: string;
    location: string | null;
  };
};

type PortfolioFilmLibraryProps = {
  films: PortfolioFilmItem[];
};

export default function PortfolioFilmLibrary({
  films,
}: PortfolioFilmLibraryProps) {
  const [activeFilmId, setActiveFilmId] = useState<string | null>(null);
  const activeIndex = useMemo(
    () => films.findIndex((film) => film.id === activeFilmId),
    [activeFilmId, films],
  );
  const activeFilm = activeIndex >= 0 ? films[activeIndex] : null;
  const activeMedia = tryResolveExternalMedia(activeFilm?.externalUrl);

  const close = useCallback(() => setActiveFilmId(null), []);
  const previous = useCallback(() => {
    if (activeIndex < 0 || films.length < 2) {
      return;
    }

    setActiveFilmId(
      films[(activeIndex - 1 + films.length) % films.length].id,
    );
  }, [activeIndex, films]);
  const next = useCallback(() => {
    if (activeIndex < 0 || films.length < 2) {
      return;
    }

    setActiveFilmId(films[(activeIndex + 1) % films.length].id);
  }, [activeIndex, films]);

  useEffect(() => {
    if (!activeFilm) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        previous();
      } else if (event.key === "ArrowRight") {
        next();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeFilm, close, next, previous]);

  if (films.length === 0) {
    return null;
  }

  return (
    <section className="container-shell border-t border-white/[0.08] pb-24 pt-20 sm:pb-32 sm:pt-28">
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--helios-orange)]">Watch directly</p>
          <h2 className="mt-4 font-display text-4xl font-light tracking-[-0.04em] text-white sm:text-5xl">
            All films
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/38">
            Browse every published cinematic film without leaving the
            collection.
          </p>
        </div>

        <p className="text-xs text-white/28">
          {films.length} {films.length === 1 ? "film" : "films"}
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {films.map((film) => {
          const media = tryResolveExternalMedia(film.externalUrl);

          return (
            <article
              key={film.id}
              className="group overflow-hidden border border-white/[0.08] bg-black/25 transition duration-500 hover:border-white/[0.2] hover:shadow-[0_28px_75px_rgba(0,0,0,0.38)]"
            >
              <button
                type="button"
                onClick={() => setActiveFilmId(film.id)}
                className="relative block aspect-video w-full overflow-hidden bg-[#0c0c0d] text-left"
                aria-label={`Play ${film.title}`}
              >
                {media?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-75 transition duration-1000 ease-[var(--ease-luxury)] group-hover:scale-[1.04] group-hover:opacity-90"
                  />
                ) : (
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(217,107,43,0.24),transparent_38%),#0d0d0e]" />
                )}

                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/25" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/85 backdrop-blur-md transition duration-500 group-hover:scale-110 group-hover:border-[var(--helios-orange)]/70 group-hover:bg-[var(--helios-orange)] group-hover:text-black">
                    <svg viewBox="0 0 24 24" fill="none" className="ml-0.5 h-5 w-5" aria-hidden="true">
                      <path d="m9 7 8 5-8 5V7Z" fill="currentColor" />
                    </svg>
                  </span>
                </span>

                <span className="absolute bottom-4 left-4 rounded-full border border-white/12 bg-black/40 px-3 py-1.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
                  {media?.label || "Film"}
                </span>
              </button>

              <div className="p-5">
                <h3 className="font-display text-2xl font-light leading-tight text-white/85">
                  {film.title}
                </h3>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <p className="min-w-0 truncate text-xs text-white/32">
                    {film.project.location || film.project.title}
                  </p>
                  <Link
                    href={`/portfolio/${film.project.slug}`}
                    className="shrink-0 text-[0.5rem] font-semibold uppercase tracking-[0.13em] text-white/35 transition hover:text-[var(--helios-orange)]"
                  >
                    Full project ↗
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {activeFilm && activeMedia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeFilm.title} film player`}
          className="fixed inset-0 z-[110] flex flex-col bg-black/96 backdrop-blur-xl"
        >
          <header className="flex min-h-20 items-center justify-between gap-5 border-b border-white/[0.08] px-5 sm:px-8">
            <div className="min-w-0">
              <p className="truncate text-[0.54rem] font-semibold uppercase tracking-[0.17em] text-[var(--helios-orange)]">
                {activeMedia.label} · {activeIndex + 1} of {films.length}
              </p>
              <h3 className="mt-1 truncate font-display text-xl font-light text-white/80 sm:text-2xl">
                {activeFilm.title}
              </h3>
            </div>

            <button
              type="button"
              autoFocus
              onClick={close}
              aria-label="Close film player"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-white/30 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8 lg:px-20">
            {activeMedia.embedUrl ? (
              <iframe
                key={activeFilm.id}
                src={activeMedia.embedUrl}
                title={activeFilm.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video max-h-full w-full max-w-7xl border border-white/10 bg-black shadow-[0_35px_120px_rgba(0,0,0,0.7)]"
              />
            ) : activeMedia.playbackUrl ? (
              <video
                key={activeFilm.id}
                src={activeMedia.playbackUrl}
                controls
                autoPlay
                playsInline
                className="max-h-full w-full max-w-7xl bg-black shadow-[0_35px_120px_rgba(0,0,0,0.7)]"
              >
                Your browser cannot play this hosted video.
              </video>
            ) : null}

            {films.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={previous}
                  aria-label="Previous film"
                  className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/55 backdrop-blur-md transition hover:border-white/30 hover:text-white sm:flex lg:left-7"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next film"
                  className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/55 backdrop-blur-md transition hover:border-white/30 hover:text-white sm:flex lg:right-7"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <footer className="flex flex-col gap-3 border-t border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs text-white/35">
              {activeFilm.project.location || activeFilm.project.title}
            </p>
            <Link
              href={`/portfolio/${activeFilm.project.slug}`}
              onClick={close}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-5 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/50 transition hover:border-white/30 hover:text-white"
            >
              View full project
            </Link>
          </footer>
        </div>
      )}
    </section>
  );
}
