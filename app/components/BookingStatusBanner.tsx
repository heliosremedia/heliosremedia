"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSiteSettings } from "./SiteSettingsProvider";

export default function BookingStatusBanner() {
  const settings = useSiteSettings();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setDismissed(
        sessionStorage.getItem(`booking-banner:${settings.bookingMode}`) ===
          "dismissed",
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, [settings.bookingMode]);

  if (
    settings.bookingMode === "ONLINE" ||
    !settings.bookingBannerEnabled ||
    dismissed
  ) {
    return null;
  }

  const message =
    settings.bookingBannerMessage ||
    (settings.bookingMode === "PAUSED"
      ? "Helios bookings are currently paused."
      : "Online booking is temporarily unavailable.");

  return (
    <aside
      className="relative z-10 border-y border-[#f06b24]/25 bg-[#17110e]/95 px-5 py-2.5 text-white shadow-xl backdrop-blur"
      aria-label="Booking status"
      data-booking-status-banner
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 text-xs sm:gap-4 sm:text-sm">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-[#f06b24]"
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 leading-5 text-white/75">
          {message}{" "}
          <Link
            href="/book"
            className="whitespace-nowrap font-medium text-white underline decoration-white/45 underline-offset-2 transition hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]"
          >
            View options
          </Link>
        </p>
        <button
          type="button"
          className="shrink-0 px-2 text-lg text-white/45 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]"
          aria-label="Dismiss booking notice"
          onClick={() => {
            sessionStorage.setItem(
              `booking-banner:${settings.bookingMode}`,
              "dismissed",
            );
            setDismissed(true);
          }}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
