import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";

import { getSiteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/app/components/SiteSettingsProvider";

import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const favicon = settings.faviconUrl
    ? `${settings.faviconUrl}${settings.faviconUrl.includes("?") ? "&" : "?"}v=${settings.faviconVersion}`
    : undefined;
  return { metadataBase: new URL(getSiteUrl()), title: settings.defaultSeoTitle, description: settings.defaultSeoDescription, icons: favicon ? { icon: [{ url: favicon, type: "image/png" }], shortcut: favicon, apple: favicon } : undefined, openGraph: { type: "website", locale: "en_US", siteName: settings.businessName, title: settings.defaultSeoTitle, description: settings.defaultSeoDescription } };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${inter.variable}`}>
        <SiteSettingsProvider settings={settings}>{children}</SiteSettingsProvider>
      </body>
    </html>
  );
}
