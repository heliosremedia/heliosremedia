import { duplicateSocialCampaign } from "@/lib/social/campaign-duplication";
import { lockEditableSocialVariant } from "@/lib/social/mutation-lock";
import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
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
    const workspaceId = session.workspaceId;
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 40);
    const variantId = clean(body.variantId, 100);
    const variant = variantId ? await prisma.socialVariant.findFirst({
      where: { id: variantId, campaignId, campaign: { workspaceId } },
      include: { _count: { select: { media: true } } },
    }) : null;
    if (variantId && !variant) return NextResponse.json({ success: false, error: "Variant not found." }, { status: 404 });
    const publishedMutations = ["update-variant", "submit-review", "approve", "schedule", "set-media", "update-media-presentation", "set-ai-image", "archive"];
    if (variant?.status === "PUBLISHED" && publishedMutations.includes(action)) {
      return NextResponse.json({ success: false, error: "Published posts are immutable. Create a new campaign or variant revision instead." }, { status: 409 });
    }
    if (action === "update-campaign") {
      const changed = await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        return tx.socialCampaign.updateMany({
        where: { id: campaignId, workspaceId },
        data: {
          internalName: clean(body.internalName, 180), purpose: clean(body.purpose, 5000),
          targetAudience: clean(body.targetAudience, 1000), primaryMessage: clean(body.primaryMessage, 2000),
          desiredCallToAction: clean(body.callToAction, 1000), destinationLink: clean(body.destinationLink, 2000),
          scheduleNotes: clean(body.scheduleNotes, 3000), internalAiInstructions: clean(body.internalAiInstructions, 5000),
          lastEditedById: session.userId,
        },
      });
      });
      if (!changed.count) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
    } else if (action === "archive-campaign") {
      const changed = await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        const variants = await tx.socialVariant.findMany({ where: { campaignId, campaign: { workspaceId } }, select: { id: true }, orderBy: { id: "asc" } });
        for (const item of variants) await lockEditableSocialVariant(tx, item.id, workspaceId);
        return tx.socialCampaign.updateMany({
          where: { id: campaignId, workspaceId },
          data: { status: "ARCHIVED", archivedAt: new Date(), lastEditedById: session.userId },
        });
      });
      if (!changed.count) return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
    } else if (action === "duplicate-campaign") {
      const copy = await duplicateSocialCampaign(campaignId, session);
      return NextResponse.json({ success: true, campaignId: copy.id });
    } else if (action === "update-variant" && variant) {
      const hashtags = Array.isArray(body.hashtags) ? body.hashtags.map((value) => clean(value, 100)).filter(Boolean).slice(0, 30) : clean(body.hashtags, 2000).split(/\s+/).filter(Boolean);
      await updateVariantContent({
        variantId, workspaceId, actorId: session.userId, actorSessionVersion: session.sessionVersion, expectedContentVersion: variant.contentVersion,
        data: {
          postType: clean(body.postType, 80), caption: clean(body.caption, 20_000), openingHook: clean(body.openingHook, 2000),
          hashtags, callToAction: clean(body.callToAction, 2000), destinationLink: clean(body.destinationLink, 2000),
          altText: clean(body.altText, 2000), onScreenText: clean(body.onScreenText, 5000),
          videoConcept: clean(body.videoConcept, 8000), platformNotes: clean(body.platformNotes, 5000),
          internalNotes: clean(body.internalNotes, 5000),
        } as Prisma.SocialVariantUpdateInput,
      });
    } else if (action === "submit-review" && variant) {
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        return Promise.all([
        tx.socialVariant.update({ where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status }, data: { status: "NEEDS_REVIEW", lastEditedById: session.userId } }),
        tx.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "SUBMITTED", contentVersion: variant.contentVersion } }),
        tx.socialCampaign.update({ where: { id: campaignId, workspaceId }, data: { status: "READY_FOR_REVIEW", lastEditedById: session.userId } }),
        ]);
      });
    } else if (action === "approve" && variant) {
      if (!canApprove({ caption: variant.caption, postType: variant.postType, mediaCount: variant._count.media, hasGeneratedCover: Boolean(variant.suggestedCover) })) {
        return NextResponse.json({ success: false, error: "Complete the copy and required media before approval." }, { status: 400 });
      }
      const otherPending = await prisma.socialVariant.count({
        where: { campaignId, id: { not: variantId }, status: { notIn: ["APPROVED", "PUBLISHED", "ARCHIVED"] } },
      });
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        return Promise.all([
        tx.socialVariant.update({ where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status }, data: { status: "APPROVED", approvedAt: new Date(), approvalActorId: session.userId } }),
        tx.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "APPROVED", contentVersion: variant.contentVersion } }),
        tx.socialGeneratedAsset.updateMany({ where: { variantId, workspaceId, reviewedAt: null }, data: { reviewedAt: new Date(), reviewedById: session.userId } }),
        tx.socialCampaign.update({ where: { id: campaignId, workspaceId }, data: { status: otherPending ? "IN_PROGRESS" : "APPROVED", lastEditedById: session.userId } }),
        ]);
      });
    } else if (action === "request-changes" && variant) {
      const reason = clean(body.reason, 2000);
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        return Promise.all([
        tx.socialVariant.update({ where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status }, data: { status: "CHANGES_REQUESTED", approvedAt: null, approvalActorId: null } }),
        tx.socialApprovalEvent.create({ data: { variantId, actorId: session.userId, action: "CHANGES_REQUESTED", contentVersion: variant.contentVersion, reason } }),
        tx.socialCampaign.update({ where: { id: campaignId, workspaceId }, data: { status: "IN_PROGRESS", lastEditedById: session.userId } }),
        ]);
      });
    } else if (action === "schedule" && variant) {
      const local = clean(body.scheduledLocal, 40);
      const zone = clean(body.timeZone, 80) || "America/Denver";
      const scheduledAt = local ? zonedLocalToUtc(local, zone) : null;
      const status = scheduleState(variant.status as never, scheduledAt) as SocialVariantStatus;
      await prisma.$transaction(async(tx)=>{
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        if(variant.scheduledAt?.getTime()!==scheduledAt?.getTime()){
          await tx.socialPublishingSnapshot.updateMany({where:{variantId,invalidatedAt:null},data:{invalidatedAt:new Date()}});
          await tx.socialPublishingJob.updateMany({where:{variantId,status:{in:["SCHEDULED","VALIDATING","READY","DELAYED","RETRY_SCHEDULED"]}},data:{status:"CANCELLED",cancelledAt:new Date(),claimToken:null,lastErrorCategory:"CANCELLED",lastErrorMessage:"Schedule changed; create a new revision-locked publishing job."}});
        }
        await tx.socialVariant.update({
          where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status },
          data: { scheduledAt, scheduledTimeZone: zone, status, scheduleVersion: { increment: 1 }, readyProcessedAt: null },
        });
      });
    } else if (action === "enable-direct-publishing" && variant) {
      const connectionId=clean(body.connectionId,100);
      const job=await createPublishingJob({variantId,connectionId,actor:session});
      return NextResponse.json({success:true,jobId:job.id});
    } else if (action === "send-now" && variant) {
      if(variant.status!=="APPROVED") return NextResponse.json({success:false,error:"Approve this exact revision before sending now."},{status:409});
      const connectionId=clean(body.connectionId,100);const connection=await prisma.socialConnection.findFirst({where:{id:connectionId,workspaceId,platform:variant.platform,state:"CONNECTED",directPublishingEnabled:true}});
      if(!connection) return NextResponse.json({success:false,error:"Select a verified, enabled destination for this platform."},{status:409});
      const scheduledAt=new Date();
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        await tx.socialVariant.update({where:{id:variant.id,campaign:{workspaceId},contentVersion:variant.contentVersion,status:"APPROVED"},data:{status:"SCHEDULED",scheduledAt,scheduledTimeZone:"America/Denver",scheduleVersion:{increment:1}}});
      });
      const job=await createPublishingJob({variantId,connectionId,actor:session});
      return NextResponse.json({success:true,jobId:job.id,message:"The approved post entered the protected publishing queue."});
    } else if (action === "publish" && variant) {
      if (!["READY_TO_PUBLISH", "SCHEDULED"].includes(variant.status)) return NextResponse.json({ success: false, error: "Only scheduled or ready posts can be marked published." }, { status: 400 });
      const publishedAt = body.publishedAt ? new Date(clean(body.publishedAt, 80)) : new Date();
      const publicUrl = clean(body.publicUrl, 2000);
      const notes = clean(body.notes, 5000);
      const externalPostId = clean(body.externalPostId, 300) || null;
      const requestedConnectionId = clean(body.connectionId, 100);
      const linkedConnection = requestedConnectionId ? await prisma.socialConnection.findFirst({ where: { id: requestedConnectionId, workspaceId, platform: variant.platform }, select: { id: true } }) : null;
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        return Promise.all([
        tx.socialVariant.update({ where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status }, data: { status: "PUBLISHED", publishedAt, publicUrl, publicationNotes: notes } }),
        tx.socialPublication.create({ data: { variantId, actorId: session.userId, publishedAt, publicUrl, notes, externalPostId, connectionId: linkedConnection?.id } }),
        ]);
      });
    } else if (action === "set-media" && variant) {
      const mediaIds = Array.isArray(body.mediaIds) ? body.mediaIds.map((value) => clean(value, 100)).filter(Boolean).slice(0, 20) : [];
      await updateVariantContent({ variantId, workspaceId, actorId: session.userId, actorSessionVersion: session.sessionVersion, expectedContentVersion: variant.contentVersion, data: {}, change: { kind: "MEDIA_SELECTION", mediaIds } });
    } else if (action === "update-media-presentation" && variant) {
      await updateVariantContent({
        variantId, workspaceId, actorId: session.userId, actorSessionVersion: session.sessionVersion, expectedContentVersion: variant.contentVersion, data: {},
        change: { kind: "MEDIA_PRESENTATION", relationId: clean(body.mediaRelationId, 100), data: {
          altText: clean(body.altText, 2000), cropAspect: clean(body.cropAspect, 20) || null,
          cropX: Math.min(1, Math.max(0, Number(body.cropX) || 0.5)), cropY: Math.min(1, Math.max(0, Number(body.cropY) || 0.5)),
          cropScale: Math.min(3, Math.max(1, Number(body.cropScale) || 1)),
        } },
      });
    } else if (action === "set-ai-image" && variant) {
      await updateVariantContent({ variantId, workspaceId, actorId: session.userId, actorSessionVersion: session.sessionVersion, expectedContentVersion: variant.contentVersion, data: {}, change: { kind: "AI_IMAGE", assetId: clean(body.assetId, 100) } });
    } else if (action === "archive" && variant) {
      await prisma.$transaction(async (tx) => {
        await requireLockedWorkspaceEditor(tx, session);
        await lockEditableSocialVariant(tx, variantId, workspaceId);
        await tx.socialVariant.update({ where: { id: variantId, campaign: { workspaceId }, contentVersion: variant.contentVersion, status: variant.status }, data: { status: "ARCHIVED", archivedAt: new Date(), scheduledAt: null } });
      });
    } else {
      return NextResponse.json({ success: false, error: "Unsupported Social Studio action." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as { code?: string }).code;
      if (error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
      if (error.message === "SOCIAL_CAMPAIGN_NOT_FOUND") return NextResponse.json({ success: false, error: "Campaign not found." }, { status: 404 });
      if (error.message === "INVALID_SOCIAL_SOURCE") return NextResponse.json({ success: false, error: "Review this campaign’s source and media before copying it." }, { status: 409 });
      if (error.message === "SOCIAL_IMAGE_NOT_FOUND") return NextResponse.json({ success: false, error: "The generated image was not found." }, { status: 404 });
      if (error.message === "SOCIAL_VARIANT_NOT_FOUND") return NextResponse.json({ success: false, error: "Variant not found." }, { status: 404 });
      if (error.message === "SOCIAL_EDIT_CONFLICT" || code === "P2025") return NextResponse.json({ success: false, error: "This post changed. Refresh before reviewing or editing it." }, { status: 409 });
      if (error.message.startsWith("Published variants are immutable")) return NextResponse.json({ success: false, error: "Published posts cannot be edited. Create a new draft." }, { status: 409 });
      if (error.message === "SOCIAL_PUBLICATION_IN_PROGRESS") return NextResponse.json({ success: false, error: "Resolve the current publication before editing this post." }, { status: 409 });
      if (["INVALID_SOCIAL_MEDIA", "INVALID_SOCIAL_CONTENT"].includes(error.message)) return NextResponse.json({ success: false, error: "Choose content and media available to this company." }, { status: 400 });
    }
    console.error("Social campaign update failed:", error);
    return NextResponse.json({ success: false, error: "The social campaign could not be updated." }, { status: 500 });
  }
}
