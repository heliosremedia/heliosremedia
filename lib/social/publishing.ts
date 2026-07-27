import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getPublicAssetUrl } from "@/lib/r2-upload";
import { contentDigest, decryptSocialToken } from "./security";
import { normalizeProviderError, providerAdapters, type PublishPayload } from "./providers";
import { publishingIdempotencyKey, retryDelayMs } from "./publishing-core";

export { publishingIdempotencyKey, retryDelayMs };

export async function createPublishingJob(input: { variantId: string; connectionId: string }) {
  const variant = await prisma.socialVariant.findUniqueOrThrow({
    where: { id: input.variantId },
    include: { media: { orderBy: { displayOrder: "asc" }, include: { media: true } } },
  });
  if (!variant.approvedAt || !variant.approvalActorId || !variant.scheduledAt || !["APPROVED","SCHEDULED"].includes(variant.status)) throw new Error("An approved, scheduled variant is required.");
  const connection = await prisma.socialConnection.findUniqueOrThrow({ where: { id: input.connectionId } });
  if (connection.platform !== variant.platform || !connection.directPublishingEnabled || connection.state !== "CONNECTED") throw new Error("Direct publishing is not enabled for the selected account.");
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
  return prisma.$transaction(async (tx) => {
    const snapshot = await tx.socialPublishingSnapshot.upsert({
      where: { variantId_connectionId_contentVersion_scheduledAt: { variantId: variant.id, connectionId: connection.id, contentVersion: variant.contentVersion, scheduledAt: variant.scheduledAt! } },
      create: { variantId: variant.id, connectionId: connection.id, contentVersion: variant.contentVersion, contentDigest: digest, payload: payload as unknown as Prisma.InputJsonValue, approvedById: variant.approvalActorId!, approvedAt: variant.approvedAt!, scheduledAt: variant.scheduledAt! },
      update: {},
    });
    return tx.socialPublishingJob.upsert({
      where: { idempotencyKey },
      create: { variantId: variant.id, connectionId: connection.id, snapshotId: snapshot.id, idempotencyKey, scheduledAt: variant.scheduledAt!, nextAttemptAt: variant.scheduledAt! },
      update: {},
    });
  });
}

export async function processPublishingQueue(now = new Date()) {
  const candidates = await prisma.socialPublishingJob.findMany({
    where: { status: { in: ["SCHEDULED","RETRY_SCHEDULED","DELAYED"] }, nextAttemptAt: { lte: now }, scheduledAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" }, take: 20, select: { id: true },
  });
  let claimed = 0;
  for (const candidate of candidates) {
    const claimToken = randomUUID();
    const claim = await prisma.socialPublishingJob.updateMany({
      where: { id: candidate.id, status: { in: ["SCHEDULED","RETRY_SCHEDULED","DELAYED"] }, nextAttemptAt: { lte: now }, claimToken: null },
      data: { status: "VALIDATING", claimToken, claimedAt: now },
    });
    if (!claim.count) continue;
    claimed++;
    await executeClaim(candidate.id, claimToken, now);
  }
  return { inspected: candidates.length, claimed };
}

async function executeClaim(jobId: string, claimToken: string, now: Date) {
  const job = await prisma.socialPublishingJob.findFirstOrThrow({
    where: { id: jobId, claimToken },
    include: { connection: true, snapshot: true },
  });
  const attemptNumber = job.attempts + 1;
  const started = Date.now();
  try {
    if (!job.connection.directPublishingEnabled || job.connection.state !== "CONNECTED" || !job.connection.encryptedTokenPayload) {
      throw Object.assign(new Error("Reconnect the account or move this post to the manual workflow."), { category: "AUTHENTICATION", retryable: false });
    }
    const tokens = decryptSocialToken(job.connection.encryptedTokenPayload);
    const accessToken = typeof tokens.accessToken === "string" ? tokens.accessToken : "";
    if (!accessToken) throw Object.assign(new Error("The connected account has no usable authorization."), { category: "AUTHENTICATION", retryable: false });
    const payload = job.snapshot.payload as unknown as PublishPayload;
    const blockers = providerAdapters[payload.platform].validatePost(payload).filter((issue) => issue.severity === "BLOCKING");
    if (blockers.length) throw Object.assign(new Error(blockers.map((issue) => issue.message).join(" ")), { category: "VALIDATION", retryable: false });
    await prisma.socialPublishingJob.update({ where: { id: job.id }, data: { status: "PUBLISHING", attempts: attemptNumber } });
    const result = await providerAdapters[payload.platform].publish(payload, accessToken, job.connection.providerAccountId || "", job.idempotencyKey);
    const status = result.outcome;
    await prisma.$transaction([
      prisma.socialPublishingJob.update({ where: { id: job.id }, data: { status, providerSubmissionId: result.providerSubmissionId, externalPostId: result.externalPostId, publicUrl: result.publicUrl, completedAt: status === "PUBLISHED" ? now : null, claimToken: null } }),
      prisma.socialPublishingAttempt.create({ data: { jobId: job.id, attemptNumber, status, providerSubmissionId: result.providerSubmissionId, externalPostId: result.externalPostId, publicUrl: result.publicUrl, durationMs: Date.now() - started } }),
      ...(status === "PUBLISHED" ? [prisma.socialVariant.update({ where: { id: job.variantId }, data: { status: "PUBLISHED", publishedAt: now, publicUrl: result.publicUrl } })] : []),
    ]);
  } catch (error) {
    const normalized = normalizeProviderError(error);
    const retry = normalized.retryable && !normalized.ambiguous && attemptNumber < job.maxAttempts;
    const status = normalized.ambiguous ? "MANUAL_FALLBACK" : normalized.category === "AUTHENTICATION" ? "REAUTHORIZATION_REQUIRED" : retry ? "RETRY_SCHEDULED" : "FAILED";
    await prisma.$transaction([
      prisma.socialPublishingJob.update({ where: { id: job.id }, data: { status, attempts: attemptNumber, claimToken: null, lastErrorCategory: normalized.category, lastErrorMessage: normalized.message, nextAttemptAt: retry ? new Date(now.getTime() + retryDelayMs(attemptNumber)) : job.nextAttemptAt } }),
      prisma.socialPublishingAttempt.create({ data: { jobId: job.id, attemptNumber, status, errorCategory: normalized.category, sanitizedError: normalized.message, durationMs: Date.now() - started } }),
    ]);
  }
}
