import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { PORTAL_REGISTRATION_COOKIE, verifyRegistrationSession } from "@/lib/client-portal/tokens";
import { prisma } from "@/lib/prisma";
import RegistrationForm from "./RegistrationForm";

export const dynamic = "force-dynamic";
export default async function CompleteRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portal = await prisma.clientPortal.findFirst({ where: { slug, active: true, registrationEnabled: true } });
  if (!portal) notFound();
  const session = verifyRegistrationSession((await cookies()).get(PORTAL_REGISTRATION_COOKIE)?.value);
  if (!session || session.portalId !== portal.id) redirect(`/client-portal/${slug}?error=Your+registration+link+expired.+Please+start+again.`);
  return <main className="min-h-screen bg-[#090909] text-white"><Navbar variant="solid" /><section className="container-shell py-20 sm:py-28"><div className="mx-auto max-w-2xl"><p className="eyebrow text-[var(--helios-orange)]">Verified email</p><h1 className="mt-6 font-display text-5xl font-light tracking-[-0.045em] sm:text-7xl">Finish your account.</h1><p className="mt-6 text-sm leading-7 text-white/40">Your email has been verified for {portal.name}. Add your client details and create a password for the connected dashboard.</p><RegistrationForm /></div></section></main>;
}
