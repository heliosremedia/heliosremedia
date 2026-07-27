import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/session";
import { generateNewsletterImage } from "@/lib/newsletters/image-assets";

export const maxDuration = 180;
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !["OWNER", "ADMIN", "EDITOR"].includes(session.role)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const asset = await generateNewsletterImage({ prompt: `Social campaign concept. This must look conceptual and must not depict or imply a specific real property. ${String(body.prompt || "")}`, altText: body.altText, actorId: session.userId });
    await recordAuditEvent({ actorId: session.userId, actorEmail: session.email, action: "SOCIAL_AI_IMAGE_GENERATED", entityType: "NewsletterImageAsset", entityId: asset.id, summary: "Generated and stored a clearly disclosed Social Studio concept image.", metadata: { model: asset.model } });
    return NextResponse.json({ success: true, image: { assetId: asset.id, url: asset.publicUrl, altText: asset.altText, disclosure: "AI-generated concept image — not authentic Helios property photography." } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "The image could not be generated." }, { status: 502 });
  }
}
