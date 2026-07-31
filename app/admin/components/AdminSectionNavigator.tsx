"use client";

import { useEffect, useState } from "react";

type AdminSection = {
  href: `#${string}`;
  label: string;
};

export default function AdminSectionNavigator({
  label,
  sections,
  actions,
  onNavigate,
  bulkSectionIds,
}: {
  label: string;
  sections: readonly AdminSection[];
  actions?: React.ReactNode;
  onNavigate?: (id: string) => void;
  bulkSectionIds?: readonly string[];
}) {
  const [activeId, setActiveId] = useState(sections[0]?.href.slice(1) ?? "");
  const [bulkStates, setBulkStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const targets = sections
      .map(({ href }) => document.getElementById(href.slice(1)))
      .filter((target): target is HTMLElement => Boolean(target));
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.01] },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!bulkSectionIds?.length) return;
    const read = () => setBulkStates(Object.fromEntries(bulkSectionIds.map((id) => {
      const region = document.getElementById(id);
      const toggle = region?.querySelector<HTMLButtonElement>("button[aria-expanded]");
      return [id, toggle?.getAttribute("aria-expanded") !== "false"];
    })));
    read();
    const observer = new MutationObserver(read);
    bulkSectionIds.forEach((id) => {
      const toggle = document.getElementById(id)?.querySelector("button[aria-expanded]");
      if (toggle) observer.observe(toggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    });
    return () => observer.disconnect();
  }, [bulkSectionIds]);

  function navigate(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    const toggle = target.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    onNavigate?.(id);
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      target.focus({ preventScroll: true });
    }));
  }

  function setAll(expanded: boolean) {
    for (const id of bulkSectionIds ?? []) {
      const toggle = document.getElementById(id)?.querySelector<HTMLButtonElement>("button[aria-expanded]");
      if (toggle && toggle.getAttribute("aria-expanded") !== String(expanded)) toggle.click();
    }
  }

  if (!sections.length) return null;

  return (
    <nav
      aria-label={label}
      className="sticky top-3 z-30 rounded-2xl border border-white/10 bg-[#151515]/95 p-3 shadow-xl backdrop-blur"
    >
      <label className="block md:hidden">
        <span className="mb-2 block text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-white/45">
          Jump to Section
        </span>
        <select
          value={activeId}
          onChange={(event) => navigate(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-white/12 bg-[#18181a] px-4 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f10]"
        >
          {sections.map((section) => (
            <option key={section.href} value={section.href.slice(1)}>{section.label}</option>
          ))}
        </select>
      </label>

      <div className="hidden grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2 md:grid">
        {sections.map((section) => {
          const id = section.href.slice(1);
          const active = id === activeId;
          return (
            <button
              key={section.href}
              type="button"
              aria-current={active ? "location" : undefined}
              onClick={() => navigate(id)}
              className={`admin-btn-secondary min-w-0 px-3 whitespace-normal text-balance ${
                active ? "border-[var(--helios-orange)]/55 bg-[var(--helios-orange)]/[0.08] text-white" : ""
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {(actions || bulkSectionIds?.length) && sections.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
          {actions}
          {bulkSectionIds?.length ? <>
            <button type="button" disabled={bulkSectionIds.every((id) => bulkStates[id])} onClick={() => setAll(true)} className="admin-btn-secondary">Expand All</button>
            <button type="button" disabled={bulkSectionIds.every((id) => bulkStates[id] === false)} onClick={() => setAll(false)} className="admin-btn-secondary">Collapse All</button>
          </> : null}
        </div>
      ) : null}
    </nav>
  );
}
