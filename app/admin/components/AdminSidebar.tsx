"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
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
            {navigation.map((item) => {
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