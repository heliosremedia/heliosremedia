import type { Metadata } from "next";

import AdminShell from "./components/AdminShell";
import { requireAdminSession } from "@/lib/auth/session";

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
  return <AdminShell session={session}>{children}</AdminShell>;
}
