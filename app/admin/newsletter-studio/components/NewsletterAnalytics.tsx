import { getNewsletterAnalytics } from "@/lib/newsletters/analytics";

export default async function NewsletterAnalytics({ editionId }: { editionId: string }) {
  const data = await getNewsletterAnalytics(editionId);
  if (!data) return null;
  const metrics = [
    ["Intended audience", data.intended], ["Sent", data.sent], ["Delivered", `${data.delivered} · ${data.deliveryRate}%`],
    ["Estimated opens", `${data.estimatedUniqueOpens} · ${data.estimatedOpenRate}%`], ["Unique clicks", `${data.uniqueClicks} · ${data.clickThroughRate}%`],
    ["Unsubscribes", data.unsubscribes], ["Bounces", data.bounces], ["Spam complaints", data.spamComplaints],
    ["Failed / delayed", `${data.failed} / ${data.delayed}`],
  ];
  return <section className="mt-7 rounded-2xl border border-white/[.08] bg-[#111] p-5 sm:p-7"><div><p className="eyebrow text-[var(--helios-orange)]">Performance</p><h2 className="mt-2 text-2xl font-light text-white">Newsletter results</h2><p className="mt-2 text-sm text-white/35">Opens are estimated. Delivery, clicks, unsubscribes, and bounces are the primary signals.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-white/[.07] bg-black/20 p-4"><p className="text-[.52rem] uppercase tracking-[.14em] text-white/30">{label}</p><p className="mt-2 text-2xl font-light text-white/80">{value}</p></div>)}</div>{data.topLinks.length > 0 && <div className="mt-6"><h3 className="text-sm text-white/60">Top clicked links</h3><ol className="mt-3 space-y-2">{data.topLinks.map((link) => <li key={link.url} className="flex gap-4 text-xs"><span className="min-w-0 flex-1 truncate text-white/40">{link.url}</span><span className="text-white/65">{link.count}</span></li>)}</ol></div>}</section>;
}
