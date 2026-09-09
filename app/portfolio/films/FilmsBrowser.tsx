"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendPortfolioEvent } from "@/app/components/PortfolioAnalytics";
import { tryResolveExternalMedia } from "@/lib/external-media";
import type { DiscoveryFilm } from "@/lib/portfolio-discovery";

export default function FilmsBrowser({ initialItems, initialNextOffset, total }: { initialItems: DiscoveryFilm[]; initialNextOffset: number | null; total: number }) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeIndex = useMemo(() => items.findIndex(({ id }) => id === activeId), [activeId, items]);
  const active = activeIndex >= 0 ? items[activeIndex] : null;
  const resolved = tryResolveExternalMedia(active?.externalUrl);

  const close = useCallback(() => {
    setActiveId(null);
    setPlayerReady(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const move = useCallback((amount: number) => {
    if (activeIndex < 0 || items.length < 2) return;
    setPlayerReady(false);
    setActiveId(items[(activeIndex + amount + items.length) % items.length].id);
  }, [activeIndex, items]);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),video,[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [active, close, move]);

  async function loadMore() {
    if (nextOffset === null || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/portfolio/films?offset=${nextOffset}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error("Unable to load more films.");
      setItems((current) => [...current, ...data.items.filter((item: DiscoveryFilm) => !current.some(({ id }) => id === item.id))]);
      setNextOffset(data.nextOffset);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load more films.");
    } finally { setLoading(false); }
  }

  function preparePlayer() {
    if (!active) return;
    setPlayerReady(true);
    if (resolved?.embedUrl) sendPortfolioEvent({ eventName: "VIDEO_START", projectId: active.project.id, channel: "video", target: `/portfolio/${active.project.slug}`, metadata: { label: active.title, asset: active.id } });
  }

  return <>
    <p className="sr-only" aria-live="polite">Showing {items.length} of {total} films.</p>
    <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((film) => {
        const portrait = film.aspectRatio < 0.85;
        return <article key={film.id} className={`group overflow-hidden border border-white/[0.08] bg-black/25 ${portrait ? "sm:max-w-sm" : ""}`}>
          <button type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setActiveId(film.id); }} data-analytics-event="GALLERY_IMAGE_OPEN" data-analytics-project={film.project.id} data-analytics-channel="video" data-analytics-label={film.title} aria-label={`Open ${film.title}`} className={`relative block w-full overflow-hidden bg-[#0b0b0c] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)] ${portrait ? "aspect-[9/16]" : "aspect-video"}`}>
            <Image src={film.posterUrl} alt="" fill loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover opacity-80 transition duration-700 group-hover:scale-[1.025] group-hover:opacity-95 motion-reduce:transition-none"/>
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/15"/>
            <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-black/45 text-xl text-white">▶</span></span>
            <span className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[0.5rem] font-semibold uppercase tracking-[0.13em] text-white/70">{film.filmType}</span>
          </button>
          <div className="p-5"><h2 className="font-display text-2xl font-light text-white/85">{film.title}</h2><p className="mt-2 text-xs text-white/35">{film.project.title}{film.project.location ? ` · ${film.project.location}` : ""}</p></div>
        </article>;
      })}
    </div>
    {loadError ? <p role="alert" className="mt-8 text-center text-sm text-red-200/70">{loadError}</p> : null}
    {nextOffset !== null ? <div className="mt-12 flex justify-center"><button type="button" disabled={loading} onClick={() => void loadMore()} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 hover:border-white/35 hover:text-white disabled:opacity-45">{loading ? "Loading…" : "Load More"}</button></div> : null}
    {active && resolved ? <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${active.title} film viewer`} className="fixed inset-0 z-[110] flex flex-col bg-black/96 backdrop-blur-xl">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-white/[0.08] px-5 sm:px-8"><div className="min-w-0"><p className="eyebrow truncate text-[var(--helios-orange)]">{active.filmType} · {activeIndex + 1} of {items.length}</p><h2 className="mt-1 truncate font-display text-xl font-light text-white/80 sm:text-2xl">{active.title}</h2></div><button type="button" autoFocus onClick={close} aria-label="Close film viewer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl text-white/70">×</button></header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8 lg:px-20">
        {!playerReady ? <div className={`relative w-full overflow-hidden bg-black ${active.aspectRatio < .85 ? "aspect-[9/16] max-h-full max-w-md" : "aspect-video max-w-7xl"}`}><Image src={active.posterUrl} alt="" fill sizes="100vw" className="object-cover opacity-65"/><button type="button" onClick={preparePlayer} className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-black/55 text-2xl text-white hover:border-[var(--helios-orange)]" aria-label={`Play ${active.title}`}>▶</button></div>
          : resolved.embedUrl ? <iframe src={resolved.embedUrl} title={active.title} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className={`${active.aspectRatio < .85 ? "aspect-[9/16] max-h-full max-w-md" : "aspect-video max-w-7xl"} w-full border-0 bg-black`}/>
          : resolved.playbackUrl ? <video src={resolved.playbackUrl} controls playsInline preload="metadata" onPlay={() => sendPortfolioEvent({ eventName: "VIDEO_START", projectId: active.project.id, channel: "video", metadata: { label: active.title, asset: active.id } })} className={`${active.aspectRatio < .85 ? "aspect-[9/16] max-h-full max-w-md" : "aspect-video max-w-7xl"} w-full bg-black`}/>
          : null}
        {items.length > 1 ? <><button type="button" onClick={() => move(-1)} aria-label="Previous film" className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-2xl text-white/70">‹</button><button type="button" onClick={() => move(1)} aria-label="Next film" className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-2xl text-white/70">›</button></> : null}
      </div>
      <footer className="flex flex-col gap-3 border-t border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p className="text-xs text-white/40">{active.project.location || active.project.title}</p><Link href={`/portfolio/${active.project.slug}`} data-analytics-event="CTA_CLICK" data-analytics-label="View Complete Project" data-analytics-project={active.project.id} data-analytics-channel="video" className="text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)] hover:text-white">View Complete Project</Link></footer>
    </div> : null}
  </>;
}
