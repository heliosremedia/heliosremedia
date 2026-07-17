"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function ErrorPage({ error, unstable_retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#090909] px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(217,107,43,0.16),transparent_34%)]" />
      <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light" />

      <div className="container-shell relative">
        <Link
          href="/"
          className="font-display text-3xl font-light tracking-[0.12em] text-white"
        >
          HELIOS
        </Link>
        <p className="eyebrow mt-24 text-[var(--helios-orange)]">
          Something interrupted the story
        </p>
        <h1 className="mt-7 max-w-4xl font-display text-[clamp(4rem,9vw,8.5rem)] font-light leading-[0.84] tracking-[-0.06em]">
          Let&apos;s bring this page back into focus.
        </h1>
        <p className="mt-8 max-w-xl text-sm leading-7 text-white/42 sm:text-base">
          The page encountered a temporary problem. Try it again, or return to
          the portfolio while we keep the experience moving.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={unstable_retry}
            className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] transition hover:bg-[var(--helios-orange-hover)]"
          >
            Try again
          </button>
          <Link
            href="/portfolio"
            className="inline-flex min-h-12 items-center justify-center rounded-[3px] border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/65 transition hover:border-white/35 hover:text-white"
          >
            View portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}
