"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const field = "referral-form-control mt-2 w-full";
const checkbox = "referral-form-checkbox";
const label = "text-[0.58rem] font-semibold uppercase tracking-[.16em] text-white/35";

type InitialCampaign = {
  id: string; rowVersion: number; status: string; internalName: string; publicTitle: string; purpose: string;
  audienceMode: string; audienceRules: { groupIds?: string[]; clientIds?: string[]; excludedClientIds?: string[]; filters?: { updatedWithinDays?: number | null } };
  referralOffer: string | null; advocateReward: string | null; referredCustomerOffer: string | null;
  eligibilityRules: string | null; qualificationRules: string | null; rewardInstructions: string | null; maxRewardsPerAdvocate: number | null;
  terms: string; senderName: string | null; senderEmail: string | null; replyTo: string | null;
  landingHeadline: string; landingBody: string; landingThankYou: string; privacyNotice: string;
  invitationSubject: string; invitationPreviewText: string | null; invitationBody: string;
  startsAt: string | null; endsAt: string | null; referralExpirationDays: number;
  followUpConfiguration: { enabled?: boolean; count?: number; delayDays?: number };
  communicationTemplates: Record<string, string | undefined>;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function CampaignBuilder({ adminEmail, initialClientId, initialCampaign }: { adminEmail: string; initialClientId: string; initialCampaign?: InitialCampaign }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [audience, setAudience] = useState<{ eligible: number; excluded: number } | null>(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [previousAiValues, setPreviousAiValues] = useState<Record<string, string> | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; displayName: string; email: string; emailSubscribed: boolean; emailStatus: string }>>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [rowVersion, setRowVersion] = useState(initialCampaign?.rowVersion ?? 0);
  const editing = Boolean(initialCampaign);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    let active = true;
    void fetch("/api/admin/referrals/options").then(async response => {
      const result = await response.json();
      if (response.ok && result.success && active) { setGroups(result.groups); setClients(result.clients); }
    });
    return () => { active = false; };
  }, []);
  function applyValues(values: Record<string, string>) {
    const form = formRef.current;
    if (!form) return;
    for (const [name, value] of Object.entries(values)) {
      const control = form.elements.namedItem(name);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.value = value;
    }
  }
  async function ai(action: string) {
    if (!formRef.current || !aiBrief.trim()) { setMessage("Add a campaign brief before using AI."); return; }
    setAiBusy(true); setMessage(null);
    const names = ["publicTitle", "purpose", "referralOffer", "invitationSubject", "invitationBody", "followUpBody", "landingHeadline", "landingBody", "landingThankYou", "completionThankYouBody", "rewardEligibleBody", "terms"];
    const current = Object.fromEntries(names.map(name => {
      const control = formRef.current!.elements.namedItem(name);
      return [name, control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.value : ""];
    }));
    try {
      const response = await fetch("/api/admin/referrals/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, brief: aiBrief, existingConfiguration: current }) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || "AI drafting could not be completed.");
      setPreviousAiValues(current);
      applyValues({
        publicTitle: result.result.publicTitle, purpose: result.result.campaignConcept,
        referralOffer: result.result.referralOfferSuggestions.join("\n"),
        invitationSubject: result.result.invitationSubject, invitationBody: result.result.invitationBody,
        followUpBody: result.result.followUpBody, landingHeadline: result.result.landingHeadline,
        landingBody: result.result.landingBody, landingThankYou: result.result.referralConfirmation,
        completionThankYouBody: result.result.advocateThankYou, rewardEligibleBody: result.result.rewardNotification,
      });
      setMessage(result.result.warnings.length ? `AI draft applied with ${result.result.warnings.length} warning${result.result.warnings.length === 1 ? "" : "s"}: ${result.result.warnings.join(" ")}` : "AI draft applied. Review every field before saving.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "AI drafting could not be completed."); }
    finally { setAiBusy(false); }
  }
  async function payload(form: HTMLFormElement, action?: string) {
    const data = new FormData(form);
    return {
      action,
      internalName: data.get("internalName"), publicTitle: data.get("publicTitle"), purpose: data.get("purpose"),
      audienceMode: data.get("audienceMode"), groupIds: data.getAll("groupIds").map(String), clientIds: data.getAll("clientIds").map(String),
      excludedClientIds: String(data.get("excludedClientIds") || "").split(/[\s,]+/).filter(Boolean),
      filterUpdatedWithinDays: data.get("filterUpdatedWithinDays"),
      referralOffer: data.get("referralOffer"), advocateReward: data.get("advocateReward"), referredCustomerOffer: data.get("referredCustomerOffer"),
      eligibilityRules: data.get("eligibilityRules"), qualificationRules: data.get("qualificationRules"),
      rewardInstructions: data.get("rewardInstructions"), maxRewardsPerAdvocate: data.get("maxRewardsPerAdvocate"),
      terms: data.get("terms"), senderName: data.get("senderName"), senderEmail: data.get("senderEmail"), replyTo: data.get("replyTo"),
      landingHeadline: data.get("landingHeadline"), landingBody: data.get("landingBody"), landingThankYou: data.get("landingThankYou"),
      privacyNotice: data.get("privacyNotice"), invitationSubject: data.get("invitationSubject"),
      invitationPreviewText: data.get("invitationPreviewText"), invitationBody: data.get("invitationBody"),
      startsAt: data.get("startsAt"), endsAt: data.get("endsAt"), referralExpirationDays: data.get("referralExpirationDays"),
      followUpEnabled: data.get("followUpEnabled") === "on", followUpCount: data.get("followUpCount"), followUpDelayDays: data.get("followUpDelayDays"),
      followUpBody: data.get("followUpBody"), referralReceivedBody: data.get("referralReceivedBody"),
      referredPersonAcknowledgmentBody: data.get("referredPersonAcknowledgmentBody"),
      qualifiedUpdateBody: data.get("qualifiedUpdateBody"), completionThankYouBody: data.get("completionThankYouBody"),
      rewardEligibleBody: data.get("rewardEligibleBody"), rewardIssuedBody: data.get("rewardIssuedBody"),
    };
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const intent = (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement
      ? ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement).value
      : "save";
    setBusy(true); setMessage(null);
    try {
      const requestPayload = { ...await payload(event.currentTarget), rowVersion };
      const response = await fetch(editing ? `/api/admin/referrals/campaigns/${initialCampaign!.id}` : "/api/admin/referrals", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Campaign could not be saved.");
      const campaignId = initialCampaign?.id || result.campaignId;
      if (result.campaign?.rowVersion !== undefined) setRowVersion(result.campaign.rowVersion);
      setDirty(false);
      if (intent === "review") router.push(`/admin/referral-studio/campaigns/${campaignId}?tab=Approval`);
      else if (!editing) router.push(`/admin/referral-studio/campaigns/${campaignId}`);
      else { setMessage("Draft campaign saved."); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Campaign could not be saved."); }
    finally { setBusy(false); }
  }
  function cancel() {
    if (dirty && !window.confirm("Discard your unsaved campaign changes?")) return;
    router.push(initialCampaign ? `/admin/referral-studio/campaigns/${initialCampaign.id}` : "/admin/referral-studio");
  }
  async function estimate(form: HTMLFormElement) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await payload(form, "estimate")) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Audience could not be estimated.");
      setAudience({ eligible: result.data.eligible.length, excluded: result.data.excluded.length });
      setMessage(`${result.data.eligible.length} eligible advocates; ${result.data.excluded.length} excluded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Audience could not be estimated."); }
    finally { setBusy(false); }
  }
  return <form ref={formRef} onSubmit={submit} onChange={() => setDirty(true)} className="referral-campaign-builder space-y-7">
    <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow text-[var(--helios-orange)]">Referral Studio</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">{editing ? "Edit campaign" : "Create campaign"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Shape the offer, choose a deliberate audience, and prepare every touchpoint before approval.</p></div>
      <button type="button" onClick={cancel} className="admin-btn-link">Back to campaign</button>
    </header>
    {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">{message}</p>}
    <section className="rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.035] p-5 sm:p-7"><p className="text-[0.56rem] font-semibold uppercase tracking-[.18em] text-[var(--helios-orange)]">AI campaign assistant</p><h2 className="mt-2 text-2xl font-light text-white">Prepare an editable starting point</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">AI uses verified Helios services and your brief. It cannot approve, enroll, send, issue rewards, or invent commercial terms and client history.</p><textarea value={aiBrief} onChange={event => setAiBrief(event.target.value)} rows={4} placeholder="Describe the campaign goal, confirmed offer, reward, audience, timing, and any non-negotiable terms." className={`${field} mt-5`} /><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={aiBusy} onClick={() => ai("GENERATE")} className="admin-btn-primary">{aiBusy ? "Generating…" : "Generate campaign"}</button>{["REWRITE", "SHORTEN", "MORE_PERSONAL", "MORE_PROFESSIONAL", "REGENERATE"].map(action => <button key={action} type="button" disabled={aiBusy} onClick={() => ai(action)} className="admin-btn-secondary">{action.replaceAll("_", " ").toLowerCase()}</button>)}{previousAiValues && <button type="button" onClick={() => applyValues(previousAiValues)} className="admin-btn-link">Restore previous version</button>}</div></section>
    <Section eyebrow="01 · Foundation" title="Campaign identity">
      <Grid><Input name="internalName" title="Internal campaign name" required defaultValue={initialCampaign?.internalName} /><Input name="publicTitle" title="Public campaign title" required defaultValue={initialCampaign?.publicTitle} /><TextArea name="purpose" title="Purpose" required wide defaultValue={initialCampaign?.purpose} /></Grid>
    </Section>
    <Section eyebrow="02 · Audience" title="Choose who may be invited">
      <p className="mb-5 max-w-3xl text-sm leading-6 text-white/40">Selecting no audience never means everyone. Choose specific clients/groups or explicitly select All eligible clients.</p>
      <Grid>
        <label className={label}>Audience mode<select name="audienceMode" className={field} defaultValue={initialCampaign?.audienceMode || "INDIVIDUALS"}><option value="INDIVIDUALS">Individual clients</option><option value="GROUPS">Client groups</option><option value="FILTERED">Dynamic filters</option><option value="ALL_ELIGIBLE">All eligible clients</option></select></label>
        <Input name="excludedClientIds" title="Excluded client IDs" defaultValue={initialCampaign?.audienceRules.excludedClientIds?.join(", ")} />
        <Input name="filterUpdatedWithinDays" title="Dynamic filter: client updated within days" type="number" defaultValue={initialCampaign?.audienceRules.filters?.updatedWithinDays ?? 365} />
      </Grid>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><div><p className={label}>Client groups</p><div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-xl border border-white/[0.08] p-3">{groups.map(group => <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm text-white/55 hover:bg-white/[0.03]"><input type="checkbox" name="groupIds" value={group.id} defaultChecked={initialCampaign?.audienceRules.groupIds?.includes(group.id)} className={checkbox} /><span className="min-w-0 flex-1 truncate">{group.name}</span><span className="text-xs text-white/25">{group.count}</span></label>)}{!groups.length && <p className="p-2 text-xs text-white/30">No groups available.</p>}</div></div><div><label className={label}>Individual clients<input value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Search by name or email" className={field} /></label><div className="mt-2 max-h-72 space-y-2 overflow-auto rounded-xl border border-white/[0.08] p-3">{clients.filter(client => `${client.displayName} ${client.email}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 100).map(client => <label key={client.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-sm text-white/55 hover:bg-white/[0.03]"><input type="checkbox" name="clientIds" value={client.id} defaultChecked={client.id === initialClientId || initialCampaign?.audienceRules.clientIds?.includes(client.id)} disabled={!client.emailSubscribed || client.emailStatus !== "VALID"} className={checkbox} /><span className="min-w-0 flex-1"><span className="block truncate">{client.displayName}</span><span className="block truncate text-xs text-white/25">{client.email}</span></span>{(!client.emailSubscribed || client.emailStatus !== "VALID") && <span className="text-[0.5rem] uppercase tracking-[.1em] text-amber-100/60">Ineligible</span>}</label>)}</div></div></div>
      <div className="mt-5 flex items-center gap-4"><button type="button" className="admin-btn-secondary" disabled={busy} onClick={event => estimate(event.currentTarget.form!)}>Check audience</button>{audience && <p className="text-sm text-white/45">{audience.eligible} eligible · {audience.excluded} excluded</p>}</div>
    </Section>
    <Section eyebrow="03 · Offer & rules" title="Set clear expectations">
      <Grid>
        <TextArea name="referralOffer" title="Referral offer" defaultValue={initialCampaign?.referralOffer || ""} /><TextArea name="advocateReward" title="Advocate reward" defaultValue={initialCampaign?.advocateReward || ""} />
        <TextArea name="referredCustomerOffer" title="Referred-customer offer" defaultValue={initialCampaign?.referredCustomerOffer || ""} /><Input name="maxRewardsPerAdvocate" title="Maximum rewards per advocate" type="number" defaultValue={initialCampaign?.maxRewardsPerAdvocate ?? 1} />
        <TextArea name="eligibilityRules" title="Eligibility rules" defaultValue={initialCampaign?.eligibilityRules || ""} /><TextArea name="qualificationRules" title="Qualification requirements" defaultValue={initialCampaign?.qualificationRules || ""} />
        <TextArea name="rewardInstructions" title="Reward fulfillment instructions" defaultValue={initialCampaign?.rewardInstructions || ""} /><TextArea name="terms" title="Campaign terms" required defaultValue={initialCampaign?.terms} />
      </Grid>
    </Section>
    <Section eyebrow="04 · Timing & sender" title="Delivery details">
      <Grid>
        <Input name="startsAt" title="Start date" type="datetime-local" defaultValue={localDateTime(initialCampaign?.startsAt || null)} /><Input name="endsAt" title="End date" type="datetime-local" defaultValue={localDateTime(initialCampaign?.endsAt || null)} />
        <Input name="referralExpirationDays" title="Referral expiration (days)" type="number" defaultValue={initialCampaign?.referralExpirationDays ?? 90} />
        <Input name="senderName" title="Default sender" defaultValue={initialCampaign?.senderName || "Helios Real Estate Media"} />
        <Input name="senderEmail" title="Sender email" type="email" defaultValue={initialCampaign?.senderEmail || ""} /><Input name="replyTo" title="Reply-to address" type="email" defaultValue={initialCampaign?.replyTo || adminEmail} />
      </Grid>
    </Section>
    <Section eyebrow="05 · Invitation" title="Advocate message">
      <p className="mb-5 text-sm text-white/35">Available personalization: {"{{first_name}}"}, {"{{campaign_title}}"}, {"{{referral_link}}"}, and {"{{referral_code}}"}.</p>
      <Grid><Input name="invitationSubject" title="Invitation subject" required defaultValue={initialCampaign?.invitationSubject || "{{first_name}}, a thoughtful way to share Helios"} /><Input name="invitationPreviewText" title="Preview text" defaultValue={initialCampaign?.invitationPreviewText || ""} /><TextArea name="invitationBody" title="Invitation message" required wide defaultValue={initialCampaign?.invitationBody || "Hi {{first_name}},\n\nWe’re grateful for the trust you place in Helios. If someone in your world could benefit from intentional real estate media, you can introduce them through your private referral link below.\n\nThere is never any pressure—only an easy way to make a thoughtful connection."} /></Grid>
    </Section>
    <Section eyebrow="06 · Public experience" title="Referral landing page">
      <Grid><Input name="landingHeadline" title="Landing-page headline" required defaultValue={initialCampaign?.landingHeadline || "A thoughtful introduction"} /><TextArea name="landingBody" title="Landing-page copy" required defaultValue={initialCampaign?.landingBody} /><TextArea name="landingThankYou" title="Success confirmation" required defaultValue={initialCampaign?.landingThankYou || "Thank you. Your introduction has been received, and the Helios team will follow up thoughtfully."} /><TextArea name="privacyNotice" title="Privacy notice" required defaultValue={initialCampaign?.privacyNotice || "Helios uses the information submitted here only to respond to this referral and manage the referral program. We do not publish or sell personal information."} /></Grid>
    </Section>
    <Section eyebrow="07 · Follow-up" title="Conservative follow-up">
      <div className="flex items-center gap-3"><input id="followUpEnabled" name="followUpEnabled" type="checkbox" defaultChecked={initialCampaign?.followUpConfiguration.enabled} className={checkbox} /><label htmlFor="followUpEnabled" className="text-sm text-white/60">Enable approved follow-up for advocates who have not submitted a referral</label></div>
      <Grid extra="mt-5"><Input name="followUpCount" title="Number of follow-ups" type="number" defaultValue={initialCampaign?.followUpConfiguration.count ?? 1} /><Input name="followUpDelayDays" title="Delay between messages (days)" type="number" defaultValue={initialCampaign?.followUpConfiguration.delayDays ?? 7} /><TextArea name="followUpBody" title="Follow-up message" wide defaultValue={initialCampaign?.communicationTemplates.followUp || ""} /></Grid>
    </Section>
    <Section eyebrow="08 · Communications" title="Status and thank-you templates">
      <Grid><TextArea name="referralReceivedBody" title="Advocate referral received" defaultValue={initialCampaign?.communicationTemplates.referralReceived || ""} /><TextArea name="referredPersonAcknowledgmentBody" title="Referred-person acknowledgment" defaultValue={initialCampaign?.communicationTemplates.referredPersonAcknowledgment || ""} /><TextArea name="qualifiedUpdateBody" title="Qualified-referral update" defaultValue={initialCampaign?.communicationTemplates.qualifiedUpdate || ""} /><TextArea name="completionThankYouBody" title="Booking/completion thank-you" defaultValue={initialCampaign?.communicationTemplates.completionThankYou || ""} /><TextArea name="rewardEligibleBody" title="Reward-eligible notification" defaultValue={initialCampaign?.communicationTemplates.rewardEligible || ""} /><TextArea name="rewardIssuedBody" title="Reward-issued confirmation" defaultValue={initialCampaign?.communicationTemplates.rewardIssued || ""} /></Grid>
    </Section>
    <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111]/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-end"><button type="button" onClick={cancel} disabled={busy} className="admin-btn-link">Cancel</button>{editing && <button type="submit" value="review" disabled={busy} className="admin-btn-secondary">Review Campaign</button>}<button type="submit" value="save" disabled={busy} className="admin-btn-primary">{busy ? "Saving…" : editing ? "Save Draft" : "Create draft campaign"}</button></div>
  </form>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"><p className="text-[0.56rem] font-semibold uppercase tracking-[.18em] text-[var(--helios-orange)]">{eyebrow}</p><h2 className="mt-2 text-2xl font-light text-white">{title}</h2><div className="mt-6">{children}</div></section>; }
function Grid({ children, extra = "" }: { children: React.ReactNode; extra?: string }) { return <div className={`grid gap-5 md:grid-cols-2 ${extra}`}>{children}</div>; }
function Input({ title, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { title: string }) { return <label className={label}>{title}<input {...props} className={field} /></label>; }
function TextArea({ title, wide, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { title: string; wide?: boolean }) { return <label className={`${label} ${wide ? "md:col-span-2" : ""}`}>{title}<textarea {...props} rows={5} className={field} /></label>; }
