import { requireLockedWorkspaceEditor } from "@/lib/workspace-write-access";
import { NextResponse } from "next/server";
import type { SocialPlatform, SocialSourceType } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { POST_TYPES, SOCIAL_PLATFORMS } from "@/lib/social/core";
import { verifiedSourceFacts } from "@/lib/social/studio";

const allowedSources = ["PROJECT", "PORTFOLIO_ITEM", "MEDIA_LIBRARY", "BLOG", "NEWSLETTER", "UPLOADED_IMAGE", "UPLOADED_VIDEO", "AI_GENERATED_IMAGE", "BLANK"];
const clean = (value: unknown, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const workspaceId = session.workspaceId;
    const body = await request.json() as Record<string, unknown>;
    const sourceType = clean(body.sourceType, 40).toUpperCase();
    const platforms = Array.isArray(body.platforms)
      ? [...new Set(body.platforms.map((value) => clean(value, 20).toUpperCase()))].filter((value) => SOCIAL_PLATFORMS.includes(value as never))
      : [];
    if (!clean(body.internalName, 180) || !allowedSources.includes(sourceType) || !platforms.length) {
      return NextResponse.json({ success: false, error: "Add a campaign name, source, and at least one platform." }, { status: 400 });
    }
    const sourceRecordId = clean(body.sourceRecordId, 100);
    const sourceProjectId = sourceType === "PROJECT" || sourceType === "PORTFOLIO_ITEM" ? sourceRecordId || null : null;
    const requestedProjectIds = Array.isArray(body.projectIds) ? body.projectIds.map((value) => clean(value, 100)).filter(Boolean).slice(0, 50) : [];
    const projectIds = [...new Set([...(sourceProjectId ? [sourceProjectId] : []), ...requestedProjectIds])];
    const linkedSource = ["PROJECT", "PORTFOLIO_ITEM", "BLOG", "NEWSLETTER"].includes(sourceType);
    if (linkedSource !== Boolean(sourceRecordId)) return NextResponse.json({ success: false, error: linkedSource ? "Choose a source for this campaign." : "This source type does not accept a record ID." }, { status: 400 });
    const campaign = await prisma.$transaction(async (tx) => {
      await requireLockedWorkspaceEditor(tx, session);
      const authorizedProjects = projectIds.length ? await tx.project.findMany({ where: { id: { in: projectIds }, workspaceId }, select: { id: true } }) : [];
      if (authorizedProjects.length !== projectIds.length) throw new Error("INVALID_SOCIAL_SOURCE");
      let verifiedFacts = {};
      if (sourceRecordId) {
        try { verifiedFacts = await verifiedSourceFacts(sourceType, sourceRecordId, workspaceId, tx); }
        catch { throw new Error("INVALID_SOCIAL_SOURCE"); }
      }
      return tx.socialCampaign.create({
      data: {
        internalName: clean(body.internalName, 180), description: clean(body.description), purpose: clean(body.purpose), sourceType: sourceType as SocialSourceType,
        sourceRecordIds: sourceRecordId ? [sourceRecordId] : [],
        verifiedSourceFacts: verifiedFacts, sourceProjectId,
        targetAudience: clean(body.targetAudience, 1000), brandVoice: clean(body.tone, 1000), primaryMessage: clean(body.primaryMessage, 2000),
        objective: clean(body.objective, 160), desiredCallToAction: clean(body.callToAction, 1000),
        destinationLink: clean(body.destinationLink, 2000), scheduleNotes: clean(body.scheduleNotes, 3000),
        internalAiInstructions: clean(body.internalAiInstructions, 5000), internalNotes: clean(body.internalNotes, 5000),
        startAt: clean(body.startAt, 40) ? new Date(clean(body.startAt, 40)) : null,
        endAt: clean(body.endAt, 40) ? new Date(clean(body.endAt, 40)) : null,
        selectedPlatforms: platforms,
        createdById: session.userId,
        lastEditedById: session.userId,
        workspaceId,
        projects: authorizedProjects.length ? { create: authorizedProjects.map((item) => ({ projectId: item.id })) } : undefined,
        variants: {
          create: platforms.map((platform) => ({
            platform: platform as SocialPlatform,
            postType: POST_TYPES[platform as keyof typeof POST_TYPES][0],
            destinationLink: clean(body.destinationLink, 2000),
            callToAction: clean(body.callToAction, 1000),
            lastEditedById: session.userId,
          })),
        },
      },
      select: { id: true },
    });
    });
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_WRITE_FORBIDDEN") return NextResponse.json({ success: false, error: "Your workspace access changed. Sign in again." }, { status: 403 });
    if (error instanceof Error && error.message === "INVALID_SOCIAL_SOURCE") return NextResponse.json({ success: false, error: "One or more selected sources are unavailable to this company." }, { status: 409 });
    console.error("Social campaign creation failed:", error);
    return NextResponse.json({ success: false, error: "The social campaign could not be created." }, { status: 500 });
  }
}
