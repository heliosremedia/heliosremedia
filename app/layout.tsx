import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";

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
  const analyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const sameAs = [settings.instagramUrl, settings.facebookUrl, settings.youtubeUrl, settings.linkedinUrl].filter((url): url is string => Boolean(url));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings.businessName,
    url: settings.websiteUrl || getSiteUrl(),
    telephone: settings.phoneE164,
    email: settings.email || undefined,
    description: settings.defaultSeoDescription,
    areaServed: settings.serviceArea,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${inter.variable}`}>
        <SiteSettingsProvider settings={settings}>{children}</SiteSettingsProvider>
        <Script id="helios-structured-data" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
        {analyticsId ? <><Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} strategy="afterInteractive" /><Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${analyticsId.replace(/[^A-Za-z0-9_-]/g, "")}');`}</Script></> : null}
      </body>
    </html>
  );
}
