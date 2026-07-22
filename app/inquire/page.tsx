import type { Metadata } from "next";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { prisma } from "@/lib/prisma";
import InquiryForm from "./InquiryForm";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const settings = await getSiteSettings(); return buildPageMetadata({ title: "Book Your Shoot | Helios Real Estate Media", description: "Tell Helios about your property and media needs. We'll help build the right campaign.", path: "/inquire", settings }); }

export default async function InquiryPage() {
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true } });
  return <main className="min-h-screen bg-[#090909] text-white"><Navbar /><section className="relative overflow-hidden border-b border-white/[0.08] pt-28"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(217,107,43,0.17),transparent_34%)]" /><div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.03]" /><div className="container-shell relative grid gap-14 py-20 sm:py-28 lg:grid-cols-[minmax(0,0.75fr)_minmax(34rem,1.25fr)] lg:gap-20"><div><p className="eyebrow text-[var(--helios-orange)]">Start a project</p><h1 className="mt-7 font-display text-[clamp(3.8rem,7vw,7rem)] font-light leading-[0.87] tracking-[-0.06em]">Let&apos;s create the first impression.</h1><p className="mt-8 max-w-lg text-base leading-8 text-white/42">Share the property, timing, and services you have in mind. We&apos;ll follow up with the right media plan for the campaign.</p><div className="mt-10 border-t border-white/10 pt-7"><p className="text-[0.55rem] uppercase tracking-[0.18em] text-white/25">What happens next</p><ol className="mt-5 space-y-4 text-sm leading-6 text-white/40"><li><span className="mr-3 text-[var(--helios-orange)]">01</span>We review the property and campaign goals.</li><li><span className="mr-3 text-[var(--helios-orange)]">02</span>We confirm scope, availability, and pricing.</li><li><span className="mr-3 text-[var(--helios-orange)]">03</span>Your production is scheduled and prepared.</li></ol></div></div><InquiryForm services={services} /></div></section><Footer /></main>;
}
