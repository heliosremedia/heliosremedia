import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";

import { getAbsoluteUrl, getConfiguredSiteUrl, getSiteUrl } from "@/lib/site";
import { getSiteSettings } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";
import { SiteSettingsProvider } from "@/app/components/SiteSettingsProvider";
import { getPublishedLocationPages } from "@/lib/location-pages";
import PublicRouteTransition from "@/app/components/PublicRouteTransition";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0f0f10",
  colorScheme: "dark",
};

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
  const siteUrl = getConfiguredSiteUrl(settings.websiteUrl);
  const base = buildPageMetadata({
    title: settings.defaultSeoTitle,
    description: settings.defaultSeoDescription,
    path: "/",
    settings,
  });
  return { ...base, metadataBase: new URL(siteUrl), icons: favicon ? { icon: [{ url: favicon, type: "image/png" }], shortcut: favicon, apple: favicon } : undefined };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, locations] = await Promise.all([
    getSiteSettings(),
    getPublishedLocationPages(),
  ]);
  const analyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const sameAs = [settings.instagramUrl, settings.facebookUrl, settings.youtubeUrl, settings.linkedinUrl].filter((url): url is string => Boolean(url));
  const businessId = getAbsoluteUrl("/#business");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "ProfessionalService"],
        "@id": businessId,
        name: settings.businessName,
        url: settings.websiteUrl || getSiteUrl(),
        telephone: settings.phoneE164,
        email: settings.email || undefined,
        description: settings.defaultSeoDescription,
        image: settings.heroPosterUrl || undefined,
        logo: settings.brandLogoUrl || undefined,
        areaServed: { "@type": "AdministrativeArea", name: settings.serviceArea },
        sameAs: sameAs.length ? sameAs : undefined,
      },
      {
        "@type": "WebSite",
        "@id": getAbsoluteUrl("/#website"),
        url: getAbsoluteUrl("/"),
        name: settings.businessName,
        publisher: { "@id": businessId },
        inLanguage: "en-US",
      },
    ],
  };
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${inter.variable}`}>
        <SiteSettingsProvider settings={settings} locations={locations}><PublicRouteTransition>{children}</PublicRouteTransition></SiteSettingsProvider>
        <Script id="helios-structured-data" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
        {analyticsId ? <><Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} strategy="afterInteractive" /><Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${analyticsId.replace(/[^A-Za-z0-9_-]/g, "")}');`}</Script></> : null}
      </body>
    </html>
  );
}
