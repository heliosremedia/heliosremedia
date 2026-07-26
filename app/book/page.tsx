import { redirect } from "next/navigation";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { getSiteSettings } from "@/lib/site-settings";
import BookingRequestForm from "./BookingRequestForm";
import { resolveBookingDestination } from "@/lib/booking-controls";
export const dynamic = "force-dynamic";
export default async function BookingPage() {
  const settings = await getSiteSettings(); const destination = resolveBookingDestination(settings.bookingMode, settings.bookingUrl); if (destination.kind === "redirect") redirect(destination.href);
  const paused = settings.bookingMode === "PAUSED"; const phone = settings.bookingContactPhone || settings.phoneDisplay; const email = settings.bookingContactEmail || settings.email;
  return <main className="min-h-screen bg-[#090909] text-white"><Navbar variant="solid" /><section className="container-shell pb-24 pt-40 sm:pt-48"><p className="eyebrow text-[#f06b24]">{paused ? "Booking paused" : "Booking status"}</p><h1 className="mt-6 max-w-4xl font-display text-[clamp(3.5rem,7vw,7rem)] font-light leading-[.92] tracking-[-.05em]">{settings.bookingHeadline || (paused ? "Bookings are currently paused." : "Online booking is temporarily unavailable.")}</h1><p className="mt-8 max-w-2xl text-lg leading-8 text-white/52">{settings.bookingExplanation || "Please contact Helios directly and we will help coordinate your project."}</p>{settings.bookingEstimatedRestoreAt && <p className="mt-5 text-sm text-white/38">Estimated restoration: {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Denver" }).format(new Date(settings.bookingEstimatedRestoreAt))}</p>}<div className="mt-8 flex flex-wrap gap-3">{phone && <a href={`tel:${settings.phoneE164}`} className="admin-btn-primary">Call {phone}</a>}{email && <a href={`mailto:${email}`} className="admin-btn-secondary">Email Helios</a>}</div>{settings.bookingRequestEnabled && <BookingRequestForm />}</section><Footer /></main>;
}
