"use client";
import { useRef, useState } from "react";

export default function CopyEventLink({eventId,disabled=false}:{eventId:string;disabled?:boolean}) {
  const pending = useRef(false);
  const [busy,setBusy] = useState(false);
  const [url,setUrl] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  async function copy() {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/share-link`,{method:"POST",cache:"no-store",referrerPolicy:"no-referrer"});
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "The invite link could not be created. Please try again.");
      const link = new URL(data.url,window.location.origin);
      if (![window.location.origin,"https://www.heliosrealestatemedia.com"].includes(link.origin) || link.pathname !== "/events/invite" || link.search || !/^#token=[A-Za-z0-9_-]{43}$/.test(link.hash)) throw new Error("The invite link could not be verified. Please try again.");
      setUrl(link.href);
      try { await navigator.clipboard.writeText(link.href); setMessage("Invite link copied."); }
      catch { setMessage("Select and copy the invite link below."); }
    } catch(e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { pending.current=false; setBusy(false); }
  }
  return <div className="space-y-2"><button type="button" disabled={disabled || busy} onClick={()=>void copy()} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/80 disabled:opacity-40">{busy ? "Preparing link…" : "Copy Invite Link"}</button><p className="text-xs leading-5 text-white/50">Anyone with this link can view the event and register their own RSVP. Share only with people you want to invite. It does not share any guest’s personal RSVP link.</p>{message && <p role="status" className="text-xs text-emerald-200">{message}</p>}{error && <p role="alert" className="text-xs text-red-200">{error}</p>}{url && <label className="block text-xs text-white/60">Shareable event invite link<input aria-label="Shareable event invite link" readOnly value={url} onFocus={e=>e.currentTarget.select()} onClick={e=>e.currentTarget.select()} className="mt-2 block w-full rounded-lg border border-white/20 bg-black/20 p-3 text-sm text-white" /></label>}</div>;
}
