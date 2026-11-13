"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Bearer-link RSVP pages must not pass invitation URLs to analytics. */
export default function SiteAnalytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  if (!measurementId || pathname === "/events/rsvp" || pathname.startsWith("/events/rsvp/") || pathname === "/events/invite" || pathname.startsWith("/events/invite/")) return null;
  const safeId = measurementId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeId) return null;
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safeId)}`} strategy="afterInteractive" />
    <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${safeId}');`}</Script>
  </>;
}
