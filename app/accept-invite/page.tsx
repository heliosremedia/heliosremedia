import type { Metadata } from "next";
import Link from "next/link";
import AcceptInviteForm from "./AcceptInviteForm";

export const metadata: Metadata = { title: "Accept Invitation | Helios", robots: { index: false, follow: false } };

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  return <main className="flex min-h-screen items-center justify-center bg-[#09090a] px-5 py-16"><section className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] p-7 shadow-2xl sm:p-9"><p className="eyebrow text-[var(--helios-orange)]">Helios workspace</p><h1 className="mt-4 font-display text-4xl font-light text-white">Create your account.</h1><p className="mt-3 text-sm leading-6 text-white/38">Choose a secure password to accept your invitation.</p>{token ? <AcceptInviteForm token={token} /> : <p className="mt-8 rounded-xl border border-red-400/20 p-4 text-sm text-red-200/75">This invitation link is incomplete.</p>}<Link href="/login" className="mt-6 block text-center text-xs text-white/35 hover:text-white">Return to sign in</Link></section></main>;
}
