"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSiteSettings } from "./SiteSettingsProvider";
export default function BookingStatusBanner() {
  const settings = useSiteSettings(); const [dismissed, setDismissed] = useState(true);
  useEffect(() => { const frame = requestAnimationFrame(() => setDismissed(sessionStorage.getItem(`booking-banner:${settings.bookingMode}`) === "dismissed")); return () => cancelAnimationFrame(frame); }, [settings.bookingMode]);
  if (settings.bookingMode === "ONLINE" || !settings.bookingBannerEnabled || dismissed) return null;
  return <aside className="fixed inset-x-0 top-[4.5rem] z-40 border-y border-[#f06b24]/25 bg-[#17110e]/95 px-5 py-2.5 text-white shadow-xl backdrop-blur" aria-label="Booking status"><div className="mx-auto flex max-w-[1440px] items-center gap-4 text-xs sm:text-sm"><span className="h-2 w-2 shrink-0 rounded-full bg-[#f06b24]" aria-hidden="true" /><Link href="/book" className="min-w-0 flex-1 text-white/75 hover:text-white">{settings.bookingBannerMessage || (settings.bookingMode === "PAUSED" ? "Helios bookings are currently paused." : "Online booking is temporarily unavailable.")} <span className="underline">View options</span></Link><button type="button" className="shrink-0 px-2 text-lg text-white/45 hover:text-white" aria-label="Dismiss booking notice" onClick={() => { sessionStorage.setItem(`booking-banner:${settings.bookingMode}`, "dismissed"); setDismissed(true); }}>×</button></div></aside>;
}
