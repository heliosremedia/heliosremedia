import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import { prisma } from "@/lib/prisma";
import ClientAccessForm from "./ClientAccessForm";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const portal = await prisma.clientPortal.findFirst({ where: { slug: (await params).slug, active: true }, select: { name: true } });
  return { title: portal ? `${portal.name} Client Portal` : "Client Portal", robots: { index: false, follow: false } };
}

export default async function PortalPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const portal = await prisma.clientPortal.findFirst({ where: { slug, active: true } });
  if (!portal) notFound();
  const errorValue = (await searchParams).error;
  const error = typeof errorValue === "string" ? errorValue : "";
  const external = portal.provider === "EXTERNAL";
  return <main className="min-h-screen bg-[#090909] text-white"><Navbar variant="solid" /><section className="relative overflow-hidden border-b border-white/[0.08]"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(217,107,43,0.17),transparent_34%)]" /><div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.03]" /><div className="container-shell relative grid gap-14 py-20 sm:py-28 lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1fr)] lg:items-center lg:gap-20"><div className="min-w-0"><Link href="/client-portal" className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/35 transition hover:text-white">← All client portals</Link><p className="eyebrow mt-10 text-[var(--helios-orange)]">Secure client access</p><h1 className="mt-5 max-w-2xl break-words pb-[0.08em] font-display text-[clamp(3.25rem,5vw,5.5rem)] font-light leading-[1.02] tracking-[-0.05em]">{portal.name}</h1><p className="mt-8 max-w-xl text-base leading-8 text-white/42">{portal.description || "Access your delivered media, active projects, and client booking experience."}</p>{portal.bookingUrl && <a href={portal.bookingUrl} className="mt-8 inline-flex text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)] transition hover:text-white">Book through this portal →</a>}</div><div className="rounded-sm border border-white/[0.1] bg-white/[0.025] p-6 sm:p-9"><p className="eyebrow text-white/30">{external ? "Connected provider" : "Returning client"}</p><h2 className="mt-5 font-display text-4xl font-light tracking-[-0.035em] sm:text-5xl">Open your dashboard.</h2><p className="mt-5 text-sm leading-7 text-white/40">{external ? "Continue to the connected client platform to sign in or create an account." : "Already have an account? Sign in directly with your HDPhotoHub email and password."}</p>{error && <p className="mt-5 border border-red-300/20 bg-red-300/[0.05] px-4 py-3 text-sm text-red-200/75">{error}</p>}{external ? <div className="mt-8 grid gap-3">{portal.loginUrl && <a href={portal.loginUrl} className="inline-flex min-h-14 items-center justify-center bg-[var(--helios-orange)] px-6 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-black">Client login</a>}{portal.registrationEnabled && portal.registrationUrl && <a href={portal.registrationUrl} className="inline-flex min-h-14 items-center justify-center border border-white/15 px-6 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-white/65 transition hover:border-white hover:text-white">Create an account</a>}</div> : <><div className="mt-8 grid gap-3 sm:grid-cols-2"><a href="https://photos.heliosrealestatemedia.com/login/" className="inline-flex min-h-14 items-center justify-center rounded-sm bg-[var(--helios-orange)] px-6 text-center text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white hover:text-black">Log in to dashboard</a><a href="https://photos.heliosrealestatemedia.com/Login/passwordforgot.asp" className="inline-flex min-h-14 items-center justify-center rounded-sm border border-white/15 px-6 text-center text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-white/65 transition hover:border-white hover:text-white">Forgot password</a></div><ClientAccessForm slug={slug} /></>}</div></div></section><Footer /></main>;
}
