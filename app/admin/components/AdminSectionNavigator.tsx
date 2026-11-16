"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AdminSection = {
  href: `#${string}`;
  label: string;
  step?: string;
  detail?: string;
  complete?: boolean;
};

type PinnedFrame = {
  height: number;
  left: number;
  width: number;
};

export default function AdminSectionNavigator({
  label,
  sections,
  actions,
  onNavigate,
  bulkSectionIds,
  siteSettings = false,
  projectEditor = false,
}: {
  label: string;
  sections: readonly AdminSection[];
  actions?: React.ReactNode;
  onNavigate?: (id: string) => void;
  bulkSectionIds?: readonly string[];
  siteSettings?: boolean;
  projectEditor?: boolean;
}) {
  const navigatorRef = useRef<HTMLElement>(null);
  const siteSettingsAnchorRef = useRef<HTMLDivElement>(null);
  const navigationTargetRef = useRef<string | null>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeId, setActiveId] = useState(sections[0]?.href.slice(1) ?? "");
  const [bulkStates, setBulkStates] = useState<Record<string, boolean>>({});
  const [announcement, setAnnouncement] = useState("");
  const [pinnedFrame, setPinnedFrame] = useState<PinnedFrame | null>(null);

  useEffect(() => {
    if (!siteSettings) return;

    const updatePinnedFrame = () => {
      const anchor = siteSettingsAnchorRef.current;
      const navigator = navigatorRef.current;
      if (!anchor || !navigator) return;

      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.top > 80) {
        setPinnedFrame(null);
        return;
      }

      const nextFrame = {
        height: navigator.offsetHeight,
        left: anchorRect.left,
        width: anchorRect.width,
      };
      setPinnedFrame((current) =>
        current &&
        current.height === nextFrame.height &&
        current.left === nextFrame.left &&
        current.width === nextFrame.width
          ? current
          : nextFrame,
      );
    };

    updatePinnedFrame();
    window.addEventListener("scroll", updatePinnedFrame, { passive: true });
    window.addEventListener("resize", updatePinnedFrame);
    const resizeObserver = new ResizeObserver(updatePinnedFrame);
    if (siteSettingsAnchorRef.current) resizeObserver.observe(siteSettingsAnchorRef.current);
    if (navigatorRef.current) resizeObserver.observe(navigatorRef.current);
    return () => {
      window.removeEventListener("scroll", updatePinnedFrame);
      window.removeEventListener("resize", updatePinnedFrame);
      resizeObserver.disconnect();
    };
  }, [siteSettings]);

  useEffect(() => {
    const targets = sections.map(({ href }) => document.getElementById(href.slice(1)))
      .filter((target): target is HTMLElement => Boolean(target));
    if (!targets.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (navigationTargetRef.current) return;
      // Use the same sticky clearance as click navigation, not a viewport-percent
      // observer band that can keep the preceding section active after a click.
      const line = siteSettings || projectEditor
        ? 80 + (navigatorRef.current?.getBoundingClientRect().height ?? 0) + 20
        : 116;
      const reached = targets.filter(target => target.getBoundingClientRect().top <= line);
      const current = reached[reached.length - 1] ?? targets[0];
      if (current) setActiveId(current.id);
    };
    const schedule = () => {
      if (navigationTargetRef.current) {
        if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = setTimeout(() => {
          navigationTargetRef.current = null;
          update();
        }, 200);
      }
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
      navigationTargetRef.current = null;
    };
  }, [sections, siteSettings, projectEditor]);

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
    navigationTargetRef.current = id;
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    // Covers clicks that do not move the viewport. Actual scroll events extend
    // the lock until scrolling settles, preventing intermediate steps flashing.
    navigationTimerRef.current = setTimeout(() => { navigationTargetRef.current = null; }, 1000);
    setActiveId(id);
    window.history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const stickyClearance = siteSettings || projectEditor
        ? 80 + (navigatorRef.current?.getBoundingClientRect().height ?? 0) + 16
        : 112;
      window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - stickyClearance),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }));
  }

  function setAll(expanded: boolean) {
    for (const id of bulkSectionIds ?? []) {
      const toggle = document.getElementById(id)?.querySelector<HTMLButtonElement>("button[aria-expanded]");
      if (toggle && toggle.getAttribute("aria-expanded") !== String(expanded)) toggle.click();
    }
    setAnnouncement(`All sections ${expanded ? "expanded" : "collapsed"}.`);
  }

  if (!sections.length) return null;

  const navigator = (
    <nav
      ref={navigatorRef}
      aria-label={label}
      className={`${siteSettings ? (pinnedFrame ? "fixed top-20 z-20 bg-[#151515]" : "relative z-20 bg-[#151515]") : projectEditor ? "sticky top-20 z-20 bg-[#151515]" : "sticky top-3 z-30 bg-[#151515]/95 backdrop-blur"} rounded-2xl border border-white/10 p-3 shadow-xl`}
      style={pinnedFrame ? { left: pinnedFrame.left, width: pinnedFrame.width } : undefined}
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
            <option key={section.href} value={section.href.slice(1)}>{section.step ? `${section.step}. ` : ""}{section.label}{section.complete ? " — Complete" : ""}</option>
          ))}
        </select>
      </label>

      <div className={`hidden gap-2 md:grid ${siteSettings ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" : "grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))]"}`}>
        {sections.map((section) => {
          const id = section.href.slice(1);
          const active = id === activeId;
          return (
            <button
              key={section.href}
              type="button"
              aria-current={active ? "location" : undefined}
              onClick={() => navigate(id)}
              className={projectEditor
                ? `admin-project-step${section.complete ? " is-complete" : ""}`
                : `admin-btn-secondary min-w-0 px-2.5 ${siteSettings ? "whitespace-nowrap text-[0.68rem]" : "whitespace-normal text-balance"} ${active ? "border-[var(--helios-orange)]/55 bg-[var(--helios-orange)]/[0.08] text-white" : ""}`}
            >
              {section.step ? <span className="admin-project-step-content"><span className="admin-project-step-label">Step {section.step}</span><span className="admin-project-step-value">{section.label}</span><span className="admin-project-step-detail">{section.complete ? <span className="sr-only">Complete. </span> : null}{section.detail}</span></span> : section.label}
              {projectEditor && section.complete ? <span className="admin-project-step-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="m7 12.5 3.1 3L17.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span> : null}
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
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </nav>
  );

  if (siteSettings && pinnedFrame) {
    return (
      <div
        ref={siteSettingsAnchorRef}
        data-site-settings-navigation-anchor
        style={{ height: pinnedFrame.height }}
      >
        {createPortal(navigator, document.body)}
      </div>
    );
  }

  return siteSettings ? (
    <div
      ref={siteSettingsAnchorRef}
      data-site-settings-navigation-anchor
    >
      {navigator}
    </div>
  ) : navigator;
}
