import type { Metadata } from "next";

import AdminShell from "./components/AdminShell";

export const metadata: Metadata = {
  title: "Helios Admin",
  description: "Portfolio management for Helios Real Estate Media.",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}