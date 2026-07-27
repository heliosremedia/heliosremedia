import { prisma } from "@/lib/prisma";
import { deterministicBrief, safeSummary } from "@/lib/social/analytics-core";
import SocialAnalytics from "./SocialAnalytics";

export const dynamic="force-dynamic";
const daysFrom=(value:string|undefined)=>value==="7"?7:value==="90"?90:30;
export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{days?:string;platform?:string}>}){
  const query=await searchParams;const days=daysFrom(query.days);const end=new Date();const start=new Date(end.getTime()-days*86_400_000);
  const platform=["INSTAGRAM","FACEBOOK","LINKEDIN","TIKTOK"].includes(query.platform||"")?query.platform:undefined;
  const [connections,snapshots,variants,recommendations]=await Promise.all([
    prisma.socialConnection.findMany({where:platform?{platform:platform as "INSTAGRAM"}:{},orderBy:{platform:"asc"},select:{id:true,platform:true,state:true,providerUsername:true,intendedAccountName:true,analyticsPermissionState:true,analyticsLastSuccessfulAt:true,analyticsLastAttemptAt:true,analyticsError:true,grantedScopes:true}}),
    prisma.socialMetricSnapshot.findMany({where:{measuredAt:{gte:start,lte:end},...(platform?{platform:platform as "INSTAGRAM"}:{})},orderBy:{measuredAt:"desc"},take:2500,select:{platform:true,variantId:true,normalizedCategory:true,providerMetricName:true,value:true,availability:true,measuredAt:true,metricDefinition:true}}),
    prisma.socialVariant.findMany({where:{status:"PUBLISHED",publishedAt:{gte:start,lte:end},...(platform?{platform:platform as "INSTAGRAM"}:{})},select:{id:true,platform:true,postType:true,publishedAt:true,publicUrl:true,campaignId:true,campaign:{select:{internalName:true,objective:true,sourceType:true}},metricSnapshots:{where:{measuredAt:{gte:start,lte:end}},orderBy:{measuredAt:"desc"},take:40,select:{normalizedCategory:true,providerMetricName:true,value:true,availability:true,measuredAt:true,metricDefinition:true}}},orderBy:{publishedAt:"desc"},take:100}),
    prisma.socialAnalyticsRecommendation.findMany({where:{status:{in:["ACTIVE","SAVED"]},rangeEnd:{gte:start}},orderBy:{createdAt:"desc"},take:12}),
  ]);
  const metrics=snapshots.map(item=>({platform:item.platform,variantId:item.variantId,category:item.normalizedCategory,providerName:item.providerMetricName,value:item.value===null?null:Number(item.value),availability:item.availability,measuredAt:item.measuredAt}));
  const summary=safeSummary(metrics);const stale=connections.some(item=>!item.analyticsLastSuccessfulAt||end.getTime()-item.analyticsLastSuccessfulAt.getTime()>48*60*60*1000);
  const posts=variants.map(item=>{const values=safeSummary(item.metricSnapshots.map(metric=>({platform:item.platform,variantId:item.id,category:metric.normalizedCategory,providerName:metric.providerMetricName,value:metric.value===null?null:Number(metric.value),availability:metric.availability,measuredAt:metric.measuredAt})));return {id:item.id,campaignId:item.campaignId,campaign:item.campaign.internalName,objective:item.campaign.objective,sourceType:item.campaign.sourceType,platform:item.platform,postType:item.postType,publishedAt:item.publishedAt?.toISOString()||null,publicUrl:item.publicUrl,metrics:values,definitions:item.metricSnapshots.slice(0,8).map(metric=>({name:metric.providerMetricName,definition:metric.metricDefinition}))};});
  return <SocialAnalytics days={days} summary={{published:variants.length,...summary}} briefing={deterministicBrief({published:variants.length,metrics:summary,sampleSize:variants.length,stale})} connections={connections.map(item=>({...item,analyticsLastSuccessfulAt:item.analyticsLastSuccessfulAt?.toISOString()||null,analyticsLastAttemptAt:item.analyticsLastAttemptAt?.toISOString()||null}))} posts={posts} recommendations={recommendations.map(item=>({...item,rangeStart:item.rangeStart.toISOString(),rangeEnd:item.rangeEnd.toISOString()}))}/>;
}
