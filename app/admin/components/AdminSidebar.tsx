"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type DragEvent } from "react";
import type { AdminRole } from "@/app/generated/prisma/client";

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  role: AdminRole;
  initialFavorites: string[];
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type NavigationGroup = {
  id: string;
  label: string;
  hrefs: string[];
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/admin/projects",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M4 7.5h16M7 4h10a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m8 16 2.4-2.7a1 1 0 0 1 1.5 0l1.4 1.6 1.2-1.2a1 1 0 0 1 1.4 0L18 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Inquiries",
    href: "/admin/inquiries",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4.2A2.5 2.5 0 0 1 4 14.5v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    ),
  },
  {
    label: "Client Portals",
    href: "/admin/client-portals",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8.5-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21a6 6 0 0 1 12 0M13 14.5A5 5 0 0 1 22 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: "Clients",
    href: "/admin/clients",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20a6 6 0 0 1 12 0M14 14.5A4.5 4.5 0 0 1 21 18v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: "Email Studio",
    href: "/admin/email-studio",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  },
  {
    label: "Newsletter Studio",
    href: "/admin/newsletter-studio",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M4 5h16v14H4zM7.5 8.5h9M7.5 12h5M7.5 15.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: "Referral Studio",
    href: "/admin/referral-studio",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M8.5 12.5 6 15a3 3 0 1 0 4.2 4.2l3-3M15.5 11.5 18 9a3 3 0 1 0-4.2-4.2l-3 3M8.5 15.5l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: "Social Studio",
    href: "/admin/social-studio",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M7 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 14a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM8 7l6 2.5M8 17l6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="6" cy="18" r="3.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
  },
  {
    label: "Homepage",
    href: "/admin/homepage",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="m3 11 9-8 9 8M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ),
  },
  {
    label: "Blog Studio",
    href: "/admin/blog",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    label: "About Page",
    href: "/admin/about",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 21a7 7 0 0 1 14 0M4 4h3M17 4h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: "Media Library",
    href: "/admin/media",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="9"
          cy="9"
          r="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m5.5 18 4.2-4.7a1 1 0 0 1 1.5 0l2.2 2.4 1.5-1.5a1 1 0 0 1 1.4 0l2.2 2.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Services",
    href: "/admin/services",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M12 3 4.5 7.2 12 11.5l7.5-4.3L12 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="m4.5 12 7.5 4.3 7.5-4.3M4.5 16.8 12 21l7.5-4.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Local Pages",
    href: "/admin/locations",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "FAQs",
    href: "/admin/faqs",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5"
      >
        <path
          d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.8 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 8.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 1.8-2.5 3.3M12 14.6v.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Testimonials",
    href: "/admin/testimonials",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M7.5 12.5H5.8A2.8 2.8 0 0 1 3 9.7V7.8A2.8 2.8 0 0 1 5.8 5h2.4A2.8 2.8 0 0 1 11 7.8v2.4c0 4-2 6.8-6 8.8M17.5 12.5h-1.7a2.8 2.8 0 0 1-2.8-2.8V7.8A2.8 2.8 0 0 1 15.8 5h2.4A2.8 2.8 0 0 1 21 7.8v2.4c0 4-2 6.8-6 8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Trusted By",
    href: "/admin/trusted-logos",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3 15 9l6.5.9-4.7 4.6 1.1 6.5-5.9-3.1L6.1 21l1.1-6.5-4.7-4.6L9 9l3-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Calls to Action",
    href: "/admin/ctas",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: "Site Settings",
    href: "/admin/settings",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
  {
    label: "Activity",
    href: "/admin/activity",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>,
  },
  {
    label: "Accounts & Users",
    href: "/admin/users",
    icon: <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20a6 6 0 0 1 12 0M16 10h5M18.5 7.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  },
];

