import { NextResponse } from "next/server";
import type { SocialPlatform, SocialSourceType } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { POST_TYPES, SOCIAL_PLATFORMS } from "@/lib/social/core";
import { verifiedProjectFacts } from "@/lib/social/studio";

const allowedSources = ["PROJECT", "PORTFOLIO_ITEM", "MEDIA_LIBRARY", "BLOG", "NEWSLETTER", "UPLOADED_IMAGE", "UPLOADED_VIDEO", "AI_GENERATED_IMAGE", "BLANK"];
const clean = (value: unknown, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || session.role === "VIEWER") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const sourceType = clean(body.sourceType, 40).toUpperCase();
    const platforms = Array.isArray(body.platforms)
      ? [...new Set(body.platforms.map((value) => clean(value, 20).toUpperCase()))].filter((value) => SOCIAL_PLATFORMS.includes(value as never))
      : [];
    if (!clean(body.internalName, 180) || !allowedSources.includes(sourceType) || !platforms.length) {
      return NextResponse.json({ success: false, error: "Add a campaign name, source, and at least one platform." }, { status: 400 });
    }
    const sourceProjectId = sourceType === "PROJECT" || sourceType === "PORTFOLIO_ITEM" ? clean(body.sourceRecordId, 80) || null : null;
    const verifiedFacts = sourceProjectId ? await verifiedProjectFacts(sourceProjectId) : {};
    const campaign = await prisma.socialCampaign.create({
      data: {
        internalName: clean(body.internalName, 180), purpose: clean(body.purpose), sourceType: sourceType as SocialSourceType,
        sourceRecordIds: body.sourceRecordId ? [clean(body.sourceRecordId, 100)] : [],
        verifiedSourceFacts: verifiedFacts, sourceProjectId,
        targetAudience: clean(body.targetAudience, 1000), primaryMessage: clean(body.primaryMessage, 2000),
        objective: clean(body.objective, 160), desiredCallToAction: clean(body.callToAction, 1000),
        destinationLink: clean(body.destinationLink, 2000), scheduleNotes: clean(body.scheduleNotes, 3000),
        internalAiInstructions: clean(body.internalAiInstructions, 5000), selectedPlatforms: platforms,
        createdById: session.userId,
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
    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("Social campaign creation failed:", error);
    return NextResponse.json({ success: false, error: "The social campaign could not be created." }, { status: 500 });
  }
}
