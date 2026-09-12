import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSocialToken } from "./security";
import { metricFingerprint } from "./analytics-core";
import { analyticsAdapters, type ProviderMetric } from "./analytics-providers";
import { sanitizeProviderMessage } from "./publishing-core";
import { commitAnalyticsClaim } from "./analytics-claim";
import { recordAnalyticsHealth } from "./analytics-health";

const DAY=86_400_000;
export async function queueAnalyticsRefresh(connectionId:string,rangeStart:Date,rangeEnd:Date){
  const boundedStart=new Date(Math.max(rangeStart.getTime(),rangeEnd.getTime()-90*DAY));
  const bucket=new Date().toISOString().slice(0,13);
  return prisma.socialAnalyticsJob.upsert({where:{idempotencyKey:`${connectionId}:${boundedStart.toISOString().slice(0,10)}:${rangeEnd.toISOString().slice(0,10)}:${bucket}`},create:{connectionId,rangeStart:boundedStart,rangeEnd,idempotencyKey:`${connectionId}:${boundedStart.toISOString().slice(0,10)}:${rangeEnd.toISOString().slice(0,10)}:${bucket}`,nextAttemptAt:new Date()},update:{}});
}
export async function processAnalyticsQueue(now=new Date()){
  const jobs=await prisma.socialAnalyticsJob.findMany({where:{status:{in:["PENDING","RETRY_SCHEDULED"]},nextAttemptAt:{lte:now}},take:4,orderBy:{nextAttemptAt:"asc"},select:{id:true}});
  let processed=0;
  let requiresReview = false;
  for(const item of jobs){
    const claimToken=randomUUID();
    const claim=await prisma.socialAnalyticsJob.updateMany({where:{id:item.id,status:{in:["PENDING","RETRY_SCHEDULED"]},nextAttemptAt:{lte:now},claimToken:null},data:{status:"RUNNING",claimToken,claimedAt:now}});
    if(!claim.count)continue;
    processed++;
    try { requiresReview = !(await execute(item.id,claimToken,now)); }
    catch { requiresReview = true; }
    if (requiresReview) break;
  }
  return {inspected:jobs.length,processed,requiresReview};
}
async function execute(id:string,claimToken:string,now:Date){
  const started=Date.now();const job=await prisma.socialAnalyticsJob.findFirstOrThrow({where:{id,claimToken,status:"RUNNING"},include:{connection:true}});
  const connection = job.connection;
  const claim = { jobId: id, claimToken, connectionId: job.connectionId, workspaceId: connection.workspaceId, platform: connection.platform, providerAccountId: connection.providerAccountId };
  let publications: Array<{ id: string; variantId: string; externalPostId: string | null }> = [];
  let metrics: ProviderMetric[] = [];
  try{
    if(!connection.encryptedTokenPayload||!connection.providerAccountId)throw Object.assign(new Error("Analytics connection is not authorized."),{category:"AUTHENTICATION",retryable:false});
    if (!connection.workspaceId) throw Object.assign(new Error("Analytics connection ownership must be configured."), { category: "OWNERSHIP", retryable: false });
    const granted=new Set(Array.isArray(connection.grantedScopes)?connection.grantedScopes.filter((x):x is string=>typeof x==="string"):[]);
    const adapter=analyticsAdapters[connection.platform];const missing=adapter.capability.scopes.filter(scope=>!granted.has(scope));
    if(missing.length)throw Object.assign(new Error(`Additional analytics permission is required: ${missing.join(", ")}.`),{category:"PERMISSION",retryable:false});
    const token=decryptSocialToken(connection.encryptedTokenPayload);const accessToken=typeof token.accessToken==="string"?token.accessToken:"";
    // Legacy publications without a connection may be attributed only when the
    // stored company has exactly one account for this platform.
    const accounts = await prisma.socialConnection.findMany({
      where: { workspaceId: connection.workspaceId, platform: connection.platform }, select: { id: true }, take: 2,
    });
    const legacyAllowed = accounts.length === 1 && accounts[0].id === connection.id;
    publications=await prisma.socialPublication.findMany({where:{variant:{platform:connection.platform,campaign:{workspaceId:connection.workspaceId}},publishedAt:{gte:job.rangeStart,lte:job.rangeEnd},OR:[{connectionId:connection.id},...(legacyAllowed?[{connectionId:null}]:[])]},select:{id:true,variantId:true,externalPostId:true},take:250});
    const posts=publications.flatMap(item=>item.externalPostId?[{externalPostId:item.externalPostId,variantId:item.variantId}]:[]);
    metrics=await adapter.fetch({accessToken,accountId:connection.providerAccountId,posts,rangeStart:job.rangeStart,rangeEnd:job.rangeEnd});
  } catch(error) {
    const message=sanitizeProviderMessage(error instanceof Error?error.message:"Analytics refresh failed.");
    const category=typeof error==="object"&&error&&"category" in error?String(error.category):"UNKNOWN";
    const retryable=Boolean(typeof error==="object"&&error&&"retryable" in error&&error.retryable);
    const attempts=job.attempts+1;const retry=retryable&&attempts<4;
    const result = await commitAnalyticsClaim(claim, async tx => {
      await tx.socialAnalyticsJob.update({where:{id,claimToken,status:"RUNNING"},data:{status:retry?"RETRY_SCHEDULED":"FAILED",claimToken:null,attempts,lastErrorCategory:category,lastErrorMessage:message,nextAttemptAt:retry?new Date(now.getTime()+Math.min(6*60*60*1000,15*60*1000*2**attempts)):job.nextAttemptAt,durationMs:Date.now()-started}});
      await recordAnalyticsHealth(tx, { connectionId: job.connectionId, workspaceId: connection.workspaceId, attemptedAt: now, succeeded: false, category, message });
    });
    return result === 'CONFIRMED';
  }
  const providerAccountId = connection.providerAccountId;
  if (!providerAccountId) return false;
  const result = await commitAnalyticsClaim(claim, async tx => {
    const publicationByExternal=new Map(publications.filter(item=>item.externalPostId).map(item=>[item.externalPostId!,item]));
    const snapshots = metrics.map(metric => {
      const publication = metric.externalPostId ? publicationByExternal.get(metric.externalPostId) : undefined;
      const fingerprint = metricFingerprint({ connectionId: connection.id, externalPostId: metric.externalPostId,
        providerName: metric.providerName, measuredAt: metric.measuredAt, periodStart: metric.periodStart, periodEnd: metric.periodEnd });
      return { connectionId: connection.id, variantId: publication?.variantId, publicationId: publication?.id,
        platform: connection.platform, externalAccountId: providerAccountId, externalPostId: metric.externalPostId,
        normalizedCategory: metric.category, providerMetricName: metric.providerName, metricDefinition: metric.definition,
        value: metric.value, periodType: metric.periodType, periodStart: metric.periodStart, periodEnd: metric.periodEnd,
        measuredAt: metric.measuredAt, availability: metric.availability, importSource: "OFFICIAL_API" as const,
        providerApiVersion: metric.apiVersion, sourceFingerprint: fingerprint };
    });
    // Equivalent to the previous upsert(update: {}), without one round trip per
    // metric while holding claim locks. Existing fingerprints remain unchanged.
    if (snapshots.length) await tx.socialMetricSnapshot.createMany({ data: snapshots, skipDuplicates: true });
    await tx.socialAnalyticsJob.update({where:{id,claimToken,status:"RUNNING"},data:{status:"SUCCEEDED",claimToken:null,attempts:{increment:1},importedSnapshots:metrics.length,durationMs:Date.now()-started,completedAt:now}});
    await recordAnalyticsHealth(tx, { connectionId: connection.id, workspaceId: connection.workspaceId, attemptedAt: now, succeeded: true });
  });
  return result === 'CONFIRMED';
}
