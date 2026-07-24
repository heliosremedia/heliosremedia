"use client";

import { useState } from "react";
import type {
  PublicContentCard,
  PublicNavigationItem,
  PublicSiteSettings,
} from "@/lib/site-settings";

type ListKey = "standardPrinciples" | "approachCards";
type ManagedNavigationItem = PublicNavigationItem & {
  displayInNav: boolean;
  displayInFooter: boolean;
};

function mergeNavigation(settings: PublicSiteSettings): ManagedNavigationItem[] {
  const merged = new Map<string, ManagedNavigationItem>();

  const add = (
    item: PublicNavigationItem,
    placement: "displayInNav" | "displayInFooter",
  ) => {
    const key = item.href.trim().toLowerCase();
    const existing = merged.get(key);
    const explicitlyPlaced =
      placement === "displayInNav" ? item.displayInNav : item.displayInFooter;

    if (existing) {
      merged.set(key, {
        ...existing,
        newTab: existing.newTab || item.newTab,
        [placement]: explicitlyPlaced ?? item.published !== false,
      });
      return;
    }

    merged.set(key, {
      ...item,
      displayInNav:
        item.displayInNav ?? (placement === "displayInNav" && item.published !== false),
      displayInFooter:
        item.displayInFooter ??
        (placement === "displayInFooter" && item.published !== false),
    });
  };

  settings.headerNavigation.forEach((item) => add(item, "displayInNav"));
  settings.footerNavigation.forEach((item) => add(item, "displayInFooter"));
  return [...merged.values()];
}

export default function HomepageStructureManager({
  initialSettings,
}: {
  initialSettings: PublicSiteSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [navigation, setNavigation] = useState(() =>
    mergeNavigation(initialSettings),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateCard = (
    key: ListKey,
    index: number,
    patch: Partial<PublicContentCard>,
  ) =>
    setSettings((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));

  const updateNavigation = (
    index: number,
    patch: Partial<ManagedNavigationItem>,
  ) =>
    setNavigation((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const addNavigation = () =>
    setNavigation((current) => [
      ...current,
      {
        label: "New link",
        href: "/",
        published: true,
        displayInNav: true,
        displayInFooter: false,
      },
    ]);

  const move = (key: ListKey, index: number, direction: -1 | 1) =>
    setSettings((current) => {
      const list = [...current[key]];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, [key]: list };
    });

  const moveNavigation = (index: number, direction: -1 | 1) =>
    setNavigation((current) => {
      const list = [...current];
      const target = index + direction;
      if (target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return list;
    });

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const normalizedNavigation = navigation.map((item) => ({
        ...item,
        published: true,
      }));
      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          headerNavigation: normalizedNavigation,
          footerNavigation: normalizedNavigation,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSettings(result.settings);
      setNavigation(mergeNavigation(result.settings));
      setMessage("Homepage structure and navigation saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-white/[0.08] bg-[#111] p-6 lg:p-8">
      <p className="eyebrow text-[var(--helios-orange)]">Reusable structure</p>
      <h2 className="mt-3 text-2xl font-light text-white">
        Principles, approach, and navigation
      </h2>

      <div className="mt-7 grid gap-7 xl:grid-cols-2">
        {(["standardPrinciples", "approachCards"] as ListKey[]).map((key) => (
          <div key={key}>
            <h3 className="text-lg text-white">
              {key === "standardPrinciples"
                ? "Our Standard cards"
                : "Our Approach cards"}
            </h3>
            <div className="mt-4 space-y-3">
              {settings[key].map((item, index) => (
                <div
                  key={`${key}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
                    <input
                      aria-label="Card number"
                      value={item.number}
                      onChange={(event) =>
                        updateCard(key, index, { number: event.target.value })
                      }
                      className="input"
                    />
                    <input
                      aria-label="Card title"
                      value={item.title}
                      onChange={(event) =>
                        updateCard(key, index, { title: event.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <textarea
                    aria-label="Card description"
                    rows={3}
                    value={item.description}
                    onChange={(event) =>
                      updateCard(key, index, {
                        description: event.target.value,
                      })
                    }
                    className="input resize-y"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <label className="text-xs text-white/50">
                      <input
                        type="checkbox"
                        checked={item.published !== false}
                        onChange={(event) =>
                          updateCard(key, index, {
                            published: event.target.checked,
                          })
                        }
                      />{" "}
                      Published
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() => move(key, index, -1)}
                        className="admin-btn-link"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => move(key, index, 1)}
                        className="admin-btn-link"
                      >
                        Down
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-9">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg text-white">Navigation links</h3>
            <p className="mt-1 text-xs leading-5 text-white/35">
              Choose whether each link appears in the main navigation, footer,
              or both.
            </p>
          </div>
          <button
            type="button"
            onClick={addNavigation}
            className="admin-btn-secondary"
          >
            Add link
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {navigation.map((item, index) => (
            <div
              key={`${item.href}-${index}`}
              className="rounded-xl border border-white/10 bg-black/25 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  aria-label="Navigation label"
                  value={item.label}
                  onChange={(event) =>
                    updateNavigation(index, { label: event.target.value })
                  }
                  className="input"
                />
                <input
                  aria-label="Navigation destination"
                  list="site-destinations"
                  value={item.href}
                  onChange={(event) =>
                    updateNavigation(index, { href: event.target.value })
                  }
                  className="input"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4 text-xs text-white/50">
                  <label>
                    <input
                      type="checkbox"
                      checked={item.displayInNav}
                      onChange={(event) =>
                        updateNavigation(index, {
                          displayInNav: event.target.checked,
                        })
                      }
                    />{" "}
                    Display in Nav
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.displayInFooter}
                      onChange={(event) =>
                        updateNavigation(index, {
                          displayInFooter: event.target.checked,
                        })
                      }
                    />{" "}
                    Display in Footer
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(item.newTab)}
                      onChange={(event) =>
                        updateNavigation(index, {
                          newTab: event.target.checked,
                        })
                      }
                    />{" "}
                    New tab
                  </label>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => moveNavigation(index, -1)}
                    className="admin-btn-link"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveNavigation(index, 1)}
                    className="admin-btn-link"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNavigation((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="admin-btn-link-destructive"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <datalist id="site-destinations">
        <option value="/" />
        <option value="/portfolio" />
        <option value="/services" />
        <option value="/about" />
        <option value="/faq" />
        <option value="/blog" />
        <option value="/client-portal" />
        <option value="/#testimonials" />
      </datalist>

      <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
        <p role="status" className="text-sm text-white/40">
          {message}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="admin-btn-primary"
        >
          {saving ? "Saving…" : "Save structure"}
        </button>
      </div>
    </section>
  );
}
