"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type Job = { id:string; campaign:string; campaignId:string; variantId:string; platform:string; account:string; postType:string; status:string; scheduledAt:string; attempts:number; maxAttempts:number; error:string; publicUrl:string };
export default function PublishingQueue({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs); const [platform, setPlatform] = useState("ALL"); const [status, setStatus] = useState("ALL"); const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  const filtered = useMemo(() => jobs.filter((job) => (platform === "ALL" || job.platform === platform) && (status === "ALL" || job.status === status)), [jobs,platform,status]);
  async function action(jobId:string, actionName:string) {
    setBusy(jobId+actionName); setMessage("");
    const response = await fetch("/api/admin/social/publishing-jobs", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({jobId,action:actionName}) });
    const data = await response.json();
    if (response.ok && data.success) { setJobs((all) => all.map((job) => job.id === jobId ? {...job,status:data.status} : job)); setMessage(`${actionName.replaceAll("-"," ")} completed.`); }
    else setMessage(data.error || "The queue action could not be completed.");
    setBusy("");
  }
  return <><section className="flex flex-wrap gap-3 rounded-2xl border border-white/[.08] bg-white/[.02] p-4">
    <label className="text-xs text-white/35">Platform<select value={platform} onChange={(e)=>setPlatform(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-black p-2 text-white"><option>ALL</option>{["INSTAGRAM","FACEBOOK","LINKEDIN","TIKTOK"].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="text-xs text-white/35">Status<select value={status} onChange={(e)=>setStatus(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-black p-2 text-white"><option>ALL</option>{Array.from(new Set(jobs.map(x=>x.status))).map(x=><option key={x}>{x}</option>)}</select></label>
  </section>
  <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.02]"><div className="divide-y divide-white/[.07]">
    {filtered.map(job=><article key={job.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><Link href={`/admin/social-studio/campaigns/${job.campaignId}?variant=${job.variantId}`} className="text-sm text-white/75 hover:text-white">{job.campaign}</Link><span className="rounded-full border border-white/10 px-2 py-1 text-[.55rem] uppercase text-white/35">{job.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-xs text-white/30">{job.platform} · {job.postType.replaceAll("_"," ")} · {job.account} · {new Date(job.scheduledAt).toLocaleString()}</p>{job.error&&<p className="mt-2 text-xs text-red-200/70">{job.error}</p>}<p className="mt-2 text-[.6rem] text-white/25">Attempts {job.attempts}/{job.maxAttempts}</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/social-studio/campaigns/${job.campaignId}?variant=${job.variantId}`} className="admin-btn-secondary">Open post</Link>{["FAILED","RETRY_SCHEDULED","DELAYED"].includes(job.status)&&<button disabled={Boolean(busy)} onClick={()=>action(job.id,"retry")} className="admin-btn-secondary">Retry</button>}{!["PUBLISHED","CANCELLED","PUBLISHING","PROVIDER_PROCESSING"].includes(job.status)&&<button disabled={Boolean(busy)} onClick={()=>action(job.id,"manual-fallback")} className="admin-btn-secondary">Manual workflow</button>}{["SCHEDULED","RETRY_SCHEDULED","DELAYED"].includes(job.status)&&<button disabled={Boolean(busy)} onClick={()=>action(job.id,"cancel")} className="admin-btn-secondary">Cancel</button>}{job.publicUrl&&<a href={job.publicUrl} target="_blank" rel="noreferrer" className="admin-btn-secondary">View post</a>}</div></article>)}
    {!filtered.length&&<p className="p-10 text-center text-sm text-white/35">No publishing jobs match these filters. Existing V1.8 posts remain safely in the manual workflow.</p>}
  </div></section>{message&&<p role="status" aria-live="polite" className="text-sm text-white/50">{message}</p>}</>;
}

