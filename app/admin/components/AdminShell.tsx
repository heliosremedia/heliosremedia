"use client";

import { useState } from "react";

import { appearanceBootstrap, StudioAppearanceContext, useStudioAppearance } from "./StudioAppearance";
import "../studio-appearance.css";

import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import type { AdminSession } from "@/lib/auth/session";

export default function AdminShell({
  children,
  session,
  initialNavigationFavorites,
  businessName,
}: Readonly<{
  children: React.ReactNode;
  session: AdminSession;
  initialNavigationFavorites: string[];
  businessName: string;
}>) {
  const appearance = useStudioAppearance();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [desktopHidden, setDesktopHidden] = useState(false);

  return (
    <StudioAppearanceContext.Provider value={appearance}>
    <div data-studio-appearance={appearance} suppressHydrationWarning className="admin-form-scope min-h-screen bg-[#09090a] text-[var(--foreground)]">
      <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      <AdminSidebar
        isOpen={sidebarOpen}
        desktopHidden={desktopHidden}
        onClose={() => setSidebarOpen(false)}
        role={session.role}
        initialFavorites={initialNavigationFavorites}
      />

      <div className={desktopHidden ? "" : "lg:pl-60"}>
        <AdminTopbar desktopHidden={desktopHidden} onDesktopToggle={() => setDesktopHidden((hidden) => !hidden)} onMenuOpen={() => setSidebarOpen(true)} session={session} businessName={businessName} />

        <main className="min-h-[calc(100vh-4.5rem)] overflow-visible px-5 py-7 sm:px-8 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[96rem]">{children}</div>
        </main>
      </div>
    </div>
    </StudioAppearanceContext.Provider>
  );
}
