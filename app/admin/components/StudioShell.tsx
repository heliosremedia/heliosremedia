"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminSession } from "@/lib/auth/session";
import { studioNavigation, studioLinkIsActive } from "@/lib/studio-navigation";
import LogoutButton from "./LogoutButton";

export default function StudioShell({ children, session, businessName }: {
  children: React.ReactNode;
  session: AdminSession;
  businessName: string;
}) {
  const path = usePathname();
  function navigation() {
    return studioNavigation.map(group => <section key={group.label} className="mt-6 first:mt-0">
      <h2 className="px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-stone-400">{group.label}</h2>
      <ul className="mt-2 space-y-1">{group.links.map(link => {
        const active = studioLinkIsActive(path, link.href);
        return <li key={link.href}><Link href={link.href} aria-current={active ? "page" : undefined}
          onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}
          className={`block rounded-lg px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-amber-200 ${active ? "bg-amber-100/10 text-amber-100" : "text-stone-300 hover:bg-white/5 hover:text-white"}`}>{link.label}</Link></li>;
      })}</ul>
    </section>);
  }
  return <div className="admin-form-scope min-h-screen bg-[#101112] text-stone-100">
    <a href="#studio-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-black">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-white/10 bg-[#0b0c0d] px-4 py-7 lg:block">
      <Link href="/admin/studio" className="px-3 text-lg font-medium tracking-tight text-stone-100">Studio <span className="text-amber-200/80">V2</span></Link>
      <p className="mb-8 mt-2 px-3 text-xs text-stone-400">Your work, in focus.</p>
      <nav aria-label="Studio navigation">{navigation()}</nav>
    </aside>
    <div className="min-w-0 lg:pl-64">
      <header className="border-b border-white/10 bg-[#101112] px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.2em] text-stone-400">Current workspace</p><p className="mt-1 truncate text-sm font-medium" title={businessName}>{businessName}</p></div>
          <div className="flex shrink-0 items-center gap-3"><span className="hidden text-xs text-stone-400 sm:inline">{session.displayName} · {session.role.toLowerCase()}</span><LogoutButton /></div>
        </div>
        <details className="mt-4 rounded-lg border border-white/10 p-3 lg:hidden">
          <summary className="cursor-pointer text-sm text-amber-100">Studio navigation</summary>
          <nav aria-label="Mobile Studio navigation" className="max-h-[65vh] overflow-y-auto pt-5">{navigation()}</nav>
        </details>
      </header>
      <main id="studio-content" tabIndex={-1} className="min-w-0 px-5 py-8 outline-none sm:px-8 lg:p-10"><div className="mx-auto max-w-[96rem]">{children}</div></main>
    </div>
  </div>;
}
