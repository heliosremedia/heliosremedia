import { createHash } from "node:crypto";

export type Availability = "AVAILABLE"|"NOT_AVAILABLE"|"PERMISSION_REQUIRED"|"NOT_SUPPORTED"|"AWAITING_DATA"|"CONNECTION_REQUIRED"|"REFRESH_FAILED"|"OUTSIDE_AVAILABLE_HISTORY";
export type Metric = { platform:string; variantId?:string|null; category:string|null; providerName:string; value:number|null; availability:Availability; measuredAt:Date; periodStart?:Date|null; periodEnd?:Date|null };

export const ANALYTICS_CAPABILITIES = {
  INSTAGRAM: { scopes:["instagram_manage_insights","pages_read_engagement"], review:true, account:["reach","views","follower_count"], post:["reach","views","likes","comments","shares","saved","total_interactions","watch_time"], history:"Provider-retained professional-account history; availability varies by metric and media type." },
  FACEBOOK: { scopes:["read_insights","pages_read_engagement"], review:true, account:["page_impressions","page_post_engagements","page_fans"], post:["post_impressions","post_impressions_unique","reactions","comments","shares","clicks"], history:"Page and post history available only within provider-supported reporting windows." },
  LINKEDIN: { scopes:["rw_organization_admin"], review:true, account:["page_views","followers"], post:["impressions","unique_impressions","clicks","likes","comments","shares","engagement_rate"], history:"Organization reporting supports lifetime or bounded day/month intervals depending on endpoint." },
  TIKTOK: { scopes:["video.list"], review:true, account:[], post:["view_count","like_count","comment_count","share_count"], history:"Only verified videos owned by the authorized account; transferred drafts require a confirmed public-post link." },
} as const;

export function metricFingerprint(input:{connectionId:string;externalPostId?:string|null;providerName:string;measuredAt:Date;periodStart?:Date|null;periodEnd?:Date|null}) {
  return createHash("sha256").update([input.connectionId,input.externalPostId||"account",input.providerName,input.measuredAt.toISOString(),input.periodStart?.toISOString()||"",input.periodEnd?.toISOString()||""].join("|")).digest("hex");
}

export function latestSnapshots(metrics:Metric[]) {
  const latest=new Map<string,Metric>();
  for(const metric of metrics) {
    const key=[metric.platform,metric.variantId||"account",metric.category||metric.providerName].join(":");
    const current=latest.get(key);
    if(!current||current.measuredAt<metric.measuredAt) latest.set(key,metric);
  }
  return [...latest.values()];
}

export function safeSummary(metrics:Metric[]) {
  const available=latestSnapshots(metrics).filter(item=>item.availability==="AVAILABLE"&&item.value!==null);
  const sum=(category:string)=>{const values=available.filter(item=>item.category===category).map(item=>item.value!);return values.length?values.reduce((a,b)=>a+b,0):null;};
  const engagements=["likes","reactions","comments","shares","saves"].map(sum).filter((value):value is number=>value!==null).reduce((a,b)=>a+b,0);
  const impressions=sum("impressions"); const reach=sum("reach");
  const engagementRate=impressions&&engagements?Math.round((engagements/impressions)*10000)/100:null;
  return { reach, impressions, engagements:available.some(item=>["likes","reactions","comments","shares","saves"].includes(item.category||""))?engagements:null, engagementRate, linkClicks:sum("link_clicks"), videoViews:sum("video_views") };
}

export function compareGroups(groups:Array<{label:string;postCount:number;metricTotal:number|null}>) {
  return groups.map(group=>({...group, evidence:group.postCount<3?"Limited evidence":group.metricTotal===null?"Metric unavailable":"Observed result", conclusionAllowed:group.postCount>=3&&group.metricTotal!==null}));
}

export function deterministicBrief(input:{published:number;metrics:ReturnType<typeof safeSummary>;sampleSize:number;stale:boolean}) {
  if(!input.sampleSize) return "No verified social-performance data is available for this period.";
  const facts=[`${input.published} post${input.published===1?" was":"s were"} published`];
  if(input.metrics.engagements!==null) facts.push(`${input.metrics.engagements} supported engagements were recorded`);
  const caveat=input.sampleSize<3?" The sample is limited, so treat these as observations rather than conclusions.":"";
  const stale=input.stale?" Some provider data is stale or incomplete.":"";
  return `${facts.join(" and ")}.${caveat}${stale}`;
}
