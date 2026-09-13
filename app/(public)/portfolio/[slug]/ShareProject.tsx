"use client";

import { useEffect,useRef,useState } from "react";

export default function ShareProject({ url, title, summary, projectId }: { url: string; title: string; summary: string; projectId: string }) {
  const [open,setOpen]=useState(false); const [copied,setCopied]=useState(false); const rootRef=useRef<HTMLDivElement>(null); const triggerRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;function close(event:MouseEvent){if(!rootRef.current?.contains(event.target as Node))setOpen(false);}function key(event:KeyboardEvent){if(event.key==="Escape"){setOpen(false);triggerRef.current?.focus();}}document.addEventListener("mousedown",close);document.addEventListener("keydown",key);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",key);};},[open]);
  function track(method:string){ window.dispatchEvent(new CustomEvent("helios:portfolio-analytics",{detail:{eventName:"PROJECT_SHARE",projectId,channel:method,target:url}})); }
  async function copy(){try{await navigator.clipboard.writeText(url);}catch{const field=document.createElement("textarea");field.value=url;document.body.append(field);field.select();document.execCommand("copy");field.remove();}setCopied(true);setOpen(false);track("copy");setTimeout(()=>setCopied(false),2500);}
  async function activate(){const mobile=window.matchMedia("(max-width: 767px)").matches;if(mobile&&navigator.share){try{await navigator.share({title,text:summary,url});track("native");return;}catch(error){if(error instanceof DOMException&&error.name==="AbortError")return;}}if(mobile){await copy();return;}setOpen(value=>!value);}
  const links=[
    ["Facebook",`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`],
    ["LinkedIn",`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`],
    ["X",`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`],
    ["Email",`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${summary}\n\n${url}`)}`],
  ];
  return <div ref={rootRef} className="relative inline-flex">
    <button ref={triggerRef} type="button" onClick={activate} aria-haspopup="menu" aria-expanded={open} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-3.5 py-2 text-[0.57rem] font-semibold uppercase tracking-[0.1em] text-white/55 transition hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>{copied?"Link copied":"Share project"}</button>
    {open&&<div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-white/10 bg-[#141414] p-2 shadow-2xl" role="menu" aria-label="Share project">{links.map(([label,href])=><a key={label} role="menuitem" href={href} target={label==="Email"?undefined:"_blank"} rel="noopener noreferrer" onClick={()=>{track(label.toLowerCase());setOpen(false);}} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-none" aria-label={`Share on ${label}`}><span aria-hidden="true" className="w-5 text-center text-xs font-semibold">{label==="Facebook"?"f":label==="LinkedIn"?"in":label==="X"?"𝕏":"✉"}</span>{label}</a>)}<button role="menuitem" type="button" onClick={copy} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-none"><span aria-hidden="true" className="w-5 text-center">⧉</span>Copy link</button></div>}
    <span className="sr-only" aria-live="polite">{copied?"Project link copied to clipboard":""}</span>
  </div>;
}
