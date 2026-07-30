"use client";

import { useState } from "react";

type AdminSection = {
  href: `#${string}`;
  label: string;
};

export default function AdminSectionNavigator({
  label,
  sections,
  actions,
  bulkSectionIds,
}: {
  label: string;
  sections: readonly AdminSection[];
  actions?: React.ReactNode;
  bulkSectionIds?: readonly string[];
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  function setAll(nextCollapsed: boolean) {
    const ids = bulkSectionIds ?? [];
    for (const id of ids) {
      const target = document.getElementById(id);
      if (target) target.hidden = nextCollapsed;
    }
    setCollapsed(nextCollapsed ? [...ids] : []);
  }
  return (
    <nav
      aria-label={label}
      className="sticky top-3 z-30 overflow-x-auto rounded-2xl border border-white/10 bg-[#151515]/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex min-w-max items-center gap-2">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            onClick={(event) => {
              const target = document.getElementById(section.href.slice(1));
              if (!target) return;
              event.preventDefault();
              target.hidden = false;
              setCollapsed(current => current.filter(id => id !== section.href.slice(1)));
              target.setAttribute("tabindex", "-1");
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              window.history.replaceState(null, "", section.href);
              window.setTimeout(() => target.focus({ preventScroll: true }), 250);
            }}
            className="admin-btn-secondary whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"
          >
            {section.label}
          </a>
        ))}
        {bulkSectionIds?.length ? <><span aria-hidden="true" className="mx-1 h-7 w-px bg-white/10" /><button type="button" disabled={!collapsed.length} onClick={() => setAll(false)} className="admin-btn-secondary whitespace-nowrap">Expand All</button><button type="button" disabled={collapsed.length === bulkSectionIds.length} onClick={() => setAll(true)} className="admin-btn-secondary whitespace-nowrap">Collapse All</button></> : null}
        {actions && <><span aria-hidden="true" className="mx-1 h-7 w-px bg-white/10" />{actions}</>}
      </div>
    </nav>
  );
}
