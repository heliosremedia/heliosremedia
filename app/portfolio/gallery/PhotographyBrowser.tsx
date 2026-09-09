"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiscoveryPhoto } from "@/lib/portfolio-discovery";

export default function PhotographyBrowser({ initialItems, initialNextOffset, total }: { initialItems: DiscoveryPhoto[]; initialNextOffset: number | null; total: number }) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleItems = useMemo(() => items.filter(({ id }) => !brokenIds.has(id)), [brokenIds, items]);
  const activeIndex = visibleItems.findIndex(({ id }) => id === activeId);
  const active = activeIndex >= 0 ? visibleItems[activeIndex] : null;

  const close = useCallback(() => {
    setActiveId(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const move = useCallback((amount: number) => {
    if (activeIndex < 0 || visibleItems.length < 2) return;
    setActiveId(visibleItems[(activeIndex + amount + visibleItems.length) % visibleItems.length].id);
  }, [activeIndex, visibleItems]);

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [active, close, move]);

  async function loadMore() {
    if (nextOffset === null || loading) return;
    setLoading(true); setLoadError(null);
    try {
      const response = await fetch(`/api/portfolio/gallery?offset=${nextOffset}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error("Unable to load more photography.");
      setItems((current) => [...current, ...data.items.filter((item: DiscoveryPhoto) => !current.some(({ id }) => id === item.id))]);
      setNextOffset(data.nextOffset);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Unable to load more photography."); }
    finally { setLoading(false); }
  }

  return <>
    <p className="sr-only" aria-live="polite">Showing {visibleItems.length} of {total} photographs.</p>
    <div className="mt-10 columns-2 gap-2 md:columns-3 md:gap-3 xl:columns-4 2xl:columns-5">
      {visibleItems.map((item) => <figure key={item.id} className="mb-2 break-inside-avoid overflow-hidden bg-white/[0.025] md:mb-3">
        <button type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setActiveId(item.id); }} data-analytics-event="GALLERY_IMAGE_OPEN" data-analytics-project={item.project.id} data-analytics-channel="gallery" data-analytics-label={item.alt} aria-label={`Open ${item.alt}`} className="group block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)]">
          <Image src={item.imageUrl} alt={item.alt} width={item.width} height={item.height} loading="lazy" sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, (max-width: 1535px) 25vw, 20vw" onError={() => setBrokenIds((current) => new Set(current).add(item.id))} className="h-auto w-full transition duration-700 ease-[var(--ease-luxury)] group-hover:opacity-90 motion-reduce:transition-none" />
        </button>
      </figure>)}
    </div>
    {loadError ? <p role="alert" className="mt-8 text-center text-sm text-red-200/70">{loadError}</p> : null}
    {nextOffset !== null ? <div className="mt-12 flex justify-center"><button type="button" disabled={loading} onClick={() => void loadMore()} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-7 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-white/65 hover:border-white/35 hover:text-white disabled:opacity-45">{loading ? "Loading…" : "Load More"}</button></div> : null}
    {active ? <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${active.project.title} photography viewer`} className="fixed inset-0 z-[110] flex flex-col bg-black/96 backdrop-blur-xl">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-white/[0.08] px-5 sm:px-8"><div className="min-w-0"><p className="eyebrow truncate text-[var(--helios-orange)]">Photography · {activeIndex + 1} of {visibleItems.length}</p><h2 className="mt-1 truncate font-display text-xl font-light text-white/80 sm:text-2xl">{active.project.title}</h2></div><button type="button" autoFocus onClick={close} aria-label="Close photography viewer" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-xl text-white/70 hover:border-white/35 hover:text-white">×</button></header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8"><Image src={active.imageUrl} alt={active.alt} width={active.width} height={active.height} priority sizes="100vw" className="h-auto max-h-full w-auto max-w-full select-none object-contain" />{visibleItems.length > 1 ? <><button type="button" onClick={() => move(-1)} aria-label="Previous photograph" className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-2xl text-white/70">‹</button><button type="button" onClick={() => move(1)} aria-label="Next photograph" className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-2xl text-white/70">›</button></> : null}</div>
      <footer className="flex flex-col gap-3 border-t border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p className="line-clamp-2 text-xs text-white/40">{active.caption || active.alt}</p><Link href={`/portfolio/${active.project.slug}`} data-analytics-event="CTA_CLICK" data-analytics-label="View Complete Project" data-analytics-project={active.project.id} data-analytics-channel="gallery" className="shrink-0 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-[var(--helios-orange)] hover:text-white">View Complete Project</Link></footer>
    </div> : null}
  </>;
}
