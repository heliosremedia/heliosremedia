"use client";

import { useState } from "react";

export default function ShareProject({ url, title, summary }: { url: string; title: string; summary: string }) {
  const [open,setOpen]=useState(false); const [copied,setCopied]=useState(false);
  function track(method:string){ window.dispatchEvent(new CustomEvent("helios:project-share",{detail:{method,url}})); }
  async function nativeShare(){ if(!navigator.share)return setOpen(true); try{await navigator.share({title,text:summary,url});track("native");}catch{/* Visitor cancelled. */} }
  async function copy(){await navigator.clipboard.writeText(url);setCopied(true);track("copy");setTimeout(()=>setCopied(false),2500);}
  const links=[
    ["Facebook",`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ["LinkedIn",`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
    ["X",`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`],
    ["Email",`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${summary}\n\n${url}`)}`],
  ];
  return <div className="relative">
    <button type="button" onClick={()=>"share" in navigator?nativeShare():setOpen(value=>!value)} aria-expanded={open} className="inline-flex min-h-11 items-center rounded-full border border-white/12 px-4 text-[0.56rem] font-semibold uppercase tracking-[0.15em] text-white/50 transition hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]">Share project</button>
    {open&&<div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/10 bg-[#141414] p-2 shadow-2xl" role="menu">{links.map(([label,href])=><a key={label} href={href} target={label==="Email"?undefined:"_blank"} rel="noopener noreferrer" onClick={()=>track(label.toLowerCase())} className="block rounded-lg px-3 py-2.5 text-sm text-white/55 hover:bg-white/[0.06] hover:text-white" aria-label={`Share on ${label}`}>{label}</a>)}<button type="button" onClick={copy} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/55 hover:bg-white/[0.06] hover:text-white">{copied?"Link copied ✓":"Copy link"}</button></div>}
    <span className="sr-only" aria-live="polite">{copied?"Project link copied to clipboard":""}</span>
  </div>;
}
