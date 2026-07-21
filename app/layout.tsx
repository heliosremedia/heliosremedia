import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/app/components/SiteSettingsProvider";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return { metadataBase: new URL(getSiteUrl()), title: settings.defaultSeoTitle, description: settings.defaultSeoDescription, openGraph: { type: "website", locale: "en_US", siteName: settings.businessName, title: settings.defaultSeoTitle, description: settings.defaultSeoDescription } };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <body>
        <SiteSettingsProvider settings={settings}>{children}</SiteSettingsProvider>
      </body>
    </html>
  );
}
