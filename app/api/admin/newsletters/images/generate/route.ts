import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import {
  forbiddenNewsletterResponse,
  requireNewsletterAdministrator,
} from "@/lib/newsletters/api";
import { generateNewsletterImage } from "@/lib/newsletters/image-assets";

export const maxDuration = 180;

export async function POST(request: Request) {
  const session = await requireNewsletterAdministrator();
  if (!session) return forbiddenNewsletterResponse();
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
      action: "NEWSLETTER_AI_IMAGE_GENERATED",
      entityType: "NewsletterImageAsset",
      entityId: asset.id,
      summary: "Generated and stored a Newsletter Studio image with gpt-image-1.5.",
      metadata: { model: asset.model, quality: asset.quality, width: asset.width, height: asset.height },
    });
    return NextResponse.json({
      success: true,
      item: {
        id: `ai:${asset.id}`,
        assetId: asset.id,
        source: "AI",
        url: asset.publicUrl,
        thumbnailUrl: asset.publicUrl,
        label: asset.altText,
        altText: asset.altText,
        attribution: asset.attribution,
        width: asset.width,
        height: asset.height,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The image could not be generated.";
    const inputError = /characters|alt text/i.test(message);
    console.error("Newsletter image generation failed:", { message });
    return NextResponse.json({ success: false, error: message }, { status: inputError ? 400 : 502 });
  }
}
