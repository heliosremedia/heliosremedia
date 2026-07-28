import "server-only";
import type { SocialPlatformName } from "./core";
import { ANALYTICS_CAPABILITIES, type Availability } from "./analytics-core";

export type ProviderMetric={providerName:string;category:string|null;definition:string;value:number|null;availability:Availability;externalPostId?:string;measuredAt:Date;periodStart?:Date;periodEnd?:Date;periodType:"CUMULATIVE"|"DAILY"|"PERIOD"|"LIFETIME"|"CURRENT"|"PROVIDER_RATE";apiVersion:string};
export type AnalyticsRequest={accessToken:string;accountId:string;posts:Array<{externalPostId:string;variantId:string}>;rangeStart:Date;rangeEnd:Date};
export interface AnalyticsAdapter{platform:SocialPlatformName;capability:typeof ANALYTICS_CAPABILITIES[keyof typeof ANALYTICS_CAPABILITIES];fetch(input:AnalyticsRequest):Promise<ProviderMetric[]>}

async function json(url:string,token:string){
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok) throw Object.assign(new Error(`Analytics provider returned status ${response.status}.`),{category:response.status===401?"AUTHENTICATION":response.status===403?"PERMISSION":response.status===429?"RATE_LIMIT":response.status>=500?"TRANSIENT":"VALIDATION",retryable:response.status===429||response.status>=500});
  return await response.json() as Record<string,unknown>;
}
const numberValue=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const graphVersion="v23.0";
function graphMetrics(data:Record<string,unknown>,externalPostId?:string):ProviderMetric[]{
  const rows=Array.isArray(data.data)?data.data as Array<Record<string,unknown>>:[];
  return rows.map(row=>{const values=Array.isArray(row.values)?row.values as Array<Record<string,unknown>>:[];const last=values.at(-1);const providerName=String(row.name||"unknown");const map:Record<string,string>={reach:"reach",impressions:"impressions",views:"video_views",saved:"saves",likes:"likes",comments:"comments",shares:"shares",total_interactions:"engagements",post_impressions:"impressions",post_impressions_unique:"reach",post_clicks:"link_clicks"};
    return {providerName,category:map[providerName]||null,definition:String(row.description||`Provider-defined ${providerName}`),value:numberValue(last?.value),availability:last?"AVAILABLE":"AWAITING_DATA",externalPostId,measuredAt:new Date(),periodType:"CUMULATIVE",apiVersion:graphVersion};
  });
}
async function fetchMeta(platform:"INSTAGRAM"|"FACEBOOK",input:AnalyticsRequest){
  const names=platform==="INSTAGRAM"?"reach,views,follower_count":"page_impressions,page_post_engagements,page_fans";
  const rows=graphMetrics(await json(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.accountId)}/insights?metric=${names}&since=${Math.floor(input.rangeStart.getTime()/1000)}&until=${Math.floor(input.rangeEnd.getTime()/1000)}`,input.accessToken));
  for(const post of input.posts){const metrics=platform==="INSTAGRAM"?"reach,views,likes,comments,shares,saved,total_interactions":"post_impressions,post_impressions_unique,post_clicks";rows.push(...graphMetrics(await json(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(post.externalPostId)}/insights?metric=${metrics}`,input.accessToken),post.externalPostId));}
  return rows;
}
async function fetchLinkedIn(input:AnalyticsRequest):Promise<ProviderMetric[]>{
  const version="202607";const headers={Authorization:`Bearer ${input.accessToken}`,"LinkedIn-Version":version,"X-Restli-Protocol-Version":"2.0.0"};
  const url=`https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${input.accountId}`)}&timeIntervals=(timeRange:(start:${input.rangeStart.getTime()},end:${input.rangeEnd.getTime()}),timeGranularityType:DAY)`;
  const response=await fetch(url,{headers,cache:"no-store"});if(!response.ok)throw Object.assign(new Error(`Analytics provider returned status ${response.status}.`),{category:response.status===401?"AUTHENTICATION":response.status===403?"PERMISSION":response.status===429?"RATE_LIMIT":"TRANSIENT",retryable:response.status===429||response.status>=500});
  const data=await response.json() as {elements?:Array<Record<string,unknown>>};const total=(data.elements||[]).at(-1)?.totalShareStatistics as Record<string,unknown>|undefined;
  const definitions:Record<string,string>={impressionCount:"LinkedIn-defined organization share impressions.",uniqueImpressionsCount:"LinkedIn-defined unique organization share impressions.",clickCount:"LinkedIn-defined clicks.",likeCount:"LinkedIn-defined likes.",commentCount:"LinkedIn-defined comments.",shareCount:"LinkedIn-defined shares.",engagement:"LinkedIn provider-calculated engagement rate."};
  const categories:Record<string,string>={impressionCount:"impressions",uniqueImpressionsCount:"reach",clickCount:"link_clicks",likeCount:"likes",commentCount:"comments",shareCount:"shares",engagement:"engagement_rate"};
  return Object.entries(definitions).map(([providerName,definition])=>({providerName,category:categories[providerName],definition,value:numberValue(total?.[providerName]),availability:(total&&providerName in total?"AVAILABLE":"AWAITING_DATA") as Availability,measuredAt:new Date(),periodStart:input.rangeStart,periodEnd:input.rangeEnd,periodType:(providerName==="engagement"?"PROVIDER_RATE":"PERIOD") as "PROVIDER_RATE"|"PERIOD",apiVersion:version}));
}
async function fetchTikTok(input:AnalyticsRequest){
  if(!input.posts.length)return [];
  const response=await fetch("https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count",{method:"POST",headers:{Authorization:`Bearer ${input.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({filters:{video_ids:input.posts.map(item=>item.externalPostId)}}),cache:"no-store"});
  if(!response.ok)throw Object.assign(new Error(`Analytics provider returned status ${response.status}.`),{category:response.status===401?"AUTHENTICATION":response.status===403?"PERMISSION":response.status===429?"RATE_LIMIT":"TRANSIENT",retryable:response.status===429||response.status>=500});
  const body=await response.json() as {data?:{videos?:Array<Record<string,unknown>>}};const map:Record<string,string>={view_count:"video_views",like_count:"likes",comment_count:"comments",share_count:"shares"};
  return (body.data?.videos||[]).flatMap(video=>Object.entries(map).map(([providerName,category])=>({providerName,category,definition:`TikTok public video ${providerName.replaceAll("_"," ")}.`,value:numberValue(video[providerName]),availability:"AVAILABLE" as const,externalPostId:String(video.id),measuredAt:new Date(),periodType:"CUMULATIVE" as const,apiVersion:"v2"})));
}
export const analyticsAdapters:Record<SocialPlatformName,AnalyticsAdapter>={
  INSTAGRAM:{platform:"INSTAGRAM",capability:ANALYTICS_CAPABILITIES.INSTAGRAM,fetch:input=>fetchMeta("INSTAGRAM",input)},
  FACEBOOK:{platform:"FACEBOOK",capability:ANALYTICS_CAPABILITIES.FACEBOOK,fetch:input=>fetchMeta("FACEBOOK",input)},
  LINKEDIN:{platform:"LINKEDIN",capability:ANALYTICS_CAPABILITIES.LINKEDIN,fetch:fetchLinkedIn},
  TIKTOK:{platform:"TIKTOK",capability:ANALYTICS_CAPABILITIES.TIKTOK,fetch:fetchTikTok},
  OTHER:{platform:"OTHER",capability:ANALYTICS_CAPABILITIES.OTHER,fetch:async()=>[]},
};
