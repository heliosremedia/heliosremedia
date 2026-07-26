"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsletterGalleryImage } from "../types";
import AccessibleDialog from "./AccessibleDialog";

const field = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none focus:border-[var(--helios-orange)]";
type ProjectOption = { id: string; title: string; address: string | null };

export default function ImageLibraryDialog({
  open,
  initialTab,
  onClose,
  onChoose,
  allowGenerate = true,
}: {
  open: boolean;
  initialTab: "gallery" | "generate";
  onClose: () => void;
  onChoose: (item: NewsletterGalleryImage) => void;
  allowGenerate?: boolean;
}) {
  const [tab, setTab] = useState<"gallery" | "generate">(initialTab);
  const [items, setItems] = useState<NewsletterGalleryImage[]>([]);
  const [source, setSource] = useState("ALL");
  const [search, setSearch] = useState("");
  const [project, setProject] = useState<ProjectOption | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [activeProjectIndex, setActiveProjectIndex] = useState(-1);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const projectInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (requestedPage = 1, append = false) => {
    setBusy("gallery"); setError("");
    try {
      const params = new URLSearchParams({ source, page: String(requestedPage) });
      if (search.trim()) params.set("search", search.trim());
      if (project) params.set("projectId", project.id);
      const response = await fetch(`/api/admin/newsletters/images?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The image gallery could not be loaded.");
      setItems(current => append ? [...current, ...result.items] : result.items);
      setPage(result.page || requestedPage);
      setHasMore(Boolean(result.hasMore));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image gallery could not be loaded.");
    } finally {
      setBusy(null);
    }
  }, [project, search, source]);

  const loadProjects = useCallback(async (query: string) => {
    setProjectBusy(true); setProjectError("");
    try {
      const params = new URLSearchParams({ mode: "projects" });
      if (query.trim()) params.set("projectSearch", query.trim());
      const response = await fetch(`/api/admin/newsletters/images?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Projects could not be loaded.");
      setProjects(result.projects);
      setActiveProjectIndex(-1);
    } catch (cause) {
      setProjectError(cause instanceof Error ? cause.message : "Projects could not be loaded.");
    } finally {
      setProjectBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open || tab !== "gallery") return;
    const timer = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(timer);
  }, [load, open, tab]);

  useEffect(() => {
    if (!open || !projectOpen) return;
    const timer = window.setTimeout(() => void loadProjects(projectSearch), 250);
    return () => window.clearTimeout(timer);
  }, [loadProjects, open, projectOpen, projectSearch]);

  function selectProject(option: ProjectOption | null) {
    setProject(option);
    setProjectSearch("");
    setProjectOpen(false);
    setPage(1);
    setItems([]);
  }

  function clearFilters() {
    setSearch("");
    setSource("ALL");
    selectProject(null);
  }

  async function generate() {
    setBusy("generate"); setError("");
    try {
      const response = await fetch("/api/admin/newsletters/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, altText }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The image could not be generated.");
      setItems(current => [result.item, ...current.filter(item => item.id !== result.item.id)]);
      onChoose(result.item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be generated.");
    } finally {
      setBusy(null);
    }
  }

  return <AccessibleDialog open={open} onClose={() => !busy && onClose()} labelledBy="newsletter-image-dialog-title" size="max-w-6xl">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-5 sm:p-6">
      <div><p className="eyebrow text-[var(--helios-orange)]">Newsletter Studio</p><h2 id="newsletter-image-dialog-title" className="mt-2 text-2xl font-light text-white sm:text-3xl">Choose an image</h2></div>
      <button type="button" disabled={Boolean(busy)} onClick={onClose} className="admin-btn-link">Close</button>
    </header>
    <div className="p-5 sm:p-6">
      {allowGenerate && <div className="flex rounded-lg border border-white/10 p-1">
        <button type="button" onClick={() => setTab("gallery")} className={`flex-1 rounded-md px-3 py-2 text-xs ${tab === "gallery" ? "bg-white/10 text-white" : "text-white/35"}`}>Browse gallery</button>
        <button type="button" onClick={() => setTab("generate")} className={`flex-1 rounded-md px-3 py-2 text-xs ${tab === "generate" ? "bg-white/10 text-white" : "text-white/35"}`}>Generate with AI</button>
      </div>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.06] px-4 py-3 text-sm text-red-100/80">{error}</p>}
      {tab === "gallery" ? <div className="mt-5">
        <form onSubmit={event => { event.preventDefault(); setPage(1); void load(1); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_12rem_auto]">
          <label className="text-xs text-white/40">Search<input className={field} value={search} onChange={event => setSearch(event.target.value)} placeholder="Project, article, or image…" /></label>
          <div className="relative text-xs text-white/40">
            <label htmlFor="newsletter-project-filter">Project</label>
            <input
              ref={projectInput}
              id="newsletter-project-filter"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={projectOpen}
              aria-controls="newsletter-project-options"
              aria-activedescendant={activeProjectIndex >= 0 ? `newsletter-project-${activeProjectIndex}` : undefined}
              className={field}
              value={projectOpen ? projectSearch : project?.title || "All Projects"}
              onFocus={() => { setProjectSearch(""); setProjectOpen(true); }}
              onChange={event => { setProjectSearch(event.target.value); setProjectOpen(true); }}
              onKeyDown={event => {
                if (event.key === "ArrowDown") {
                  event.preventDefault(); setProjectOpen(true);
                  setActiveProjectIndex(index => Math.min(index + 1, projects.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveProjectIndex(index => Math.max(index - 1, 0));
                } else if (event.key === "Enter" && projectOpen) {
                  event.preventDefault();
                  if (activeProjectIndex >= 0) selectProject(projects[activeProjectIndex]);
                  else if (!projectSearch.trim()) selectProject(null);
                } else if (event.key === "Escape") {
                  setProjectOpen(false);
                }
              }}
            />
            {projectOpen && <div id="newsletter-project-options" role="listbox" aria-label="Eligible newsletter projects" className="absolute z-20 mt-2 max-h-72 w-full min-w-0 overflow-y-auto rounded-xl border border-white/10 bg-[#151515] p-1 shadow-2xl">
              <button type="button" role="option" aria-selected={!project} onClick={() => selectProject(null)} className="block w-full rounded-lg px-3 py-3 text-left text-sm text-white/70 hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none">All Projects</button>
              {projectBusy ? <p role="status" className="px-3 py-5 text-center text-xs text-white/35">Loading projects…</p>
                : projectError ? <div className="px-3 py-4"><p role="alert" className="text-xs text-red-200/70">{projectError}</p><button type="button" onClick={() => void loadProjects(projectSearch)} className="mt-2 text-xs text-[var(--helios-orange)]">Try again</button></div>
                  : projects.length ? projects.map((option, index) => <button
                    id={`newsletter-project-${index}`}
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={project?.id === option.id}
                    onMouseEnter={() => setActiveProjectIndex(index)}
                    onClick={() => selectProject(option)}
                    className={`block w-full rounded-lg px-3 py-2.5 text-left hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none ${activeProjectIndex === index ? "bg-white/[0.06]" : ""}`}
                  ><span className="block truncate text-sm text-white/70" title={option.title}>{option.title}</span>{option.address && <span className="mt-1 block truncate text-[11px] text-white/30" title={option.address}>{option.address}</span>}</button>)
                    : <p className="px-3 py-5 text-center text-xs text-white/35">No eligible projects available.</p>}
            </div>}
          </div>
          <label className="text-xs text-white/40">Source<select className={field} value={source} onChange={event => { setSource(event.target.value); setPage(1); }}><option value="ALL">All images</option><option value="PORTFOLIO">Portfolio</option><option value="BLOG">Blog</option><option value="AI">AI generated</option></select></label>
          <button type="submit" disabled={Boolean(busy)} className="admin-btn-secondary self-end">{busy === "gallery" ? "Loading…" : "Search"}</button>
        </form>
        {(search || project || source !== "ALL") && <div className="mt-3 flex justify-end"><button type="button" onClick={clearFilters} className="admin-btn-link">Clear filters</button></div>}
        {busy === "gallery" && !items.length ? <div className="mt-6 h-64 animate-pulse rounded-xl bg-white/[0.03]" /> : items.length ? <div className="mt-6 grid max-h-[58vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">{items.map(item => <button key={item.id} type="button" onClick={() => onChoose(item)} className="group overflow-hidden rounded-xl border border-white/10 bg-black/25 text-left transition hover:border-[var(--helios-orange)]/70">
          <span className="relative block aspect-[4/3] overflow-hidden"><Image unoptimized fill src={item.thumbnailUrl || item.url} alt={item.altText || item.label} className="object-cover transition duration-500 group-hover:scale-[1.03]" /></span>
          <span className="block p-3"><span className="block truncate text-xs text-white/70">{item.label}</span><span className="mt-1 block text-[9px] uppercase tracking-[.12em] text-white/25">{item.source === "AI" ? "AI generated" : item.source.toLowerCase()}</span></span>
        </button>)}{hasMore && <button type="button" disabled={Boolean(busy)} onClick={() => void load(page + 1, true)} className="admin-btn-secondary col-span-full mx-auto mt-2">{busy === "gallery" ? "Loading…" : "Load more"}</button>}</div> : <div className="mt-10 text-center"><p className="text-sm text-white/35">{project ? "No eligible newsletter images were found for this project." : "No matching images were found."}</p>{project && <button type="button" onClick={() => selectProject(null)} className="admin-btn-link mt-3">Clear project filter</button>}</div>}
      </div> : <div className="mx-auto mt-6 max-w-2xl space-y-5">
        <div className="rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-4 text-sm leading-6 text-white/50">Creates one medium-quality landscape image with paid OpenAI usage. Generated images are stored in the Helios gallery for reuse. Review every result before selecting it.</div>
        <label className="block text-xs text-white/40">Creative direction<textarea rows={6} className={field} maxLength={2000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the setting, subject, mood, lighting, composition, and what to avoid…" /></label>
        <label className="block text-xs text-white/40">Alt text<input className={field} maxLength={300} value={altText} onChange={event => setAltText(event.target.value)} placeholder="Concise description for recipients using screen readers" /></label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={Boolean(busy)} onClick={onClose} className="admin-btn-secondary">Cancel</button><button type="button" disabled={Boolean(busy) || prompt.trim().length < 12 || altText.trim().length < 3} onClick={generate} className="admin-btn-primary">{busy === "generate" ? "Generating… up to 2 minutes" : "Generate image"}</button></div>
      </div>}
    </div>
  </AccessibleDialog>;
}
