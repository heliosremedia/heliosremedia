import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeSummary } from "@/lib/social/analytics-core";
export const dynamic="force-dynamic";
const show=(value:number|null)=>value===null?"Not Available":value.toLocaleString();
export default async function PostReport({params}:{params:Promise<{variantId:string}>}){
 const {variantId}=await params;
 const item=await prisma.socialVariant.findUnique({
   where:{id:variantId},
   include:{
     campaign:true,
     publications:{orderBy:{publishedAt:"desc"},take:1},
     metricSnapshots:{orderBy:{measuredAt:"desc"},take:200},
   },
 });
 if(!item||item.status!=="PUBLISHED")notFound();const summary=safeSummary(item.metricSnapshots.map(metric=>({platform:item.platform,variantId:item.id,category:metric.normalizedCategory,providerName:metric.providerMetricName,value:metric.value===null?null:Number(metric.value),availability:metric.availability,measuredAt:metric.measuredAt})));
 return <div className="space-y-7 pb-12"><section className="border-b border-white/[.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Published post report</p><h1 className="mt-3 text-3xl font-light text-white">{item.campaign.internalName}</h1><p className="mt-3 text-sm text-white/40">{item.platform} · {item.postType.replaceAll("_"," ")} · {item.publishedAt?.toLocaleString()||"Publication time unavailable"}</p></section><section className="grid grid-cols-2 gap-3 md:grid-cols-3">{Object.entries(summary).map(([label,value])=><div key={label} className="rounded-xl border border-white/[.08] p-5"><p className="text-xs uppercase text-white/30">{label.replaceAll(/([A-Z])/g," $1")}</p><p className="mt-3 text-2xl text-white/75">{show(value)}</p></div>)}</section><section className="rounded-2xl border border-white/[.08] p-6"><h2 className="text-xl text-white/80">Metric definitions and freshness</h2><div className="mt-4 space-y-3">{item.metricSnapshots.slice(0,30).map(metric=><div key={metric.id} className="border-t border-white/[.06] pt-3"><p className="text-sm text-white/65">{metric.providerMetricName} · {metric.availability.replaceAll("_"," ")}</p><p className="mt-1 text-xs text-white/35">{metric.metricDefinition}</p><p className="mt-1 text-[.65rem] text-white/25">Measured {metric.measuredAt.toLocaleString()} · {metric.providerApiVersion||"Provider version not recorded"}</p></div>)}{!item.metricSnapshots.length&&<p className="text-sm text-white/35">Awaiting verified provider data.</p>}</div></section><div className="flex flex-wrap gap-2"><Link href="/admin/social-studio/analytics" className="admin-btn-secondary">Back to analytics</Link><Link href={`/admin/social-studio/campaigns/${item.campaignId}?variant=${item.id}`} className="admin-btn-secondary">Compare with campaign</Link>{item.publicUrl&&<a href={item.publicUrl} target="_blank" rel="noreferrer" className="admin-btn-primary">Open public post</a>}</div></div>;
}
