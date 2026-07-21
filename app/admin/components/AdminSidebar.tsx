"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/app/generated/prisma/client";

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  role: AdminRole;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
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
    label: "Homepage",
    href: "/admin/homepage",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="m3 11 9-8 9 8M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    ),
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

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

export default function AdminSidebar({
  isOpen,
  onClose,
  role,
}: AdminSidebarProps) {
  const pathname = usePathname();

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
              Portfolio Admin
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

        <nav className="flex-1 px-3 py-6">
          <p className="px-3 text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-white/30">
            Workspace
          </p>

          <div className="mt-4 space-y-1">
            {navigation.filter((item) => item.href !== "/admin/users" || role === "OWNER" || role === "ADMIN").map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm transition duration-300 ${
                    active
                      ? "bg-white/[0.07] text-white"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {active ? (
                    <span className="absolute inset-y-3 left-0 w-px bg-[var(--helios-orange)]" />
                  ) : null}

                  <span
                    className={
                      active
                        ? "text-[var(--helios-orange)]"
                        : "text-white/40 transition group-hover:text-white/70"
                    }
                  >
                    {item.icon}
                  </span>

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.08] p-4">
          <Link
            href="/"
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
