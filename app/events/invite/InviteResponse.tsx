"use client";
import { useEffect, useRef, useState } from "react";
import { getEventTheme } from "@/lib/events/themes";
import EventMotif from "../EventMotif";
import { MAX_ADDITIONAL_GUESTS, parseAdditionalGuests, rsvpPartySummary, type RsvpChoice } from "../rsvp/response-helpers";
type EventDetails = {title:string;description:string;location:string;startsAt:string;endsAt:string|null;timeZone:string;templateKey?:string;imageUrl?:string|null;imageAlt?:string|null;venueUrl?:string|null};
type Registration = {token:string;registrationToken:string;name:string;email:string;response:RsvpChoice;additionalGuests:number};
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
function newRegistrationToken() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function safeWebUrl(value?:string|null) { try { const url=new URL(value || ""); return ["http:","https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } }
export default function InviteResponse() {
  const token=useRef(""); const registrationToken=useRef(""); const submitting=useRef(false); const attempt=useRef<Registration|null>(null);
  const [event,setEvent]=useState<EventDetails|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [uncertain,setUncertain]=useState(false);
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [choice,setChoice]=useState<RsvpChoice|"">(""); const [guests,setGuests]=useState("0"); const [error,setError]=useState("");
  const [saved,setSaved]=useState<{response:RsvpChoice;additionalGuests:number;url:string}|null>(null);
  useEffect(()=>{
    if (!token.current) { const value=new URLSearchParams(window.location.hash.slice(1)).get("token") || ""; token.current=tokenPattern.test(value) ? value : ""; }
    window.history.replaceState(null,"",window.location.pathname);
    if (!token.current) { setError("This invite link is missing or incomplete. Please ask the host for a new link."); setLoading(false); return; }
    const controller=new AbortController();
    fetch("/api/events/invite",{headers:{Authorization:`Bearer ${token.current}`},cache:"no-store",referrerPolicy:"no-referrer",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok || !data.success)throw new Error("This event invitation is no longer available. Please contact the host.");return data;}).then(data=>{if(!controller.signal.aborted)setEvent(data.event);}).catch(()=>{if(!controller.signal.aborted)setError("This event invitation could not be opened. Please reopen the original link or contact the host.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[]);
  async function submit() {
    if(submitting.current || busy || saved || !event) return;
    if(!attempt.current) {
      const count=parseAdditionalGuests(choice,guests);
      if(!choice || !name.trim() || !email.trim() || count===null) {setError(`Enter your name, email, response, and a whole guest count from 0 to ${MAX_ADDITIONAL_GUESTS}.`);return;}
      if(!registrationToken.current)registrationToken.current=newRegistrationToken();
      attempt.current={token:token.current,registrationToken:registrationToken.current,name:name.trim(),email:email.trim(),response:choice,additionalGuests:count};
    }
    submitting.current=true;setBusy(true);setError("");
    try {
      const response=await fetch("/api/events/invite",{method:"POST",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify(attempt.current)});
      const data=await response.json();
      if(response.status===409){attempt.current=null;setUncertain(false);setError("This email cannot register through this shared link. Please use your original invitation or contact the host.");return;}
      if(!response.ok || !data.success) {
        if(response.status===400 || response.status===410 || response.status===403) {attempt.current=null;setUncertain(false);setError("Your RSVP could not be saved. Check your details or contact the host.");return;}
        throw new Error("Unconfirmed response");
      }
      const url=new URL(data.rsvpUrl,window.location.origin);
      if(![window.location.origin,"https://www.heliosrealestatemedia.com"].includes(url.origin) || url.pathname!=="/events/rsvp" || url.search || !/^#token=[A-Za-z0-9_-]{43}$/.test(url.hash))throw new Error("Invalid personal link");
      setSaved({response:data.response,additionalGuests:data.additionalGuests,url:url.href});setUncertain(false);
    } catch {setUncertain(true);setError("We could not confirm whether your RSVP was saved. Retry the same RSVP below; this will not create a duplicate. Keep this page open.");}
    finally {submitting.current=false;setBusy(false);}
  }
  const theme=getEventTheme(event?.templateKey);
  const format=(value:string)=>new Intl.DateTimeFormat("en-US",{timeZone:event?.timeZone,dateStyle:"full",timeStyle:"short"}).format(new Date(value));
  const fieldStyle={borderColor:theme.border,background:theme.background,color:theme.text};
  return <main className="min-h-screen px-4 py-10 sm:py-16" style={{background:theme.background,color:theme.text}}><div className="mx-auto max-w-2xl"><p className="text-center text-xs uppercase tracking-[0.3em]" style={{color:theme.accent}}>Helios · You’re invited</p><div className="mt-6 overflow-hidden rounded-3xl border" style={{borderColor:theme.border,background:theme.surface}}>
    {safeWebUrl(event?.imageUrl) && <>{/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={safeWebUrl(event?.imageUrl)} alt={event?.imageAlt || event?.title || ""} referrerPolicy="no-referrer" className="h-auto w-full" /></>}
    <div className="p-6 sm:p-10">{loading && <p role="status">Opening the invitation…</p>}{error && <p role="alert" className="mb-5 rounded-xl border border-red-400/40 p-4 text-sm">{error}</p>}{event && <><div className="mb-6 flex items-center justify-between" style={{color:theme.accent}}><p className="text-xs uppercase tracking-widest">{theme.motif}</p><EventMotif templateKey={theme.key} className="h-16 w-24" /></div><h1 className="font-[family-name:var(--font-cormorant)] text-4xl sm:text-5xl" style={{color:theme.heading}}>{event.title}</h1><p className="mt-5 whitespace-pre-wrap text-sm leading-7">{event.description}</p><dl className="my-7 space-y-4 border-y py-6" style={{borderColor:theme.border}}><div><dt className="text-xs uppercase" style={{color:theme.muted}}>When</dt><dd className="mt-2 text-sm">{format(event.startsAt)}{event.endsAt && <span className="block">Until {format(event.endsAt)}</span>}<span className="block">{event.timeZone}</span></dd></div><div><dt className="text-xs uppercase" style={{color:theme.muted}}>Where</dt><dd className="mt-2 whitespace-pre-wrap text-sm">{event.location || "Details to follow"}{safeWebUrl(event.venueUrl) && <a href={safeWebUrl(event.venueUrl)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-2 block underline">Visit venue website ↗</a>}</dd></div></dl>
    {saved ? <section role="status" className="space-y-4 rounded-xl border p-5" style={{borderColor:theme.accent}}><h2 className="text-xl">{saved.response==="YES" ? "You’re on the guest list!" : saved.response==="MAYBE" ? "You’re down as a maybe." : "Thanks for letting us know."}</h2><p>{rsvpPartySummary(saved.response,saved.additionalGuests)}</p><p className="text-sm">Your RSVP is saved. Keep your personal link to change your response later. Don’t share it with other guests.</p><a href={saved.url} referrerPolicy="no-referrer" className="inline-block underline underline-offset-4">Manage my RSVP</a><label className="block text-xs">Your personal RSVP link<input aria-label="Your personal RSVP link" readOnly value={saved.url} onFocus={e=>e.currentTarget.select()} className="mt-2 w-full rounded border p-2" style={fieldStyle}/></label></section> : <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy || uncertain} className="space-y-5"><legend className="mb-4 text-2xl">RSVP to this event</legend><label className="block text-sm">Your name<input name="name" autoComplete="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded-xl border p-3" style={fieldStyle}/></label><label className="block text-sm">Your email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 block w-full rounded-xl border p-3" style={fieldStyle}/></label><div className="flex flex-wrap gap-4">{([ ["YES","Yes, I’ll be there"],["NO","No, I can’t make it"],["MAYBE","Maybe"] ] as const).map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="response" value={value} required checked={choice===value} onChange={()=>{setChoice(value);if(value==="NO")setGuests("0");}}/>{label}</label>)}</div>{(choice==="YES" || choice==="MAYBE") && <label className="block text-sm">Additional guests (not including you)<input name="additionalGuests" type="number" min={0} max={MAX_ADDITIONAL_GUESTS} step={1} required value={guests} onChange={e=>setGuests(e.target.value)} className="mt-2 block w-28 rounded-xl border p-3" style={fieldStyle}/><span className="mt-2 block text-xs">Choose 0 if it’s just you.</span></label>}</fieldset><button type="submit" disabled={busy || (!uncertain && !choice)} className="mt-6 w-full rounded-xl px-4 py-3 disabled:opacity-40" style={{background:theme.accent,color:theme.buttonText}}>{busy ? "Saving RSVP…" : uncertain ? "Retry same RSVP" : "Confirm RSVP"}</button><p className="mt-4 text-xs leading-5" style={{color:theme.muted}}>Your name, email and RSVP will be shared with the event host to manage this event. This does not subscribe you to marketing email. Already invited by email? Use your personal invitation instead.</p></form>}</>}</div></div></div></main>;
}
