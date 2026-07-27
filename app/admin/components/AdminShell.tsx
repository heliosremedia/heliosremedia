"use client";

import { useState } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-form-scope min-h-screen bg-[#09090a] text-[var(--foreground)]">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={session.role}
        initialFavorites={initialNavigationFavorites}
      />

      <div className="lg:pl-60">
        <AdminTopbar onMenuOpen={() => setSidebarOpen(true)} session={session} businessName={businessName} />

        <main className="min-h-[calc(100vh-4.5rem)] overflow-visible px-5 py-7 sm:px-8 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[96rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
