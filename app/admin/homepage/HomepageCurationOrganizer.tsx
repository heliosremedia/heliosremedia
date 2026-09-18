"use client";

import { useLayoutRecovery } from "./useLayoutRecovery";

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
  type HomepageCurationPreferences,
  type HomepageCurationSectionId,
} from "@/lib/homepage-curation-layout";
import {
  AdminCardIconButton,
  AdminCardToggle,
  AdminDragHandle,
} from "@/app/admin/components/AdminCardControls";
import AdminSectionNavigator from "@/app/admin/components/AdminSectionNavigator";

type Section = {
  id: HomepageCurationSectionId;
  title: string;
  description: string;
  summary?: string;
  content: ReactNode;
};

export default function HomepageCurationOrganizer({
  initialPreferences,
  initialRevision, userId, workspaceId,
  sections,
}: {
  initialPreferences: HomepageCurationPreferences;
  initialRevision: string; userId: string; workspaceId: string;
  sections: Section[];
}) {
  const recovery = useLayoutRecovery(userId, workspaceId, initialRevision, initialPreferences);
  const preferences = recovery.draft;
  const saving = recovery.saving || recovery.held;
  const message = recovery.status;
  const [draggedId, setDraggedId] =
    useState<HomepageCurationSectionId | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const headingRefs = useRef<
    Partial<Record<HomepageCurationSectionId, HTMLButtonElement | null>>
  >({});
  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );

  function persist(next: HomepageCurationPreferences) {
    return recovery.persist(preferences, next);
  }

  function reorder(source: HomepageCurationSectionId, targetIndex: number) {
    const nextOrder = preferences.order.filter((id) => id !== source);
    nextOrder.splice(targetIndex, 0, source);
    if (nextOrder.join() === preferences.order.join()) return;
    void persist(
      { ...preferences, order: nextOrder },
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
    );
  }

  function toggle(id: HomepageCurationSectionId, forceOpen = false) {
    const isCollapsed = preferences.collapsed.includes(id);
    const collapsed = forceOpen || isCollapsed
      ? preferences.collapsed.filter((item) => item !== id)
      : [...preferences.collapsed, id];
    void persist(
      { ...preferences, collapsed },
    );
  }

  function openAndFocus(id: HomepageCurationSectionId) {
    recovery.reveal(id);
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
    const timer = sectionById.has(id) ? window.setTimeout(() => openAndFocus(id), 0) : undefined;
    return () => window.clearTimeout(timer);
    // The initial hash is handled once; later navigator actions call openAndFocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <AdminSectionNavigator
        label="Homepage Curation sections"
        sections={preferences.order.flatMap((id) => {
          const section = sectionById.get(id);
          return section ? [{ href: `#${id}` as `#${string}`, label: section.title }] : [];
        })}
        onNavigate={(id) => {
          const sectionId = id as HomepageCurationSectionId;
          if (preferences.collapsed.includes(sectionId)) toggle(sectionId, true);
        }}
        actions={<>
          <button type="button" disabled={saving || preferences.collapsed.length === 0} onClick={() => void persist({ ...preferences, collapsed: [] })} className="admin-btn-secondary whitespace-nowrap">Expand All</button>
          <button type="button" disabled={saving || preferences.collapsed.length === preferences.order.length} onClick={() => void persist({ ...preferences, collapsed: [...preferences.order] })} className="admin-btn-secondary whitespace-nowrap">Collapse All</button>
        </>}
      />

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

      {recovery.panel}
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
                  disabled={saving}
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
                    draggable={!saving}
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
                    disabled={saving}
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