const navigationGroups: NavigationGroup[] = [
  {
    id: "administration",
    label: "Administration",
    hrefs: ["/admin/users", "/admin/activity", "/admin/settings"],
  },
  {
    id: "operations",
    label: "Operations",
    hrefs: ["/admin/client-portals", "/admin/clients", "/admin/email-studio", "/admin/inquiries", "/admin/newsletter-studio", "/admin/projects", "/admin/referral-studio", "/admin/social-studio"],
  },
  {
    id: "website-content",
    label: "Website Content",
    hrefs: [
      "/admin/about",
      "/admin/blog",
      "/admin/ctas",
      "/admin/faqs",
      "/admin/homepage",
      "/admin/locations",
      "/admin/media",
      "/admin/services",
      "/admin/testimonials",
      "/admin/trusted-logos",
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

function getActiveGroup(pathname: string) {
  return (
    navigationGroups.find((group) =>
      group.hrefs.some((href) => isActivePath(pathname, href)),
    )?.id ?? null
  );
}

function NavigationLink({
  item,
  pathname,
  onClose,
  favorite,
  onToggleFavorite,
  savingFavorite,
}: {
  item: NavigationItem;
  pathname: string;
  onClose: () => void;
  favorite?: boolean;
  onToggleFavorite?: (href: string) => void;
  savingFavorite?: boolean;
}) {
  const active = isActivePath(pathname, item.href);

  return (
    <div
      className={`group relative flex items-center rounded-xl transition duration-300 ${
        active
          ? "bg-white/[0.07] text-white"
          : "text-white/50 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {active ? (
        <span className="absolute inset-y-3 left-0 w-px bg-[var(--helios-orange)]" />
      ) : null}

      <Link
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-[0.92rem]"
      >
        <span
          className={
            active
              ? "text-[var(--helios-orange)]"
              : "text-white/40 transition group-hover:text-white/70"
          }
        >
          {item.icon}
        </span>

        <span className="truncate">{item.label}</span>
      </Link>

      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={
            favorite
              ? `Remove ${item.label} from favorites`
              : `Pin ${item.label} to favorites`
          }
          aria-pressed={favorite}
          disabled={savingFavorite}
          onClick={() => onToggleFavorite(item.href)}
          className={`mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
            favorite
              ? "text-[var(--helios-orange)] hover:bg-white/[0.06]"
              : "text-white/20 hover:bg-white/[0.06] hover:text-white/65"
          } disabled:cursor-wait disabled:opacity-40`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill={favorite ? "currentColor" : "none"}
            className="h-4 w-4"
          >
            <path
              d="m9 4 6 0 .7 5 2.3 2v1H6v-1l2.3-2L9 4Zm3 8v8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export default function AdminSidebar({
  isOpen,
  onClose,
  role,
  initialFavorites,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const activeGroup = getActiveGroup(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [savingFavorite, setSavingFavorite] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [draggedFavorite, setDraggedFavorite] = useState<string | null>(null);
  const [favoriteDropTarget, setFavoriteDropTarget] = useState<{
    href: string;
    edge: "before" | "after";
  } | null>(null);
  const visibleNavigation = navigation.filter(
    (item) =>
      !["/admin/users", "/admin/newsletter-studio"].includes(item.href) ||
      role === "OWNER" ||
      role === "ADMIN",
  );
  const dashboard = visibleNavigation.find((item) => item.href === "/admin");
  const favoriteItems = favorites
    .map((href) => visibleNavigation.find((item) => item.href === href))
    .filter((item): item is NavigationItem => Boolean(item));

  async function toggleFavorite(href: string) {
    if (savingFavorite) return;

    const previousFavorites = favorites;
    const nextFavorites = favorites.includes(href)
      ? favorites.filter((favoriteHref) => favoriteHref !== href)
      : [...favorites, href];

    setFavorites(nextFavorites);
    setSavingFavorite(href);
    setFavoriteError(null);

    try {
      const response = await fetch("/api/admin/navigation-favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: nextFavorites }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        favorites?: string[];
        error?: string;
      };

      if (!response.ok || !result.success || !Array.isArray(result.favorites)) {
        throw new Error(result.error || "Favorites could not be saved.");
      }

      setFavorites(result.favorites);
    } catch (error) {
      setFavorites(previousFavorites);
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "Favorites could not be saved.",
      );
    } finally {
      setSavingFavorite(null);
    }
  }
  async function reorderFavorites(nextFavorites: string[]) {
    if (savingFavorite || nextFavorites.join("|") === favorites.join("|")) return;
    const previousFavorites = favorites; setFavorites(nextFavorites); setSavingFavorite("order"); setFavoriteError(null);
    try {
      const response = await fetch("/api/admin/navigation-favorites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorites: nextFavorites }) });
      const result = await response.json() as { success?: boolean; favorites?: string[]; error?: string };
      if (!response.ok || !result.success || !Array.isArray(result.favorites)) throw new Error(result.error || "Favorite order could not be saved.");
      setFavorites(result.favorites);
    } catch (error) { setFavorites(previousFavorites); setFavoriteError(error instanceof Error ? error.message : "Favorite order could not be saved."); }
    finally { setSavingFavorite(null); setDraggedFavorite(null); setFavoriteDropTarget(null); }
  }
  function previewFavoriteDrop(event: DragEvent<HTMLDivElement>, href: string) {
    event.preventDefault();
    if (!draggedFavorite || draggedFavorite === href) {
      setFavoriteDropTarget(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setFavoriteDropTarget({ href, edge });
  }
  function dropFavorite(event: DragEvent<HTMLDivElement>, href: string) {
    event.preventDefault();
    if (!draggedFavorite || draggedFavorite === href || !favoriteDropTarget) {
      setFavoriteDropTarget(null);
      return;
    }
    const next = favorites.filter((favoriteHref) => favoriteHref !== draggedFavorite);
    const targetIndex = next.indexOf(href);
    next.splice(targetIndex + (favoriteDropTarget.edge === "after" ? 1 : 0), 0, draggedFavorite);
    void reorderFavorites(next);
  }
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-white/[0.08] bg-[#0d0d0f] transition-transform duration-300 ease-[var(--ease-luxury)] lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[4.5rem] items-center justify-between border-b border-white/[0.08] px-6">
          <Link href="/admin" onClick={onClose}>
            <span className="font-helios text-lg tracking-[0.12em] text-white">
              HELIOS
            </span>
            <span className="mt-1 block text-[0.54rem] font-semibold uppercase tracking-[0.28em] text-[var(--helios-orange)]">
              Studio Admin · V1.8.3
            </span>
          </Link>

          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/20 hover:text-white lg:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]">
          <p className="px-3 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-white/30">
            Workspace
          </p>

          <div className="mt-4">
            {dashboard ? (
              <NavigationLink
                item={dashboard}
                pathname={pathname}
                onClose={onClose}
              />
            ) : null}

            {favoriteItems.length > 0 ? (
              <section
                aria-labelledby="admin-favorites-heading"
                className="mt-3 border-t border-white/[0.07] pt-3"
              >
                <p
                  id="admin-favorites-heading"
                  className="px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-white/40"
                >
                  Favorites
                </p>
                <div className="mt-1 space-y-1">
                  {favoriteItems.map((item) => (
                    <div
                      key={`favorite-${item.href}`}
                      draggable={!savingFavorite}
                      onDragStart={() => {
                        setDraggedFavorite(item.href);
                        setFavoriteDropTarget(null);
                      }}
                      onDragEnd={() => {
                        setDraggedFavorite(null);
                        setFavoriteDropTarget(null);
                      }}
                      onDragOver={(event) => previewFavoriteDrop(event, item.href)}
                      onDrop={(event) => dropFavorite(event, item.href)}
                      className="group/favorite relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-center"
                    >
                      {favoriteDropTarget?.href === item.href ? (
                        <span
                          aria-hidden
                          className={`pointer-events-none absolute left-6 right-1 z-10 h-0.5 rounded-full bg-[var(--helios-orange)] shadow-[0_0_10px_rgba(217,107,43,0.65)] ${
                            favoriteDropTarget.edge === "before" ? "-top-[3px]" : "-bottom-[3px]"
                          }`}
                        />
                      ) : null}
                      <div className="flex items-center justify-center text-white/25"><span aria-hidden className="cursor-grab text-sm leading-none" title="Drag to reorder">⠿</span></div><NavigationLink
                      key={`favorite-${item.href}`}
                      item={item}
                      pathname={pathname}
                      onClose={onClose}
                      favorite
                      onToggleFavorite={toggleFavorite}
                      savingFavorite={savingFavorite === item.href}
                    /></div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
              {navigationGroups.map((group) => {
                const items = group.hrefs
                  .map((href) =>
                    visibleNavigation.find((item) => item.href === href),
                  )
                  .filter((item): item is NavigationItem => Boolean(item));
                const expanded = openGroup === group.id;
                const groupIsActive = activeGroup === group.id;

                if (items.length === 0) {
                  return null;
                }

                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`admin-nav-${group.id}`}
                      onClick={() =>
                        setOpenGroup((current) =>
                          current === group.id ? null : group.id,
                        )
                      }
                      className={`admin-nav-group-trigger group relative flex w-full items-center justify-between border-b px-3.5 py-2.5 text-left uppercase transition duration-300 ${
                        groupIsActive
                          ? "border-white/[0.13] bg-white/[0.025] text-white/80"
                          : "border-white/[0.07] bg-transparent text-white/48 hover:border-white/[0.13] hover:bg-white/[0.018] hover:text-white/72"
                      }`}
                    >
                      <span>{group.label}</span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        className={`h-3.5 w-3.5 text-[var(--helios-orange)] transition duration-300 ${
                          groupIsActive
                            ? "opacity-90"
                            : "opacity-50 group-hover:opacity-80"
                        } ${
                          expanded ? "rotate-180" : ""
                        }`}
                      >
                        <path
                          d="m6 8 4 4 4-4"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <div
                      id={`admin-nav-${group.id}`}
                      hidden={!expanded}
                      className="mt-1 space-y-1"
                    >
                      {items.map((item) => (
                        <NavigationLink
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          onClose={onClose}
                          favorite={favorites.includes(item.href)}
                          onToggleFavorite={toggleFavorite}
                          savingFavorite={savingFavorite === item.href}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p
            aria-live="polite"
            className="mt-3 min-h-4 px-3 text-[0.62rem] leading-4 text-red-300/80"
          >
            {favoriteError}
          </p>
        </nav>

        <div className="border-t border-white/[0.08] p-4">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-white/45 transition hover:border-white/20 hover:text-white"
          >
            View website

            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M7 17 17 7M9 7h8v8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </aside>
    </>
  );
}
