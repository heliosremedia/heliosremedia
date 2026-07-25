import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { generateReferralCampaignDraft } from "@/lib/referrals/ai";
import { text } from "@/lib/referrals/validation";

export async function POST(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = ["GENERATE", "REWRITE", "SHORTEN", "MORE_PERSONAL", "MORE_PROFESSIONAL", "REGENERATE"].includes(String(body.action))
      ? String(body.action) as "GENERATE" | "REWRITE" | "SHORTEN" | "MORE_PERSONAL" | "MORE_PROFESSIONAL" | "REGENERATE"
      : "GENERATE";
    const [settings, services] = await Promise.all([
      getSiteSettings(),
      prisma.service.findMany({ where: { active: true }, select: { name: true }, orderBy: { displayOrder: "asc" } }),
    ]);
    const result = await generateReferralCampaignDraft({
      action,
      brief: text(body.brief, 8_000, { required: true }),
      verifiedBusiness: {
        businessName: settings.businessName,
        brandVoice: settings.brandVoice || "refined, intentional, cinematic, knowledgeable, and human",
        audience: settings.brandAudience || "real estate agents and property professionals",
        services: services.map(service => service.name),
      },
      existingConfiguration: body.existingConfiguration && typeof body.existingConfiguration === "object"
        ? body.existingConfiguration as Record<string, unknown>
        : undefined,
    });
    await recordAuditEvent({
      actorId: session.userId, actorEmail: session.email, action: "REFERRAL_AI_GENERATED",
      entityType: "ReferralCampaign", summary: `Referral AI completed a ${action.toLowerCase().replaceAll("_", " ")} draft.`,
      metadata: { action, warningCount: result.warnings.length },
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Referral AI request failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The AI request could not be completed." }, { status: 500 });
  }
}
