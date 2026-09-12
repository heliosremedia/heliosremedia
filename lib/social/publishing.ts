import "server-only";
import { requireLockedWorkspaceEditor, type WorkspaceWriteActor } from "@/lib/workspace-write-access";
import { lockEditableSocialVariant } from "./mutation-lock";
import { normalizePublishingPayload, publishingStorageReferenceMatches } from "./publishing-payload";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { contentDigest, decryptSocialToken } from "./security";
import { normalizeProviderError, providerAdapters, type PublishPayload, type PublishResult } from "./providers";
import { publishingIdempotencyKey, retryDelayMs } from "./publishing-core";
import { commitPublishingClaim } from "./publishing-claim";

export { publishingIdempotencyKey, retryDelayMs };

export async function createPublishingJob(input: { variantId: string; connectionId: string; actor: WorkspaceWriteActor; autopilotDraftId?: string }) {
  return prisma.$transaction(async (tx) => {
    await requireLockedWorkspaceEditor(tx, input.actor);
    await lockEditableSocialVariant(tx, input.variantId, input.actor.workspaceId);
    const variant = await tx.socialVariant.findFirstOrThrow({
      where: { id: input.variantId, campaign: { workspaceId: input.actor.workspaceId, status: { not: "ARCHIVED" } } },
      include: { campaign: { select: { workspaceId: true } }, media: { orderBy: { displayOrder: "asc" }, include: { media: { include: { project: { select: { workspaceId: true } } } } } } },
    });
    if (!variant.approvedAt || !variant.approvalActorId || !variant.scheduledAt || !["APPROVED","SCHEDULED"].includes(variant.status)) throw new Error("An approved, scheduled variant is required.");
    if (input.autopilotDraftId) {
      const draft = await tx.socialAutopilotDraft.findFirst({ where: { id: input.autopilotDraftId, campaignId: variant.campaignId, rejectedAt: null, week: { workspaceId: input.actor.workspaceId } }, select: { id: true } });
      if (!draft) throw new Error("The approved autopilot draft is no longer available.");
    }
    if (variant.media.some((item) => item.media.project.workspaceId !== input.actor.workspaceId || !publishingStorageReferenceMatches(input.actor.workspaceId, item.media.projectId, item.media.storageKey))) throw new Error("The selected media belongs to another workspace.");
    const connection = await tx.socialConnection.findFirstOrThrow({ where: { id: input.connectionId, workspaceId: input.actor.workspaceId } });
    if (connection.workspaceId !== variant.campaign.workspaceId) throw new Error("The selected account belongs to a different workspace.");
    if (connection.platform !== variant.platform || !connection.directPublishingEnabled || connection.state !== "CONNECTED") throw new Error("Direct publishing is not enabled for the selected account.");
    const enabled=connection.platform==="FACEBOOK"?process.env.SOCIAL_FACEBOOK_PUBLISHING_ENABLED==="true":connection.platform==="INSTAGRAM"?process.env.SOCIAL_INSTAGRAM_PUBLISHING_ENABLED==="true":false;
    if(!enabled) throw new Error(`${connection.platform} direct publishing is not enabled for this environment.`);
    if(connection.tokenExpiresAt&&connection.tokenExpiresAt<=new Date()) throw new Error("The Meta access token expired. Reconnect before publishing.");
    const payload: PublishPayload = {
      platform: variant.platform, postType: variant.postType, caption: variant.caption || "",
      hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.filter((x): x is string => typeof x === "string") : [],
      destinationLink: variant.destinationLink || undefined,
      media: variant.media.map((item) => ({ url: item.media.storageKey ? getPublicAssetUrl(item.media.storageKey) : item.media.externalUrl || "", mimeType: item.media.mimeType, altText: item.altText })),
    };
    const blockers = providerAdapters[variant.platform].validatePost(payload).filter((issue) => issue.severity === "BLOCKING");
    if (blockers.length) throw new Error(blockers.map((issue) => issue.message).join(" "));
    const digest = contentDigest(payload);
    const idempotencyKey = publishingIdempotencyKey(variant.id, connection.id, variant.contentVersion, variant.scheduledAt);
    const snapshot = await tx.socialPublishingSnapshot.upsert({
      where: { variantId_connectionId_contentVersion_scheduledAt: { variantId: variant.id, connectionId: connection.id, contentVersion: variant.contentVersion, scheduledAt: variant.scheduledAt! } },
      create: { variantId: variant.id, connectionId: connection.id, contentVersion: variant.contentVersion, contentDigest: digest, payload: payload as unknown as Prisma.InputJsonValue, approvedById: variant.approvalActorId!, approvedAt: variant.approvedAt!, scheduledAt: variant.scheduledAt! },
      update: {},
    });
    if (snapshot.invalidatedAt || snapshot.contentDigest !== digest || snapshot.approvedById !== variant.approvalActorId || snapshot.approvedAt.getTime() !== variant.approvedAt!.getTime()) throw new Error("This publishing snapshot needs a new approved revision.");
    const job = await tx.socialPublishingJob.upsert({
      where: { idempotencyKey },
      create: { variantId: variant.id, connectionId: connection.id, snapshotId: snapshot.id, idempotencyKey, scheduledAt: variant.scheduledAt!, nextAttemptAt: variant.scheduledAt! },
      update: {},
    });
    if (job.snapshotId !== snapshot.id || job.variantId !== variant.id || job.connectionId !== connection.id || ["CANCELLED", "MANUAL_FALLBACK"].includes(job.status)) throw new Error("Create a new approved revision before queueing this post again.");
    return job;
  });
}

