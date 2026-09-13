import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { getReferralAdminSession } from "@/lib/referrals/access";
import { generateReferralCampaignDraft } from "@/lib/referrals/ai";
import { ReferralValidationError, text } from "@/lib/referrals/validation";

export async function POST(request: Request) {
  const session = await getReferralAdminSession();
  if (!session) return NextResponse.json({ success: false, error: "Administrator access is required." }, { status: 403 });
  try {
    const input: unknown = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ success: false, error: "Provide a valid referral writing request." }, { status: 400 });
    const body = input as Record<string, unknown>;
    const brief = text(body.brief, 8_000, { required: true });
    const action = ["GENERATE", "REWRITE", "SHORTEN", "MORE_PERSONAL", "MORE_PROFESSIONAL", "REGENERATE"].includes(String(body.action))
      ? String(body.action) as "GENERATE" | "REWRITE" | "SHORTEN" | "MORE_PERSONAL" | "MORE_PROFESSIONAL" | "REGENERATE"
      : "GENERATE";
    const [settings, services] = await Promise.all([
      getSiteSettings(session.workspaceId),
      prisma.service.findMany({ where: { active: true, workspaceId: session.workspaceId }, select: { name: true }, orderBy: { displayOrder: "asc" } }),
    ]);
    const result = await generateReferralCampaignDraft({
      action,
      brief,
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
      workspaceId: session.workspaceId, actorId: session.userId, actorEmail: session.email, action: "REFERRAL_AI_GENERATED",
      entityType: "ReferralCampaign", summary: `Referral AI completed a ${action.toLowerCase().replaceAll("_", " ")} draft.`,
      metadata: { action, warningCount: result.warnings.length },
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof ReferralValidationError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error("Referral AI request failed", { category: "request_failed" });
    return NextResponse.json({ success: false, error: "The AI request could not be completed. Your campaign was preserved." }, { status: 500 });
  }
}
