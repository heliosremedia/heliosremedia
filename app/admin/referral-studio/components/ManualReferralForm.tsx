"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ManualReferralForm() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Array<{ id: string; internalName: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/referrals?days=365").then(async response => {
      const result = await response.json();
      if (response.ok && result.success && active) setCampaigns(result.data.campaigns);
    });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/admin/referrals/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "Referral could not be created.");
      router.push(`/admin/referral-studio/referrals/${result.referralId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Referral could not be created."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6"><header className="border-b border-white/[0.08] pb-7"><Link href="/admin/referral-studio" className="text-xs text-white/35">← Referral Studio</Link><p className="eyebrow mt-5 text-[var(--helios-orange)]">Manual attribution</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Add manual referral</h1><p className="mt-3 text-sm leading-6 text-white/40">Manual entries start in Needs Review. They do not assert marketing consent or silently select an advocate.</p></header>{message && <p role="alert" className="text-sm text-red-100">{message}</p>}<section className="grid gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:grid-cols-2 sm:p-7"><Field title="Campaign"><select name="campaignId" required className="admin-input mt-2 w-full"><option value="">Choose campaign</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.internalName}</option>)}</select></Field><Input title="Advocate ID (optional)" name="advocateId" /><Input title="First name" name="firstName" required /><Input title="Last name" name="lastName" required /><Input title="Email" name="email" type="email" required /><Input title="Phone" name="phone" /><Field title="Preferred contact"><select name="preferredContactMethod" className="admin-input mt-2 w-full"><option>EMAIL</option><option>PHONE</option><option>TEXT</option></select></Field><Field title="Internal context"><textarea name="message" rows={4} className="admin-input mt-2 w-full" /></Field></section><div className="flex justify-end"><button disabled={busy} className="admin-btn-primary">{busy ? "Creating…" : "Create review record"}</button></div></form>;
}

function Field({ title, children }: { title: string; children: React.ReactNode }) { return <label className="text-[0.56rem] uppercase tracking-[.15em] text-white/30">{title}{children}</label>; }
function Input({ title, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { title: string }) { return <Field title={title}><input {...props} className="admin-input mt-2 w-full" /></Field>; }