export async function processPublishingQueue(now = new Date()) {
  const candidates = await prisma.socialPublishingJob.findMany({
    where: { status: { in: ["SCHEDULED","RETRY_SCHEDULED","DELAYED"] }, nextAttemptAt: { lte: now }, scheduledAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" }, take: 20, select: { id: true },
  });
  let claimed = 0;
  let requiresReview = false;
  for (const candidate of candidates) {
    const claimToken = randomUUID();
    const claim = await prisma.socialPublishingJob.updateMany({
      where: { id: candidate.id, status: { in: ["SCHEDULED","RETRY_SCHEDULED","DELAYED"] }, nextAttemptAt: { lte: now }, scheduledAt: { lte: now }, claimToken: null },
      data: { status: "VALIDATING", claimToken, claimedAt: now },
    });
    if (!claim.count) continue;
    claimed++;
    try { requiresReview = !(await executeClaim(candidate.id, claimToken, now)); }
    catch { requiresReview = true; }
    if (requiresReview) break;
  }
  return { inspected: candidates.length, claimed, requiresReview };
}

async function reserveApprovedClaim(jobId: string, claimToken: string, now: Date) {
  const candidate = await prisma.socialPublishingJob.findFirst({ where: { id: jobId, claimToken, status: "VALIDATING" }, select: { variant: { select: { campaign: { select: { workspaceId: true } } } } } });
  if (!candidate) return null;
  const workspaceId = candidate.variant.campaign.workspaceId;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id=${workspaceId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "SocialPublishingJob" WHERE id=${jobId} AND "claimToken"=${claimToken} FOR UPDATE`;
    await tx.$queryRaw`SELECT v.id FROM "SocialVariant" v JOIN "SocialPublishingJob" j ON j."variantId"=v.id WHERE j.id=${jobId} AND j."claimToken"=${claimToken} FOR UPDATE OF v`;
    const job = await tx.socialPublishingJob.findFirst({
      where: { id: jobId, claimToken, status: "VALIDATING", variant: { campaign: { workspaceId } } },
      include: { connection: true, snapshot: true, variant: { include: { campaign: { select: { workspaceId: true, status: true, autopilotDraft: { select: { rejectedAt: true, week: { select: { workspaceId: true } } } } } }, media: { orderBy: { displayOrder: "asc" }, include: { media: { include: { project: { select: { workspaceId: true } } } } } } } } },
    });
    if (!job) return null;
    const variant = job.variant;
    const snapshot = job.snapshot;
    const snapshotPayload = normalizePublishingPayload(snapshot.payload);
    const payload: PublishPayload = {
      platform: variant.platform, postType: variant.postType, caption: variant.caption || "",
      hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.filter((item): item is string => typeof item === "string") : [],
      destinationLink: variant.destinationLink || undefined,
      media: variant.media.map((item) => ({ url: item.media.storageKey ? getPublicAssetUrl(item.media.storageKey) : item.media.externalUrl || "", mimeType: item.media.mimeType, altText: item.altText })),
    };
    const invalid = job.idempotencyKey !== publishingIdempotencyKey(variant.id, job.connectionId, variant.contentVersion, job.scheduledAt)
      || job.connection.workspaceId !== workspaceId || job.connection.platform !== variant.platform
      || snapshot.variantId !== job.variantId || snapshot.connectionId !== job.connectionId
      || snapshot.invalidatedAt !== null || snapshot.contentVersion !== variant.contentVersion
      || !variant.approvedAt || snapshot.approvedById !== variant.approvalActorId || snapshot.approvedAt.getTime() !== variant.approvedAt.getTime()
      || !variant.scheduledAt || snapshot.scheduledAt.getTime() !== variant.scheduledAt.getTime() || job.scheduledAt.getTime() !== variant.scheduledAt.getTime()
      || !["APPROVED", "SCHEDULED", "READY_TO_PUBLISH"].includes(variant.status) || variant.campaign.status === "ARCHIVED"
      || Boolean(variant.campaign.autopilotDraft && (variant.campaign.autopilotDraft.rejectedAt || variant.campaign.autopilotDraft.week.workspaceId !== workspaceId))
      || variant.media.some((item) => item.media.project.workspaceId !== workspaceId || item.media.visibility !== "VISIBLE" || !publishingStorageReferenceMatches(workspaceId, item.media.projectId, item.media.storageKey))
      || !snapshotPayload || contentDigest(snapshotPayload) !== snapshot.contentDigest || contentDigest(payload) !== snapshot.contentDigest;
    if (invalid) {
      await tx.socialPublishingJob.updateMany({ where: { id: jobId, claimToken, status: "VALIDATING" }, data: { status: "CANCELLED", cancelledAt: now, claimToken: null, lastErrorCategory: "CANCELLED", lastErrorMessage: "The approved revision, company, media or destination no longer matches this publishing job." } });
      return null;
    }
    const enabled = variant.platform === "FACEBOOK" ? process.env.SOCIAL_FACEBOOK_PUBLISHING_ENABLED === "true" : variant.platform === "INSTAGRAM" ? process.env.SOCIAL_INSTAGRAM_PUBLISHING_ENABLED === "true" : false;
    if (!enabled || !job.connection.directPublishingEnabled || job.connection.state !== "CONNECTED") {
      await tx.socialPublishingJob.updateMany({ where: { id: jobId, claimToken, status: "VALIDATING" }, data: { status: "DELAYED", nextAttemptAt: new Date(now.getTime() + 5 * 60_000), claimToken: null, lastErrorCategory: "CONFIGURATION", lastErrorMessage: "Publishing is disabled for this environment or destination." } });
      return null;
    }
    if (job.connection.tokenExpiresAt && job.connection.tokenExpiresAt <= now) {
      await tx.socialPublishingJob.updateMany({ where: { id: jobId, claimToken, status: "VALIDATING" }, data: { status: "REAUTHORIZATION_REQUIRED", claimToken: null, lastErrorCategory: "AUTHENTICATION", lastErrorMessage: "Reconnect the account before publishing." } });
      return null;
    }
    const reserved = await tx.socialPublishingJob.updateMany({ where: { id: jobId, claimToken, status: "VALIDATING" }, data: { status: "PUBLISHING", attempts: job.attempts + 1 } });
    return reserved.count === 1 ? { job, payload } : null;
  });
}

async function executeClaim(jobId: string, claimToken: string, now: Date) {
  const reserved = await reserveApprovedClaim(jobId, claimToken, now);
  if (!reserved) return true;
  const { job, payload } = reserved;
  const attemptNumber = job.attempts + 1;
  const started = Date.now();
  const claim = { workspaceId: job.variant.campaign.workspaceId, jobId: job.id, claimToken,
    connectionId: job.connectionId, platform: job.connection.platform, providerAccountId: job.connection.providerAccountId,
    variantId: job.variantId, snapshotId: job.snapshotId, contentVersion: job.snapshot.contentVersion, attemptNumber };
  // A persistence failure is not a provider failure. Do not publish unless the
  // current claim and attempt evidence have been acknowledged before submission.
  const recorded = await commitPublishingClaim(claim, async tx => {
    await tx.socialConnection.update({ where: { id: job.connectionId, workspaceId: claim.workspaceId }, data: { lastPublishingAttemptAt: now } });
  });
  if (recorded !== 'CONFIRMED') return false;
  let result: PublishResult;
  try {
    if (!job.connection.directPublishingEnabled || job.connection.state !== "CONNECTED" || !job.connection.encryptedTokenPayload) {
      throw Object.assign(new Error("Reconnect the account or move this post to the manual workflow."), { category: "AUTHENTICATION", retryable: false });
    }
    const tokens = decryptSocialToken(job.connection.encryptedTokenPayload);
    const accessToken = typeof tokens.accessToken === "string" ? tokens.accessToken : "";
    if (!accessToken) throw Object.assign(new Error("The connected account has no usable authorization."), { category: "AUTHENTICATION", retryable: false });
    const blockers = providerAdapters[payload.platform].validatePost(payload).filter((issue) => issue.severity === "BLOCKING");
    if (blockers.length) throw Object.assign(new Error(blockers.map((issue) => issue.message).join(" ")), { category: "VALIDATION", retryable: false });
    result = await providerAdapters[payload.platform].publish(payload, accessToken, job.connection.providerAccountId || "", job.idempotencyKey);
  } catch (error) {
    const normalized = normalizeProviderError(error);
    const retry = normalized.retryable && !normalized.ambiguous && attemptNumber < job.maxAttempts;
    const status = normalized.ambiguous ? "MANUAL_FALLBACK" : normalized.category === "AUTHENTICATION" ? "REAUTHORIZATION_REQUIRED" : retry ? "RETRY_SCHEDULED" : "FAILED";
    const settled = await commitPublishingClaim(claim, async tx => {
      await tx.socialPublishingJob.update({ where: { id: job.id, claimToken, status: "PUBLISHING" }, data: { status, attempts: attemptNumber, claimToken: null, lastErrorCategory: normalized.category, lastErrorMessage: normalized.message, nextAttemptAt: retry ? new Date(now.getTime() + retryDelayMs(attemptNumber)) : job.nextAttemptAt } });
      await tx.socialPublishingAttempt.create({ data: { jobId: job.id, attemptNumber, status, errorCategory: normalized.category, sanitizedError: normalized.message, durationMs: Date.now() - started } });
      await tx.socialConnection.update({where:{id:job.connectionId,workspaceId:claim.workspaceId},data:{lastProviderErrorCode:normalized.category,lastProviderErrorMessage:normalized.message,...(normalized.category==="AUTHENTICATION"?{state:"REAUTHORIZATION_REQUIRED",directPublishingEnabled:false}:{})}});
    });
    return settled === 'CONFIRMED';
  }
  const status = result.outcome;
  // Settlement is deliberately outside the provider catch. A lost commit
  // acknowledgement must not retry publication or overwrite success as failure.
  const settled = await commitPublishingClaim(claim, async tx => {
    await tx.socialPublishingJob.update({ where: { id: job.id, claimToken, status: "PUBLISHING" }, data: { status, providerSubmissionId: result.providerSubmissionId, externalPostId: result.externalPostId, publicUrl: result.publicUrl, completedAt: status === "PUBLISHED" ? now : null, claimToken: null } });
    await tx.socialPublishingAttempt.create({ data: { jobId: job.id, attemptNumber, status, providerSubmissionId: result.providerSubmissionId, externalPostId: result.externalPostId, publicUrl: result.publicUrl, durationMs: Date.now() - started } });
    if (status === "PUBLISHED") {
      await tx.socialVariant.update({ where: { id: job.variantId, contentVersion: claim.contentVersion }, data: { status: "PUBLISHED", publishedAt: now, publicUrl: result.publicUrl } });
      await tx.socialPublication.create({ data: { variantId: job.variantId, actorId: job.snapshot.approvedById, connectionId: job.connectionId, externalPostId: result.externalPostId, publishedAt: now, publicUrl: result.publicUrl, notes: "Recorded by the official direct-publishing workflow." } });
      await tx.socialConnection.update({where:{id:job.connectionId,workspaceId:claim.workspaceId},data:{lastSuccessfulPublicationAt:now,lastProviderErrorCode:null,lastProviderErrorMessage:null}});
    }
  });
  return settled === 'CONFIRMED';
}
