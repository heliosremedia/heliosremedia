"use client";

import { useRef, useState } from "react";
import { resendInvitationId, resendUnavailable, type ResendDelivery } from "@/lib/events/resend-core";

type ResendEvent = { id: string; title: string; status: string; startsAt: string | null; deliveries?: ResendDelivery[] };
type Recipient = { id: string; email?: string; displayName?: string };
const button = "rounded-lg border border-white/15 px-3 py-2 text-xs text-white/75 hover:border-white/40 focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] disabled:cursor-not-allowed disabled:opacity-40";

export default function ResendInvitation<T extends ResendEvent>({event,recipient,disabled,onChange}: {event:T;recipient:Recipient;disabled:boolean;onChange:(event:T)=>void}) {
  const [confirming,setConfirming] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const pending = useRef(false);
  const requestId = useRef("");
  const unavailable = !recipient.email ? "This guest has no saved email address." : resendUnavailable(event,recipient.id);
  const latest = (event.deliveries || []).filter(delivery=>resendInvitationId(delivery.stage)===recipient.id).sort((a,b)=>+new Date(b.scheduledAt)-+new Date(a.scheduledAt))[0];
  const status = latest?.messages?.[0]?.status;
  const deliveryNote = !latest ? "" : status === "SENT" ? "Resend accepted by email provider" : status === "UNCERTAIN" || latest.status === "FAILED" ? "Resend needs delivery review" : status === "SKIPPED" ? "Resend skipped: event or guest no longer eligible" : latest.status === "CANCELLED" ? "Resend cancelled" : latest.status === "SCHEDULED" ? "Resend queued" : "Resend completed";
  async function send() {
    if (pending.current || disabled || unavailable || !confirming) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      // Keep the same logical request after a lost response. The server also serializes
      // concurrent tabs, blocks pending/uncertain work, and enforces a ten-minute cooldown.
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const response = await fetch(`/api/admin/events/${event.id}/resend`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({invitationId:recipient.id,recipientEmail:recipient.email,requestId:requestId.current,confirm:true})});
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The resend could not be confirmed. Retry this same request or refresh before starting another.");
      if (data.event?.id === event.id) onChange(data.event);
      requestId.current = ""; setConfirming(false); setMessage(data.message);
    } catch (error) { setError(error instanceof Error ? error.message : "The resend could not be confirmed. Please refresh."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-3 w-full">
    {!confirming ? <button type="button" className={button} disabled={disabled || !!unavailable} title={unavailable || "Send another invitation only to this guest"} aria-label={`Resend invite to ${recipient.displayName || recipient.email || "guest"}`} onClick={()=>{setConfirming(true);setMessage("");}}>Resend invite</button> : <div role="group" aria-label="Confirm individual invitation resend" className="rounded-xl border border-orange-300/20 bg-orange-300/5 p-3">
      <p className="text-sm text-white/85">Resend “{event.title}” to <strong className="break-all">{recipient.email}</strong> only?</p>
      <p className="mt-2 text-xs leading-5 text-white/55">This sends another copy of the invitation on the next delivery run. Their RSVP and guest count stay unchanged. No other guest will receive it.</p>
      {unavailable && <p className="mt-2 text-xs text-amber-200">{unavailable}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${button} border-orange-300/40 text-orange-200`} disabled={disabled || busy || !!unavailable} onClick={()=>void send()}>{busy ? "Queuing…" : "Confirm resend"}</button><button type="button" className={button} disabled={busy} onClick={()=>{setConfirming(false);setError("");}}>Cancel</button></div>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-200">{error}</p>}
    {message && <p role="status" className="mt-2 text-xs leading-5 text-emerald-200">{message}</p>}
    {!message && deliveryNote && <p className="mt-2 text-xs text-white/45">{deliveryNote}</p>}
  </div>;
}
