"use client";

import Link from "next/link";
import type { CtaActionType } from "@/app/generated/prisma/client";
import { useSiteSettings } from "./SiteSettingsProvider";

export function resolveSiteAction(type: CtaActionType, value: string | null, settings: ReturnType<typeof useSiteSettings>) {
  if (type === "BOOKING") return settings.bookingUrl || "/inquire";
  if (type === "PHONE") return `tel:${settings.phoneE164}`;
  if (type === "EMAIL") return value ? `mailto:${value}` : settings.email ? `mailto:${settings.email}` : `tel:${settings.phoneE164}`;
  return value || "#";
}

export default function SiteActionLink({ type, value = null, className, children, ariaLabel }: { type: CtaActionType; value?: string | null; className?: string; children: React.ReactNode; ariaLabel?: string }) {
  const settings = useSiteSettings();
  const href = resolveSiteAction(type, value, settings);
  const external = type === "EXTERNAL";
  if (external) return <a href={href} target="_blank" rel="noreferrer" className={className} aria-label={ariaLabel}>{children}</a>;
  return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
}

export function BookingLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return <SiteActionLink type="BOOKING" className={className}>{children}</SiteActionLink>;
}

export function PhoneLink({ className, prefix = "Call " }: { className?: string; prefix?: string }) {
  const settings = useSiteSettings();
  return <Link href={`tel:${settings.phoneE164}`} className={className}>{prefix}{settings.phoneDisplay}</Link>;
}
