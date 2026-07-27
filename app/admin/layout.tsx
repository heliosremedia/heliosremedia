import type { Metadata } from "next";

import AdminShell from "./components/AdminShell";
import { requireAdminSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Helios Admin",
  description: "Portfolio management for Helios Real Estate Media.",
};

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminSession();
  const settings = await getSiteSettings();
  return (
    <AdminShell
      session={session}
      businessName={settings.businessName || "Your business"}
      initialNavigationFavorites={session.navigationFavorites}
    >
      {children}
    </AdminShell>
  );
}
