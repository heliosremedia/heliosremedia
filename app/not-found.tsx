import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#090909] px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(217,107,43,0.17),transparent_32%)]" />
      <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light" />

      <div className="container-shell relative grid items-end gap-14 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <Link href="/" aria-label="Helios Real Estate Media home">
            <Image
              src="/brand/helios-logo.png"
              alt="Helios Real Estate Media"
              width={260}
              height={90}
              priority
              className="h-auto w-44"
            />
          </Link>

          <p className="eyebrow mt-24 text-[var(--helios-orange)]">
            404 · Frame not found
          </p>
          <h1 className="mt-7 max-w-4xl font-display text-[clamp(4rem,10vw,9rem)] font-light leading-[0.83] tracking-[-0.065em]">
            This view slipped out of frame.
          </h1>
          <p className="mt-8 max-w-xl text-sm leading-7 text-white/42 sm:text-base">
            The page may have moved, or the address may no longer exist. The
            portfolio is the best place to find your way back into the work.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/portfolio"
              className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-[var(--helios-orange)] px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] transition hover:bg-[var(--helios-orange-hover)]"
            >
              Explore the portfolio
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-[3px] border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/65 transition hover:border-white/35 hover:text-white"
            >
              Return home
            </Link>
          </div>
        </div>

        <p aria-hidden="true" className="font-display text-[clamp(10rem,25vw,24rem)] font-light leading-[0.65] tracking-[-0.1em] text-white/[0.035]">
          404
        </p>
      </div>
    </main>
  );
}
