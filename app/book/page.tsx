import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { getSiteSettings } from "@/lib/site-settings";
import BookingRequestForm from "./BookingRequestForm";
import { resolveBookingDestination } from "@/lib/booking-controls";
import PublicPageHeading from "@/app/components/PublicPageHeading";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function BookingPage() {
  const settings = await getSiteSettings(); const destination = resolveBookingDestination(settings.bookingMode, settings.bookingUrl, settings.bookingHandoffEnabled);
  if (destination.kind === "external") redirect(destination.href);
  const paused = settings.bookingMode === "PAUSED"; const phone = settings.bookingContactPhone || settings.phoneDisplay; const email = settings.bookingContactEmail || settings.email;
  const online = destination.kind === "handoff";
  const company = settings.businessName || "our studio"; const provider = settings.bookingProviderName || "our secure booking partner";
  return <main className="min-h-screen bg-[#090909] text-white"><Navbar variant="solid"/><section className="container-shell pb-24 pt-16 sm:pt-24"><PublicPageHeading eyebrow={settings.bookingEyebrow||(online?"Secure booking handoff":paused?"Booking paused":"Booking status")} headline={online?(settings.bookingHandoffHeadline||`Continue to schedule with ${company}.`):settings.bookingHeadline||(paused?"Bookings are currently paused.":"Online booking is temporarily unavailable.")} summary={online?(settings.bookingHandoffExplanation||`You are leaving ${company} for ${provider}. If that service is unavailable, contact the studio directly and we will help.`):settings.bookingExplanation||`Please contact ${company} directly and we will help coordinate your project.`} metadata={!online&&settings.bookingEstimatedRestoreAt?<>Estimated restoration: {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(settings.bookingEstimatedRestoreAt))}</>:undefined} actions={<>{online&&<a href={destination.href} rel="noopener noreferrer" className="admin-btn-primary">{settings.bookingPrimaryLabel||"Continue to booking"}</a>}{settings.bookingPhoneVisible&&phone&&<a href={`tel:${settings.bookingContactPhone||settings.phoneE164}`} className={online?"admin-btn-secondary":"admin-btn-primary"}>{settings.bookingCallLabel||`Call ${phone}`}</a>}{settings.bookingEmailVisible&&email&&<a href={`mailto:${email}`} className="admin-btn-secondary">{settings.bookingEmailLabel||"Email us"}</a>}</>}/>{!online&&settings.bookingRequestEnabled&&<BookingRequestForm/>}</section><Footer/></main>;
}
