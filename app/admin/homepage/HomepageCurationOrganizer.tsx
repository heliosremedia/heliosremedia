"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import {
  DEFAULT_HOMEPAGE_CURATION_PREFERENCES,
  normalizeHomepageCurationPreferences,
  type HomepageCurationPreferences,
  type HomepageCurationSectionId,
} from "@/lib/homepage-curation-layout";
import {
  AdminCardIconButton,
  AdminCardToggle,
  AdminDragHandle,
} from "@/app/admin/components/AdminCardControls";

type Section = {
  id: HomepageCurationSectionId;
  title: string;
  description: string;
  summary?: string;
  content: ReactNode;
};

export default function HomepageCurationOrganizer({
  initialPreferences,
  sections,
}: {
  initialPreferences: HomepageCurationPreferences;
  sections: Section[];
}) {
  const [preferences, setPreferences] = useState(() =>
    normalizeHomepageCurationPreferences(initialPreferences),
  );
  const [draggedId, setDraggedId] =
    useState<HomepageCurationSectionId | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const headingRefs = useRef<
    Partial<Record<HomepageCurationSectionId, HTMLButtonElement | null>>
  >({});
  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );

  async function persist(next: HomepageCurationPreferences, success: string) {
    const previous = preferences;
    setPreferences(next);
    setSaving(true);
    setMessage("Saving layout…");
    try {
      const response = await fetch("/api/admin/homepage-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Homepage layout could not be saved.");
      }
      setPreferences(normalizeHomepageCurationPreferences(result.preferences));
      setMessage(success);
    } catch (error) {
      setPreferences(previous);
      setMessage(
        error instanceof Error ? error.message : "Homepage layout could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function reorder(source: HomepageCurationSectionId, targetIndex: number) {
    const nextOrder = preferences.order.filter((id) => id !== source);
    nextOrder.splice(targetIndex, 0, source);
    if (nextOrder.join() === preferences.order.join()) return;
    void persist(
      { ...preferences, order: nextOrder },
      `${sectionById.get(source)?.title ?? "Section"} moved to position ${targetIndex + 1}.`,
    );
  }

  function move(id: HomepageCurationSectionId, direction: -1 | 1) {
    const index = preferences.order.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= preferences.order.length) return;
    const nextOrder = [...preferences.order];
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    void persist(
      { ...preferences, order: nextOrder },
      `${sectionById.get(id)?.title ?? "Section"} moved to position ${target + 1}.`,
    );
  }

  function toggle(id: HomepageCurationSectionId, forceOpen = false) {
    const isCollapsed = preferences.collapsed.includes(id);
    const collapsed = forceOpen || isCollapsed
      ? preferences.collapsed.filter((item) => item !== id)
      : [...preferences.collapsed, id];
    void persist(
      { ...preferences, collapsed },
      `${sectionById.get(id)?.title ?? "Section"} ${collapsed.includes(id) ? "collapsed" : "expanded"}.`,
    );
  }

  function openAndFocus(id: HomepageCurationSectionId) {
    if (preferences.collapsed.includes(id)) toggle(id, true);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      headingRefs.current[id]?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    const id = window.location.hash.slice(1) as HomepageCurationSectionId;
    if (sectionById.has(id)) window.setTimeout(() => openAndFocus(id), 0);
    // The initial hash is handled once; later navigator actions call openAndFocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <nav
        aria-label="Homepage Curation sections"
        className="sticky top-3 z-30 overflow-x-auto rounded-2xl border border-white/10 bg-[#151515]/95 p-3 shadow-xl backdrop-blur"
      >
        <div className="flex min-w-max items-center gap-2">
          <div className="flex gap-2">{preferences.order.map((id) => {
            const section = sectionById.get(id);
            return section ? (
              <button
                key={id}
                type="button"
                onClick={() => openAndFocus(id)}
                className="admin-btn-secondary whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"
              >
                {section.title}
              </button>
            ) : null;
          })}</div>
          <span aria-hidden="true" className="mx-1 h-7 w-px bg-white/10" />
          <button type="button" disabled={saving || preferences.collapsed.length === 0} onClick={() => void persist({ ...preferences, collapsed: [] }, "All homepage sections expanded.")} className="admin-btn-secondary whitespace-nowrap">Expand All</button>
          <button type="button" disabled={saving || preferences.collapsed.length === preferences.order.length} onClick={() => void persist({ ...preferences, collapsed: [...preferences.order] }, "All homepage sections collapsed.")} className="admin-btn-secondary whitespace-nowrap">Collapse All</button>
        </div>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="min-h-5 text-xs text-white/45"
        >
          {message}
        </p>
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-2">
            <span className="px-2 text-xs text-amber-100/70">
              Reset section order and collapsed panels?
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setConfirmReset(false);
                void persist(
                  DEFAULT_HOMEPAGE_CURATION_PREFERENCES,
                  "Default homepage layout restored.",
                );
              }}
              className="admin-btn-primary"
            >
              Confirm reset
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="admin-btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmReset(true)}
            className="admin-btn-secondary"
          >
            Reset to Default Layout
          </button>
        )}
      </div>

      <div className="space-y-5">
        {preferences.order.map((id, index) => {
          const section = sectionById.get(id);
          if (!section) return null;
          const collapsed = preferences.collapsed.includes(id);
          return (
            <section
              key={id}
              id={id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source =
                  draggedId ||
                  (event.dataTransfer.getData("text/plain") as HomepageCurationSectionId);
                if (sectionById.has(source)) reorder(source, index);
                setDraggedId(null);
              }}
              className={`scroll-mt-28 rounded-2xl border bg-[#111] transition ${
                draggedId === id
                  ? "border-[var(--helios-orange)]/40 opacity-60"
                  : "border-white/[0.08]"
              }`}
            >
              <header className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <button
                  ref={(node) => {
                    headingRefs.current[id] = node;
                  }}
                  type="button"
                  aria-expanded={!collapsed}
                  aria-controls={`${id}-content`}
                  onClick={() => toggle(id)}
                  className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--helios-orange)]"
                >
                  <p className="eyebrow text-[var(--helios-orange)]">
                    Homepage organization
                  </p>
                  <h2 className="mt-2 text-2xl font-light text-white">
                    {section.title}
                  </h2>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-white/38">
                    {section.description}
                  </p>
                  {section.summary ? (
                    <p className="mt-2 text-xs text-white/55">
                      {section.summary}
                    </p>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <AdminDragHandle
                    label={section.title}
                    draggable
                    onDragStart={(event: DragEvent<HTMLSpanElement>) => {
                      setDraggedId(id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", id);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                  />
                  <AdminCardIconButton
                    disabled={saving || index === 0}
                    onClick={() => move(id, -1)}
                    label={`Move ${section.title} up`}
                    symbol="↑"
                  />
                  <AdminCardIconButton
                    disabled={saving || index === preferences.order.length - 1}
                    onClick={() => move(id, 1)}
                    label={`Move ${section.title} down`}
                    symbol="↓"
                  />
                  <AdminCardToggle
                    expanded={!collapsed}
                    label={section.title}
                    controls={`${id}-content`}
                    onClick={() => toggle(id)}
                  />
                </div>
              </header>
              <div
                id={`${id}-content`}
                hidden={collapsed}
                className="border-t border-white/[0.07] p-4 sm:p-6"
              >
                {section.content}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
