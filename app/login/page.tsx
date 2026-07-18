import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Admin Sign In | Helios", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const requested = (await searchParams).next;
  const next = requested?.startsWith("/admin") && !requested.startsWith("//") ? requested : "/admin";
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080809] px-5 py-16 text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(217,107,43,0.13),transparent_34%)]" /><div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.025]" /><section className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10"><Image src="/brand/helios-logo.png" alt="Helios Real Estate Media" width={260} height={90} priority className="h-auto w-48" /><div className="mt-10 border-t border-white/[0.08] pt-9"><p className="eyebrow text-[var(--helios-orange)]">Protected workspace</p><h1 className="mt-4 font-display text-4xl font-light tracking-[-0.04em]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-white/35">Sign in to manage the Helios portfolio, media library, and website content.</p></div><LoginForm next={next} /></section></main>;
}
