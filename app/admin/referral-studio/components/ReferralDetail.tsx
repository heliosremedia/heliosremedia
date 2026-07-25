"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const statuses = ["SUBMITTED", "CONTACTED", "QUALIFIED", "BOOKED", "COMPLETED", "REWARD_ELIGIBLE", "REWARD_ISSUED", "DISQUALIFIED", "DECLINED", "DUPLICATE", "CANCELLED", "NEEDS_REVIEW"];

type ReferralRecord = {
  id: string; campaignId: string; firstName: string; lastName: string; email: string; phone: string | null;
  status: string; attributionStatus: string; attributionReason: string | null; preferredContactMethod: string;
  submittedBy: string; consentedAt: string; message: string | null; inquiryId: string | null;
  matchedClientId: string | null; externalOrderId: string | null;
  campaign: { internalName: string; publicTitle: string };
  advocate: { client: { displayName: string } } | null;
  inquiry: { id: string } | null;
  matchedClient: { displayName: string } | null;
  rewards: Array<{ id: string; status: string; type: string; value: string | null; fulfillmentNotes: string | null; externalReference: string | null; issuedAt: string | null }>;
  statusEvents: Array<{ id: string; fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }>;
};

export default function ReferralDetail({ submissionId }: { submissionId: string }) {
  const [referral, setReferral] = useState<ReferralRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/referrals/submissions/${submissionId}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Referral could not be loaded.");
    setReferral(result.referral);
  }, [submissionId]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/referrals/submissions/${submissionId}`, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Referral could not be loaded.");
      if (active) setReferral(result.referral);
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Referral could not be loaded."); });
    return () => { active = false; };
  }, [submissionId]);
  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/referrals/submissions/${submissionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: data.get("status"), reason: data.get("reason") }) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Referral could not be updated.");
      setMessage(result.message); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Referral could not be updated."); }
    finally { setBusy(false); }
  }
  async function linkRecords(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/referrals/submissions/${submissionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", inquiryId: data.get("inquiryId"), clientId: data.get("clientId"), externalOrderId: data.get("externalOrderId") }) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Relationships could not be updated.");
      setMessage(result.message); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Relationships could not be updated."); }
    finally { setBusy(false); }
  }
  async function updateReward(event: React.FormEvent<HTMLFormElement>, rewardId: string) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/referrals/rewards/${rewardId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data.entries())) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Reward could not be updated.");
      setMessage(result.message); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reward could not be updated."); }
    finally { setBusy(false); }
  }
  if (!referral) return <div className="h-72 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.02]" />;
  return <div className="space-y-6">
    <header className="border-b border-white/[0.08] pb-7"><Link href={`/admin/referral-studio/campaigns/${referral.campaignId}`} className="text-xs text-white/35">← {referral.campaign.internalName}</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-light text-white sm:text-4xl">{referral.firstName} {referral.lastName}</h1><span className="rounded-full border border-white/10 px-2.5 py-1 text-[0.54rem] uppercase tracking-[.14em] text-white/50">{referral.status.replaceAll("_", " ")}</span>{referral.attributionStatus === "NEEDS_REVIEW" && <span className="rounded-full border border-amber-200/20 px-2.5 py-1 text-[0.54rem] uppercase tracking-[.14em] text-amber-100">Attribution review</span>}</div></header>
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><h2 className="text-2xl font-light text-white">Referral record</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Item label="Email" value={referral.email} /><Item label="Phone" value={referral.phone} /><Item label="Preferred contact" value={referral.preferredContactMethod} /><Item label="Submitted by" value={referral.submittedBy} /><Item label="Advocate" value={referral.advocate?.client.displayName} /><Item label="Campaign" value={referral.campaign.publicTitle} /><Item label="Related inquiry" value={referral.inquiry?.id} /><Item label="Related client" value={referral.matchedClient?.displayName} /><Item label="External order" value={referral.externalOrderId} /><Item label="Consent recorded" value={new Date(referral.consentedAt).toLocaleString()} /></dl>{referral.attributionReason && <div className="mt-6 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4"><p className="text-[0.54rem] uppercase tracking-[.15em] text-amber-100/60">Attribution evidence</p><p className="mt-2 text-sm leading-6 text-amber-50/60">{referral.attributionReason}</p></div>}{referral.message && <div className="mt-6"><p className="text-[0.54rem] uppercase tracking-[.15em] text-white/25">Message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{referral.message}</p></div>}</section>
      <form onSubmit={update} className="h-fit rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><h2 className="text-2xl font-light text-white">Update pipeline</h2><label className="mt-6 block text-[0.56rem] uppercase tracking-[.15em] text-white/30">New status<select name="status" defaultValue={referral.status} className="admin-input mt-2 w-full">{statuses.map(status => <option key={status}>{status}</option>)}</select></label><label className="mt-5 block text-[0.56rem] uppercase tracking-[.15em] text-white/30">Reason or note<textarea name="reason" rows={4} className="admin-input mt-2 w-full" /></label><button disabled={busy} className="admin-btn-primary mt-5">{busy ? "Updating…" : "Update status"}</button></form>
    </div>
    <section className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={linkRecords} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><h2 className="text-2xl font-light text-white">Connected records</h2><p className="mt-3 text-sm leading-6 text-white/35">Connect without duplicating the existing inquiry, client, or future booking/order record.</p><label className="mt-5 block text-[0.56rem] uppercase tracking-[.15em] text-white/30">Inquiry ID<input name="inquiryId" defaultValue={referral.inquiryId || ""} className="admin-input mt-2 w-full" /></label><label className="mt-4 block text-[0.56rem] uppercase tracking-[.15em] text-white/30">Client ID<input name="clientId" defaultValue={referral.matchedClientId || ""} className="admin-input mt-2 w-full" /></label><label className="mt-4 block text-[0.56rem] uppercase tracking-[.15em] text-white/30">External booking/order reference<input name="externalOrderId" defaultValue={referral.externalOrderId || ""} className="admin-input mt-2 w-full" /></label><button disabled={busy} className="admin-btn-secondary mt-5">Save relationships</button></form>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><h2 className="text-2xl font-light text-white">Reward management</h2>{referral.rewards.length ? referral.rewards.map(reward => <form key={reward.id} onSubmit={event => updateReward(event, reward.id)} className="mt-5 space-y-4"><div className="flex items-center justify-between"><p className="text-sm text-white/60">{reward.type.replaceAll("_", " ")}</p><span className="text-[0.54rem] uppercase tracking-[.14em] text-white/35">{reward.status.replaceAll("_", " ")}</span></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-[0.52rem] uppercase tracking-[.14em] text-white/25">Reward type<select name="type" defaultValue={reward.type} className="admin-input mt-2 w-full">{["ACCOUNT_CREDIT", "PERCENTAGE_DISCOUNT", "FIXED_VALUE_GIFT", "COMPLIMENTARY_SERVICE", "CUSTOM", "NONE"].map(item => <option key={item}>{item}</option>)}</select></label><label className="text-[0.52rem] uppercase tracking-[.14em] text-white/25">Status<select name="status" defaultValue={reward.status} className="admin-input mt-2 w-full">{["NOT_ELIGIBLE", "PENDING_REVIEW", "ELIGIBLE", "APPROVED", "ISSUED", "DECLINED", "REVERSED"].map(item => <option key={item}>{item}</option>)}</select></label><label className="text-[0.52rem] uppercase tracking-[.14em] text-white/25">Value<input name="value" defaultValue={reward.value || ""} className="admin-input mt-2 w-full" /></label><label className="text-[0.52rem] uppercase tracking-[.14em] text-white/25">External reference<input name="externalReference" defaultValue={reward.externalReference || ""} className="admin-input mt-2 w-full" /></label></div><label className="block text-[0.52rem] uppercase tracking-[.14em] text-white/25">Fulfillment notes<textarea name="notes" defaultValue={reward.fulfillmentNotes || ""} rows={3} className="admin-input mt-2 w-full" /></label><button disabled={busy} className="admin-btn-primary">Update reward</button></form>) : <p className="mt-4 text-sm leading-6 text-white/35">A reward record is created only when this referral reaches Reward Eligible. Issuance always requires an administrator action.</p>}</div>
    </section>
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><h2 className="text-2xl font-light text-white">Status history</h2><div className="mt-5 divide-y divide-white/[0.06]">{referral.statusEvents.map(event => <div key={event.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm text-white/60">{event.fromStatus ? `${event.fromStatus.replaceAll("_", " ")} → ` : ""}{event.toStatus.replaceAll("_", " ")}</p><time className="text-xs text-white/25">{new Date(event.createdAt).toLocaleString()}</time></div><p className="mt-2 text-xs leading-5 text-white/35">{event.reason || "No reason recorded."}</p></div>)}</div></section>
  </div>;
}

function Item({ label, value }: { label: string; value?: string | null }) { return <div><dt className="text-[0.52rem] uppercase tracking-[.15em] text-white/25">{label}</dt><dd className="mt-2 text-sm text-white/60">{value || "Not linked"}</dd></div>; }
