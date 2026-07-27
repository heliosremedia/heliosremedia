import { NextResponse } from "next/server";
import type { Prisma, SocialConnectionState, SocialPlatform } from "@/app/generated/prisma/client";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ensureSocialSettings } from "@/lib/social/studio";

const clean = (value: unknown, max = 10_000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  if (body.kind === "connection") {
    const platform = clean(body.platform, 30) as SocialPlatform;
    const existing = await prisma.socialConnection.findFirst({ where: { platform, providerAccountId: null } });
    if (existing) await prisma.socialConnection.update({
      where: { id: existing.id },
      data: {
        intendedAccountName: clean(body.intendedAccountName, 200),
        manualPublishingUrl: clean(body.manualPublishingUrl, 2000),
      },
    });
    else await prisma.socialConnection.create({
      data: {
        platform: clean(body.platform, 30) as SocialPlatform, state: clean(body.state, 40) as SocialConnectionState,
        intendedAccountName: clean(body.intendedAccountName, 200), manualPublishingUrl: clean(body.manualPublishingUrl, 2000),
      },
    });
  } else {
    await ensureSocialSettings();
    await prisma.socialStudioSettings.update({
      where: { id: "default" },
      data: {
        brandVoice: clean(body.brandVoice), primaryAudience: clean(body.primaryAudience),
        writingGuardrails: clean(body.writingGuardrails), defaultCallToAction: clean(body.defaultCallToAction),
        hashtagGuidance: clean(body.hashtagGuidance), prohibitedTopics: clean(body.prohibitedTopics),
        platformGuidance: body.platformGuidance as Prisma.InputJsonValue,
      },
    });
  }
  return NextResponse.json({ success: true });
}
