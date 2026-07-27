import { NextResponse } from "next/server";
import type { Prisma, SocialVariantStatus } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canApprove, scheduleState } from "@/lib/social/core";
import { updateVariantContent } from "@/lib/social/studio";
import { zonedLocalToUtc } from "@/lib/client-communications/scheduling";
import { createPublishingJob } from "@/lib/social/publishing";

const clean = (value: unknown, max = 10_000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 40);
    const variantId = clean(body.variantId, 100);
    const variant = variantId ? await prisma.socialVariant.findFirst({
      where: { id: variantId, campaignId },
      include: { _count: { select: { media: true } } },
    }) : null;
    const publishedMutations = ["update-variant", "submit-review", "approve", "schedule", "set-media", "update-media-presentation", "set-ai-image", "archive"];
    if (variant?.status === "PUBLISHED" && publishedMutations.includes(action)) {
      return NextResponse.json({ success: false, error: "Published posts are immutable. Create a new campaign or variant revision instead." }, { status: 409 });
    }
    if (action === "update-campaign") {
      await prisma.socialCampaign.update({
        where: { id: campaignId },
        data: {
          internalName: clean(body.internalName, 180), purpose: clean(body.purpose, 5000),
          targetAudience: clean(body.targetAudience, 1000), primaryMessage: clean(body.primaryMessage, 2000),
          desiredCallToAction: clean(body.callToAction, 1000), destinationLink: clean(body.destinationLink, 2000),
          scheduleNotes: clean(body.scheduleNotes, 3000), internalAiInstructions: clean(body.internalAiInstructions, 5000),
        },
      });
    } else if (action === "update-variant" && variant) {
      const hashtags = Array.isArray(body.hashtags) ? body.hashtags.map((value) => clean(value, 100)).filter(Boolean).slice(0, 30) : clean(body.hashtags, 2000).split(/\s+/).filter(Boolean);
      await updateVariantContent({
        variantId, actorId: session.userId,
        data: {
          postType: clean(body.postType, 80), caption: clean(body.caption, 20_000), openingHook: clean(body.openingHook, 2000),
          hashtags, callToAction: clean(body.callToAction, 2000), destinationLink: clean(body.destinationLink, 2000),
          altText: clean(body.altText, 2000), onScreenText: clean(body.onScreenText, 5000),
          videoConcept: clean(body.videoConcept, 8000), platformNotes: clean(body.platformNotes, 5000),
          internalNotes: clean(body.internalNotes, 5000),
        } as Prisma.SocialVariantUpdateInput,
      });
    } else if (action === "submit-review" && variant) {
      await prisma.$transaction([
        prisma.socialVariant.update({ where: { id: variantId }, data: { status: "NEEDS_REVIEW", lastEditedById: session.userId } }),
        prisma.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "SUBMITTED", contentVersion: variant.contentVersion } }),
      ]);
    } else if (action === "approve" && variant) {
      if (!canApprove({ caption: variant.caption, postType: variant.postType, mediaCount: variant._count.media, hasGeneratedCover: Boolean(variant.suggestedCover) })) {
        return NextResponse.json({ success: false, error: "Complete the copy and required media before approval." }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.socialVariant.update({ where: { id: variantId }, data: { status: "APPROVED", approvedAt: new Date(), approvalActorId: session.userId } }),
        prisma.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "APPROVED", contentVersion: variant.contentVersion } }),
      ]);
    } else if (action === "schedule" && variant) {
      const local = clean(body.scheduledLocal, 40);
      const zone = clean(body.timeZone, 80) || "America/Denver";
      const scheduledAt = local ? zonedLocalToUtc(local, zone) : null;
      const status = scheduleState(variant.status as never, scheduledAt) as SocialVariantStatus;
      await prisma.$transaction(async(tx)=>{
        if(variant.scheduledAt?.getTime()!==scheduledAt?.getTime()){
          await tx.socialPublishingSnapshot.updateMany({where:{variantId,invalidatedAt:null},data:{invalidatedAt:new Date()}});
          await tx.socialPublishingJob.updateMany({where:{variantId,status:{in:["SCHEDULED","VALIDATING","READY","DELAYED","RETRY_SCHEDULED"]}},data:{status:"CANCELLED",cancelledAt:new Date(),claimToken:null,lastErrorCategory:"CANCELLED",lastErrorMessage:"Schedule changed; create a new revision-locked publishing job."}});
        }
        await tx.socialVariant.update({
          where: { id: variantId },
          data: { scheduledAt, scheduledTimeZone: zone, status, scheduleVersion: { increment: 1 }, readyProcessedAt: null },
        });
      });
    } else if (action === "enable-direct-publishing" && variant) {
      const connectionId=clean(body.connectionId,100);
      const job=await createPublishingJob({variantId,connectionId});
      return NextResponse.json({success:true,jobId:job.id});
    } else if (action === "publish" && variant) {
      if (!["READY_TO_PUBLISH", "SCHEDULED"].includes(variant.status)) return NextResponse.json({ success: false, error: "Only scheduled or ready posts can be marked published." }, { status: 400 });
      const publishedAt = body.publishedAt ? new Date(clean(body.publishedAt, 80)) : new Date();
      const publicUrl = clean(body.publicUrl, 2000);
      const notes = clean(body.notes, 5000);
      await prisma.$transaction([
        prisma.socialVariant.update({ where: { id: variantId }, data: { status: "PUBLISHED", publishedAt, publicUrl, publicationNotes: notes } }),
        prisma.socialPublication.create({ data: { variantId, actorId: session.userId, publishedAt, publicUrl, notes } }),
      ]);
    } else if (action === "set-media" && variant) {
      const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds.map((value) => clean(value, 100)).filter(Boolean).slice(0, 20) : [];
      await prisma.$transaction(async (tx) => {
        const existing = await tx.socialVariantMedia.findMany({ where: { variantId }, select: { mediaId: true } });
        const changed = existing.map((item) => item.mediaId).join("|") !== mediaIds.join("|");
        await tx.socialVariantMedia.deleteMany({ where: { variantId } });
        if (mediaIds.length) {
          const valid = await tx.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, altText: true } });
          await tx.socialVariantMedia.createMany({
            data: valid.map((item, index) => ({ variantId, mediaId: item.id, displayOrder: index, altText: item.altText })),
          });
        }
        if (changed && ["APPROVED", "SCHEDULED", "READY_TO_PUBLISH"].includes(variant.status)) {
          await tx.socialPublishingSnapshot.updateMany({where:{variantId,invalidatedAt:null},data:{invalidatedAt:new Date()}});
          await tx.socialPublishingJob.updateMany({where:{variantId,status:{in:["SCHEDULED","VALIDATING","READY","DELAYED","RETRY_SCHEDULED"]}},data:{status:"CANCELLED",cancelledAt:new Date(),claimToken:null,lastErrorCategory:"CANCELLED",lastErrorMessage:"Selected media changed after approval."}});
          await tx.socialVariant.update({ where: { id: variantId }, data: { status: "NEEDS_REVIEW", approvedAt: null, approvalActorId: null, contentVersion: { increment: 1 }, lastEditedById: session.userId } });
          await tx.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "REVOKED", contentVersion: variant.contentVersion + 1, reason: "Selected media changed." } });
        }
      });
    } else if (action === "update-media-presentation" && variant) {
      const mediaRelationId = clean(body.mediaRelationId, 100);
      await prisma.socialVariantMedia.update({
        where: { id: mediaRelationId, variantId },
        data: {
          altText: clean(body.altText, 2000), cropAspect: clean(body.cropAspect, 20) || null,
          cropX: Math.min(1, Math.max(0, Number(body.cropX) || 0.5)), cropY: Math.min(1, Math.max(0, Number(body.cropY) || 0.5)),
          cropScale: Math.min(3, Math.max(1, Number(body.cropScale) || 1)),
        },
      });
    } else if (action === "set-ai-image" && variant) {
      const suggestedCover = clean(body.url, 3000);
      if (!suggestedCover.startsWith("https://")) return NextResponse.json({ success: false, error: "A valid generated image URL is required." }, { status: 400 });
      await updateVariantContent({ variantId, actorId: session.userId, data: { suggestedCover, aiMetadata: { generatedImageAssetId: clean(body.assetId, 100), generatedImageDisclosure: "AI-generated image; never represent as authentic Helios photography or a real property." } } });
    } else if (action === "archive" && variant) {
      await prisma.socialVariant.update({ where: { id: variantId }, data: { status: "ARCHIVED", archivedAt: new Date(), scheduledAt: null } });
    } else {
      return NextResponse.json({ success: false, error: "Unsupported Social Studio action." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Social campaign update failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The social campaign could not be updated." }, { status: 500 });
  }
}
