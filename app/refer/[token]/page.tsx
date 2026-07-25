import { notFound } from "next/navigation";
import { recordReferralVisit } from "@/lib/referrals/public";
import ReferralForm from "./ReferralForm";

export const dynamic = "force-dynamic";

export default async function PublicReferralPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await recordReferralVisit(token);
  if (!result) notFound();
  if (result.expired) return <main className="min-h-screen bg-[#0b0b0a] px-5 py-24 text-white"><div className="mx-auto max-w-xl text-center"><p className="eyebrow text-[var(--helios-orange)]">Helios Referral Studio</p><h1 className="mt-5 font-serif text-4xl font-normal">This invitation has expired</h1><p className="mt-5 text-sm leading-7 text-white/45">Thank you for thinking of Helios. Please contact our team directly if you would still like to make an introduction.</p></div></main>;
  const { campaign, advocate } = result.link;
  return <main className="min-h-screen bg-[#0b0b0a] text-white">
    <section className="relative overflow-hidden border-b border-white/[0.08] px-5 py-20 sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(200,95,40,.13),transparent_38%)]" />
      <div className="relative mx-auto max-w-4xl text-center"><p className="eyebrow text-[var(--helios-orange)]">A Helios introduction</p><h1 className="mx-auto mt-6 max-w-3xl font-serif text-4xl font-normal leading-tight sm:text-6xl">{campaign.landingHeadline}</h1><p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-white/50 sm:text-base">{campaign.landingBody}</p>{campaign.referralOffer && <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.06] p-5"><p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">Referral offer</p><p className="mt-3 text-sm leading-6 text-white/65">{campaign.referralOffer}</p></div>}<p className="mt-7 text-xs text-white/30">Shared thoughtfully by {advocate.client.firstName} · Code {result.link.code}</p><a href={`/api/referrals/${encodeURIComponent(token)}/qr`} className="mt-4 inline-block text-xs text-white/35 underline decoration-white/20 underline-offset-4 transition hover:text-white">Download referral QR code</a></div>
    </section>
    <section className="px-5 py-16 sm:py-24"><div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[.72fr_1.28fr]"><aside><p className="text-[0.56rem] uppercase tracking-[.18em] text-[var(--helios-orange)]">Make the introduction</p><h2 className="mt-4 font-serif text-3xl font-normal">Tell us who we should connect with.</h2><p className="mt-5 text-sm leading-7 text-white/40">We collect only what the Helios team needs to respond thoughtfully. The person completing this form must confirm the appropriate consent statement.</p><div className="mt-8 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 text-xs leading-6 text-white/30">{campaign.privacyNotice}</div></aside><ReferralForm token={token} /></div></section>
    <section className="border-t border-white/[0.08] px-5 py-12"><div className="mx-auto max-w-4xl"><details className="group"><summary className="cursor-pointer list-none text-xs uppercase tracking-[.16em] text-white/35">Campaign terms <span aria-hidden="true" className="ml-2">+</span></summary><p className="mt-4 whitespace-pre-wrap text-xs leading-6 text-white/30">{campaign.terms}</p></details></div></section>
  </main>;
}
