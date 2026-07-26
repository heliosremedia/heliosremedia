import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { generateNewsletterImage } from "@/lib/newsletters/image-assets";

export const maxDuration = 180;

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || (session.role !== "OWNER" && session.role !== "ADMIN")) {
    return NextResponse.json({ success: false, error: "Owner or administrator access is required." }, { status: 403 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const asset = await generateNewsletterImage({
      prompt: body.prompt,
      altText: body.altText,
      actorId: session.userId,
    });
    await recordAuditEvent({
      actorId: session.userId,
      actorEmail: session.email,
      action: "BLOG_AI_FEATURED_IMAGE_GENERATED",
      entityType: "NewsletterImageAsset",
      entityId: asset.id,
      summary: "Generated and stored a Blog Studio featured image with gpt-image-1.5.",
      metadata: { model: asset.model, quality: asset.quality, width: asset.width, height: asset.height },
    });
    return NextResponse.json({
      success: true,
      image: {
        assetId: asset.id,
        storageKey: asset.storageKey,
        url: asset.publicUrl,
        altText: asset.altText,
        attribution: asset.attribution,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The image could not be generated.";
    const inputError = /characters|alt text/i.test(message);
    console.error("Blog featured-image generation failed:", { message });
    return NextResponse.json({ success: false, error: message }, { status: inputError ? 400 : 502 });
  }
}
