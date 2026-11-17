"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
type TabId = "email" | "client-tools" | "delivery-health";
export default function EmailStudioTabs({children,clientTools,deliveryHealth,showClientTools=true}:{children:ReactNode;clientTools:ReactNode;deliveryHealth:ReactNode;showClientTools?:boolean}) {
  const [active,setActive] = useState<TabId>("email");
  const buttons = useRef<Partial<Record<TabId,HTMLButtonElement|null>>>({});
  const tabs:{id:TabId;label:string}[] = [{id:"email",label:"Email workspace"},...(showClientTools ? [{id:"client-tools" as const,label:"Client Tools"}] : []),{id:"delivery-health",label:"Delivery Health"}];
  useEffect(()=>{
    function followHash() {
      const hash = window.location.hash;
      const next:TabId = ["#analytics-health","#webhook-health","#delivery-health"].includes(hash) ? "delivery-health" : hash === "#client-tools" && showClientTools ? "client-tools" : "email";
      setActive(next);
      if (["#analytics-health","#webhook-health"].includes(hash)) requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView({block:"start"}));
    }
    followHash();
    window.addEventListener("hashchange",followHash);
    return ()=>window.removeEventListener("hashchange",followHash);
  },[showClientTools]);
  return <div className="min-w-0 space-y-6">
    <div role="tablist" aria-label="Email Studio sections" className="flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-[#111] p-2">
      {tabs.map((tab,index)=><button key={tab.id} ref={node=>{buttons.current[tab.id]=node;}} type="button" role="tab" id={`email-studio-tab-${tab.id}`} aria-controls={`email-studio-panel-${tab.id}`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} onClick={()=>setActive(tab.id)} onKeyDown={event=>{
        const target = event.key === "ArrowRight" ? (index+1)%tabs.length : event.key === "ArrowLeft" ? (index+tabs.length-1)%tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : -1;
        if (target<0) return;
        event.preventDefault();setActive(tabs[target].id);buttons.current[tabs[target].id]?.focus();
      }} className={`rounded-xl border px-4 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)] ${active===tab.id ? "border-[var(--helios-orange)]/50 bg-[var(--helios-orange)]/10 text-white" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"}`}>{tab.label}</button>)}
    </div>
    {/* Keep the composer mounted: switching sections must never clear an unsaved draft. */}
    <section role="tabpanel" id="email-studio-panel-email" aria-labelledby="email-studio-tab-email" hidden={active!=="email"} tabIndex={0} className="min-w-0 space-y-6">{children}</section>
    {showClientTools && <section role="tabpanel" id="email-studio-panel-client-tools" aria-labelledby="email-studio-tab-client-tools" hidden={active!=="client-tools"} tabIndex={0} className="min-w-0 space-y-5"><p className="text-sm text-white/45">Monthly client reports and event invitations.</p>{clientTools}</section>}
    <section role="tabpanel" id="email-studio-panel-delivery-health" aria-labelledby="email-studio-tab-delivery-health" hidden={active!=="delivery-health"} tabIndex={0} className="min-w-0 space-y-5"><p className="text-sm text-white/45">Provider-confirmed email reporting and webhook processing.</p>{deliveryHealth}</section>
  </div>;
}
