import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSocialToken } from "./security";
import { metricFingerprint } from "./analytics-core";
import { analyticsAdapters } from "./analytics-providers";
import { sanitizeProviderMessage } from "./publishing-core";

const DAY=86_400_000;
export async function queueAnalyticsRefresh(connectionId:string,rangeStart:Date,rangeEnd:Date){
  const boundedStart=new Date(Math.max(rangeStart.getTime(),rangeEnd.getTime()-90*DAY));
  const bucket=new Date().toISOString().slice(0,13);
  return prisma.socialAnalyticsJob.upsert({where:{idempotencyKey:`${connectionId}:${boundedStart.toISOString().slice(0,10)}:${rangeEnd.toISOString().slice(0,10)}:${bucket}`},create:{connectionId,rangeStart:boundedStart,rangeEnd,idempotencyKey:`${connectionId}:${boundedStart.toISOString().slice(0,10)}:${rangeEnd.toISOString().slice(0,10)}:${bucket}`,nextAttemptAt:new Date()},update:{}});
}
export async function processAnalyticsQueue(now=new Date()){
  const jobs=await prisma.socialAnalyticsJob.findMany({where:{status:{in:["PENDING","RETRY_SCHEDULED"]},nextAttemptAt:{lte:now}},take:4,orderBy:{nextAttemptAt:"asc"},select:{id:true}});
  let processed=0;
  for(const item of jobs){const claimToken=randomUUID();const claim=await prisma.socialAnalyticsJob.updateMany({where:{id:item.id,status:{in:["PENDING","RETRY_SCHEDULED"]},claimToken:null},data:{status:"RUNNING",claimToken,claimedAt:now}});if(!claim.count)continue;processed++;await execute(item.id,claimToken,now);}
  return {inspected:jobs.length,processed};
}
async function execute(id:string,claimToken:string,now:Date){
  const started=Date.now();const job=await prisma.socialAnalyticsJob.findFirstOrThrow({where:{id,claimToken},include:{connection:true}});
  try{
    const connection=job.connection;if(!connection.encryptedTokenPayload||!connection.providerAccountId)throw Object.assign(new Error("Analytics connection is not authorized."),{category:"AUTHENTICATION",retryable:false});
    const granted=new Set(Array.isArray(connection.grantedScopes)?connection.grantedScopes.filter((x):x is string=>typeof x==="string"):[]);
    const adapter=analyticsAdapters[connection.platform];const missing=adapter.capability.scopes.filter(scope=>!granted.has(scope));
    if(missing.length)throw Object.assign(new Error(`Additional analytics permission is required: ${missing.join(", ")}.`),{category:"PERMISSION",retryable:false});
    const token=decryptSocialToken(connection.encryptedTokenPayload);const accessToken=typeof token.accessToken==="string"?token.accessToken:"";
    const publications=await prisma.socialPublication.findMany({where:{variant:{platform:connection.platform},publishedAt:{gte:job.rangeStart,lte:job.rangeEnd},OR:[{connectionId:connection.id},{connectionId:null}]},select:{id:true,variantId:true,externalPostId:true},take:250});
    const posts=publications.flatMap(item=>item.externalPostId?[{externalPostId:item.externalPostId,variantId:item.variantId}]:[]);
    const metrics=await adapter.fetch({accessToken,accountId:connection.providerAccountId,posts,rangeStart:job.rangeStart,rangeEnd:job.rangeEnd});
    const publicationByExternal=new Map(publications.filter(item=>item.externalPostId).map(item=>[item.externalPostId!,item]));
    for(const metric of metrics){const publication=metric.externalPostId?publicationByExternal.get(metric.externalPostId):undefined;const fingerprint=metricFingerprint({connectionId:connection.id,externalPostId:metric.externalPostId,providerName:metric.providerName,measuredAt:metric.measuredAt,periodStart:metric.periodStart,periodEnd:metric.periodEnd});await prisma.socialMetricSnapshot.upsert({where:{sourceFingerprint:fingerprint},create:{connectionId:connection.id,variantId:publication?.variantId,publicationId:publication?.id,platform:connection.platform,externalAccountId:connection.providerAccountId,externalPostId:metric.externalPostId,normalizedCategory:metric.category,providerMetricName:metric.providerName,metricDefinition:metric.definition,value:metric.value,periodType:metric.periodType,periodStart:metric.periodStart,periodEnd:metric.periodEnd,measuredAt:metric.measuredAt,availability:metric.availability,importSource:"OFFICIAL_API",providerApiVersion:metric.apiVersion,sourceFingerprint:fingerprint},update:{}});}
    await prisma.$transaction([prisma.socialAnalyticsJob.update({where:{id},data:{status:"SUCCEEDED",claimToken:null,attempts:{increment:1},importedSnapshots:metrics.length,durationMs:Date.now()-started,completedAt:now}}),prisma.socialConnection.update({where:{id:connection.id},data:{analyticsPermissionState:"AVAILABLE",analyticsLastAttemptAt:now,analyticsLastSuccessfulAt:now,analyticsFailureCount:0,analyticsError:null}})]);
  }catch(error){const message=sanitizeProviderMessage(error instanceof Error?error.message:"Analytics refresh failed.");const category=typeof error==="object"&&error&&"category" in error?String(error.category):"UNKNOWN";const retryable=Boolean(typeof error==="object"&&error&&"retryable" in error&&error.retryable);const attempts=job.attempts+1;const retry=retryable&&attempts<4;await prisma.$transaction([prisma.socialAnalyticsJob.update({where:{id},data:{status:retry?"RETRY_SCHEDULED":"FAILED",claimToken:null,attempts,lastErrorCategory:category,lastErrorMessage:message,nextAttemptAt:retry?new Date(now.getTime()+Math.min(6*60*60*1000,15*60*1000*2**attempts)):job.nextAttemptAt,durationMs:Date.now()-started}}),prisma.socialConnection.update({where:{id:job.connectionId},data:{analyticsPermissionState:category==="PERMISSION"?"PERMISSION_REQUIRED":category==="AUTHENTICATION"?"CONNECTION_REQUIRED":"REFRESH_FAILED",analyticsLastAttemptAt:now,analyticsFailureCount:{increment:1},analyticsError:message}})]);}
}
