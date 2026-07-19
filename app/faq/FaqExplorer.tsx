"use client";

import { useMemo, useState } from "react";

export type PublicFaqCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  faqs: Array<{ id: string; question: string; answer: string }>;
};

export default function FaqExplorer({ categories }: { categories: PublicFaqCategory[] }) {
  const [selectedSlug, setSelectedSlug] = useState("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleCategories = useMemo(() => categories
    .filter((category) => selectedSlug === "all" || category.slug === selectedSlug)
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter((faq) => !normalizedQuery || `${faq.question} ${faq.answer}`.toLowerCase().includes(normalizedQuery)),
    }))
    .filter((category) => category.faqs.length > 0), [categories, normalizedQuery, selectedSlug]);

  const resultCount = visibleCategories.reduce((sum, category) => sum + category.faqs.length, 0);

  return (
    <section className="container-shell py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20">
        <aside>
          <div className="lg:sticky lg:top-8">
            <label htmlFor="faq-search" className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/30">Search questions</label>
            <div className="relative mt-3">
              <input id="faq-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What can we help with?" className="min-h-12 w-full rounded-full border border-white/[0.12] bg-white/[0.025] px-5 pr-12 text-sm text-white outline-none placeholder:text-white/22 focus:border-[var(--helios-orange)]/60" />
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25"><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            <div className="mt-9" role="navigation" aria-label="FAQ categories">
              <p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/30">Browse by topic</p>
              <div className="mt-4 flex flex-wrap gap-2 lg:flex-col">
                <button type="button" onClick={() => setSelectedSlug("all")} aria-pressed={selectedSlug === "all"} className={`rounded-full border px-4 py-2.5 text-left text-[0.5rem] font-semibold uppercase tracking-[0.13em] transition ${selectedSlug === "all" ? "border-[var(--helios-orange)]/45 bg-[var(--helios-orange)]/[0.09] text-[var(--helios-orange)]" : "border-white/[0.09] text-white/35 hover:border-white/20 hover:text-white"}`}>All questions</button>
                {categories.map((category) => <button key={category.id} type="button" onClick={() => setSelectedSlug(category.slug)} aria-pressed={selectedSlug === category.slug} className={`rounded-full border px-4 py-2.5 text-left text-[0.5rem] font-semibold uppercase tracking-[0.13em] transition ${selectedSlug === category.slug ? "border-[var(--helios-orange)]/45 bg-[var(--helios-orange)]/[0.09] text-[var(--helios-orange)]" : "border-white/[0.09] text-white/35 hover:border-white/20 hover:text-white"}`}>{category.name}</button>)}
              </div>
            </div>
          </div>
        </aside>

        <div aria-live="polite">
          <div className="flex items-center justify-between gap-6 border-b border-white/[0.09] pb-5">
            <p className="text-xs text-white/28">{resultCount} {resultCount === 1 ? "answer" : "answers"}</p>
            {(query || selectedSlug !== "all") && <button type="button" onClick={() => { setQuery(""); setSelectedSlug("all"); }} className="text-[0.53rem] font-semibold uppercase tracking-[0.15em] text-white/30 transition hover:text-white">Clear filters</button>}
          </div>

          <div className="divide-y divide-white/[0.08]">
            {visibleCategories.map((category, categoryIndex) => (
              <section key={category.id} className="py-12 first:pt-8">
                <div className="mb-7 flex items-start gap-4">
                  <span className="mt-1 text-[0.55rem] font-semibold tracking-[0.16em] text-[var(--helios-orange)]">{String(categoryIndex + 1).padStart(2, "0")}</span>
                  <div><h2 className="font-display text-3xl font-light tracking-[-0.035em] text-white sm:text-4xl">{category.name}</h2>{category.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-white/32">{category.description}</p>}</div>
                </div>

                <div className="space-y-3">
                  {category.faqs.map((faq) => (
                    <details key={faq.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] transition open:border-[var(--helios-orange)]/25 open:bg-[var(--helios-orange)]/[0.035]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 text-left sm:px-7 sm:py-6 [&::-webkit-details-marker]:hidden">
                        <span className="text-base leading-6 text-white/72 transition group-hover:text-white sm:text-lg">{faq.question}</span>
                        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/35 transition group-open:rotate-45 group-open:border-[var(--helios-orange)]/30 group-open:text-[var(--helios-orange)]"><span className="absolute h-px w-3 bg-current"/><span className="absolute h-3 w-px bg-current"/></span>
                      </summary>
                      <div className="px-5 pb-6 sm:px-7 sm:pb-7"><p className="max-w-3xl whitespace-pre-line border-t border-white/[0.07] pt-5 text-sm leading-7 text-white/42 sm:text-base sm:leading-8">{faq.answer}</p></div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {resultCount === 0 && <div className="py-24 text-center"><p className="font-display text-4xl font-light text-white/35">No answers matched that search.</p><p className="mt-3 text-sm text-white/22">Try a different phrase or browse every category.</p></div>}
        </div>
      </div>
    </section>
  );
}
