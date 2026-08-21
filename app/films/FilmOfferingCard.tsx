"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type FilmExample = {
  id: string;
  title: string;
  embedUrl: string | null;
  playbackUrl: string | null;
  posterUrl: string | null;
  orientation: string | null;
};
export type FilmOfferingView = {
  id: string;
  offeringGroup: "CINEMATIC_FILM" | "SOCIAL_MEDIA_REEL";
  publicName: string;
  positioningStatement: string;
  publicDescription: string;
  priceLabel: string | null;
  runtimeGuidance: string | null;
  orientation: string | null;
  bestForDescription: string | null;
  featureDistinctions: string[];
  bookingDestination: string;
  examples: FilmExample[];
};

export default function FilmOfferingCard({
  offering,
  number,
}: {
  offering: FilmOfferingView;
  number: string;
}) {
  const [activeId, setActiveId] = useState(offering.examples[0]?.id || "");
  const active =
    offering.examples.find((item) => item.id === activeId) ||
    offering.examples[0];
  return (
    <article className="grid gap-8 border-t border-white/[.09] py-12 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:gap-14 lg:py-16">
      <div>
        <p className="text-[.58rem] font-semibold uppercase tracking-[.2em] text-[var(--helios-orange)]">
          {number} · {offering.positioningStatement}
        </p>
        <h3 className="mt-5 font-display text-4xl font-light tracking-[-.04em] text-white sm:text-5xl">
          {offering.publicName}
        </h3>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/48 sm:text-base">
          {offering.publicDescription}
        </p>
        {offering.bestForDescription && (
          <div className="mt-7">
            <p className="text-[.56rem] font-semibold uppercase tracking-[.16em] text-white/28">
              Best suited for
            </p>
            <p className="mt-2 text-sm leading-6 text-white/62">
              {offering.bestForDescription}
            </p>
          </div>
        )}
        <ul className="mt-7 grid gap-2 text-sm text-white/45 sm:grid-cols-2">
          {offering.featureDistinctions.map((item) => (
            <li key={item} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--helios-orange)]"
              />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[.6rem] uppercase tracking-[.14em] text-white/32">
          {offering.runtimeGuidance && <span>{offering.runtimeGuidance}</span>}
          {offering.orientation && <span>{offering.orientation}</span>}
          {offering.priceLabel && (
            <span className="text-white/58">{offering.priceLabel}</span>
          )}
        </div>
        <Link
          href={offering.bookingDestination}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-[.58rem] font-semibold uppercase tracking-[.16em] text-white/65 transition hover:border-[var(--helios-orange)]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)]"
        >
          Discuss this film
        </Link>
      </div>
      <div className="min-w-0">
        <div
          className={`relative overflow-hidden bg-[#111] ${active?.orientation === "vertical" ? "mx-auto aspect-[9/16] max-h-[42rem] max-w-sm" : "aspect-video w-full"}`}
        >
          {active ? (
            active.embedUrl ? (
              <iframe
                key={active.id}
                src={active.embedUrl}
                title={`${offering.publicName}: ${active.title}`}
                loading="lazy"
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : active.playbackUrl ? (
              <video
                key={active.id}
                controls
                preload="metadata"
                poster={active.posterUrl || undefined}
                aria-label={`${offering.publicName}: ${active.title}`}
                className="h-full w-full object-contain"
              >
                <source src={active.playbackUrl} />
              </video>
            ) : (
              <Unavailable />
            )
          ) : (
            <Unavailable />
          )}
          {active?.posterUrl && active.embedUrl ? (
            <Image
              src={active.posterUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="pointer-events-none -z-10 object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <p aria-live="polite" className="mt-3 text-xs text-white/35">
          {active
            ? `Selected example: ${active.title}`
            : "No public example is currently available."}
        </p>
        {offering.examples.length > 1 && (
          <div
            className="mt-4 flex flex-wrap items-center gap-2"
            aria-label={`More ${offering.publicName} examples`}
          >
            {offering.examples.map((example, index) => (
              <button
                key={example.id}
                type="button"
                aria-pressed={example.id === active?.id}
                onClick={() => setActiveId(example.id)}
                className={`film-example-selector public-btn public-btn-compact border ${example.id === active?.id ? "border-[var(--helios-orange)] bg-[var(--helios-orange)]/[.08] text-white" : "border-white/15 text-white/52 hover:border-white/30 hover:text-white/75"}`}
              >
                {index === 0 ? "Featured" : `Example ${index + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Unavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center border border-white/[.08] bg-[radial-gradient(circle_at_50%_30%,rgba(217,107,43,.12),transparent_38%),#111]">
      <p className="max-w-xs px-6 text-center text-sm leading-6 text-white/38">
        A curated example is being prepared.
      </p>
    </div>
  );
}
