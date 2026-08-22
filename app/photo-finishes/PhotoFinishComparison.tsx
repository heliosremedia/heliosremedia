"use client";

import Image from "next/image";
import { useId, useState } from "react";

type PhotoFinishComparisonProps = {
  standardSrc: string;
  editorialSrc: string;
  alt: string;
  caption?: string;
  priority?: boolean;
};

export default function PhotoFinishComparison({
  standardSrc,
  editorialSrc,
  alt,
  caption,
  priority = false,
}: PhotoFinishComparisonProps) {
  const [position, setPosition] = useState(50);
  const comparisonId = useId();

  return (
    <figure>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#111] sm:aspect-video">
        <Image
          src={standardSrc}
          alt={`${alt}, Standard Finish`}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 1180px, (min-width: 768px) 88vw, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden="true"
        >
          <Image
            src={editorialSrc}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 1180px, (min-width: 768px) 88vw, 100vw"
            className="object-cover"
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-white/85 shadow-[0_0_22px_rgba(0,0,0,0.75)]"
          style={{ left: `${position}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/65 bg-black/70 text-sm text-white shadow-xl backdrop-blur-sm">
            <span className="-translate-x-0.5">‹</span>
            <span className="translate-x-0.5">›</span>
          </span>
        </div>

        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/70 px-3 py-2 text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm sm:left-5 sm:top-5">
          Editorial
        </span>
        <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/70 px-3 py-2 text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm sm:right-5 sm:top-5">
          Standard
        </span>

        <label className="sr-only" htmlFor={comparisonId}>
          Move the slider to compare Editorial Finish with Standard Finish
        </label>
        <input
          id={comparisonId}
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          aria-valuetext={`${position}% Editorial Finish visible`}
        />
      </div>
      <figcaption className="mt-4 text-xs leading-6 text-white/32">
        {caption || "Representative views from the same property. Framing may vary. Drag to compare the overall visual direction."}
      </figcaption>
    </figure>
  );
}
