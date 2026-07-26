import { notFound } from "next/navigation";
import { getReferralTestPreview } from "@/lib/referrals/test-preview";
import ReferralForm from "../../[token]/ReferralForm";

export const dynamic = "force-dynamic";

export default async function ReferralTestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getReferralTestPreview(token);
  if (!preview) notFound();
  const campaign = preview.campaign;
  return <main className="min-h-screen bg-[#0b0b0a] text-white">
    <div role="status" className="border-b border-amber-200/20 bg-amber-200/[0.07] px-5 py-4 text-center text-xs font-semibold uppercase tracking-[.15em] text-amber-100">Test Preview · No live campaign activity will be recorded</div>
    <section className="relative overflow-hidden border-b border-white/[0.08] px-5 py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(200,95,40,.13),transparent_38%)]" />
      <div className="relative mx-auto max-w-4xl text-center"><p className="eyebrow text-[var(--helios-orange)]">A Helios introduction</p><h1 className="mx-auto mt-6 max-w-3xl font-serif text-4xl font-normal leading-tight sm:text-6xl">{campaign.landingHeadline}</h1><p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-white/50 sm:text-base">{campaign.landingBody}</p>{campaign.referralOffer && <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.06] p-5"><p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">Referral offer</p><p className="mt-3 text-sm leading-6 text-white/65">{campaign.referralOffer}</p></div>}<p className="mt-7 text-xs text-white/30">Test advocate: Jake · Code HEL-TESTONLY</p></div>
    </section>
    <section className="px-5 py-16 sm:py-24"><div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[.72fr_1.28fr]"><aside><p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">Test the introduction</p><h2 className="mt-4 font-serif text-3xl font-normal">Preview the complete referral form.</h2><p className="mt-5 text-sm leading-7 text-white/40">The form validates normally, but its final submission is intercepted and never enters production.</p><div className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-xs leading-6 text-white/30">{campaign.privacyNotice}</div></aside><ReferralForm token={token} testMode /></div></section>
    <section className="border-t border-white/[0.08] px-5 py-12"><div className="mx-auto max-w-4xl"><details><summary className="cursor-pointer text-xs uppercase tracking-[.16em] text-white/35">Campaign terms</summary><p className="mt-4 whitespace-pre-wrap text-xs leading-6 text-white/30">{campaign.terms}</p></details></div></section>
  </main>;
}
