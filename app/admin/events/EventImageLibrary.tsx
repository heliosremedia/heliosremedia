"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AccessibleDialog from "../newsletter-studio/components/AccessibleDialog";

export type EventLibraryImage = { id: string; url: string; altText: string; label: string; source: string };

export default function EventImageLibrary({ onChoose, onClose }: { onChoose: (image: EventLibraryImage) => void; onClose: () => void }) {
  const [items, setItems] = useState<EventLibraryImage[]>([]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const params = new URLSearchParams({ source, search: search.trim(), page: String(page) });
        const response = await fetch(`/api/admin/events/images?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "The image library could not be loaded.");
        if (controller.signal.aborted) return;
        setItems(current => page === 1 ? data.items : [...current, ...data.items.filter((item: EventLibraryImage) => !current.some(existing => existing.id === item.id))]);
        setHasMore(Boolean(data.hasMore));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The image library could not be loaded.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, search ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, retry, search, source]);

  function resetResults() { setPage(1); setItems([]); setLoading(true); setHasMore(false); }
  return <AccessibleDialog open labelledBy="event-image-library-title" onClose={onClose} initialFocus={searchRef} size="max-w-4xl">
    <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
      <div><p className="text-xs uppercase tracking-widest text-[var(--helios-orange)]">Event Studio</p><h2 id="event-image-library-title" className="mt-2 text-2xl font-light text-white">Choose an invitation image</h2><p className="mt-2 text-sm text-white/50">Images from your Helios library. Choosing one only updates this draft.</p></div>
      <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:border-white/40">Close</button>
    </header>
    <div className="p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="text-xs text-white/60">Find an image<input ref={searchRef} className="mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]" type="search" value={search} onChange={event => { setSearch(event.target.value); resetResults(); }} placeholder="Search images or projects…" /></label>
        <label className="text-xs text-white/60">Source<select className="mt-2 w-full rounded-xl border border-white/15 bg-[#171717] px-3 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]" value={source} onChange={event => { setSource(event.target.value); resetResults(); }}><option value="ALL">All images</option><option value="PORTFOLIO">Portfolio</option><option value="UPLOAD">Event uploads</option></select></label>
      </div>
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200/20 p-4 text-sm text-red-100"><p>{error}</p><button type="button" className="mt-3 underline underline-offset-4" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      <div aria-busy={loading} className="mt-5 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
        {items.map(item => <button key={item.id} type="button" onClick={() => onChoose(item)} className="group overflow-hidden rounded-xl border border-white/10 bg-black/25 text-left transition hover:border-[var(--helios-orange)] focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]">
          <span className="relative block aspect-[4/3]"><Image unoptimized fill src={item.url} alt={item.altText || item.label} sizes="(min-width: 640px) 240px, 40vw" referrerPolicy="no-referrer" className="object-cover" /></span>
          <span className="block p-3"><span className="block truncate text-sm text-white/80">{item.label}</span><span className="mt-1 block text-[10px] uppercase tracking-widest text-white/40">{item.source === "UPLOAD" ? "Event upload" : item.source.toLowerCase()}</span></span>
        </button>)}
      </div>
      {loading && <p role="status" className="mt-6 text-center text-sm text-white/50">Loading images…</p>}
      {!loading && !error && items.length === 0 && <p className="py-10 text-center text-sm leading-6 text-white/50">{search || source !== "ALL" ? "No matching images. Try another search or source." : "No compatible images yet. Close the library and upload a JPG or PNG for your invitation."}</p>}
      {!loading && hasMore && <button type="button" className="mx-auto mt-5 block rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:border-white/40" onClick={() => setPage(value => value + 1)}>Load more images</button>}
    </div>
  </AccessibleDialog>;
}
