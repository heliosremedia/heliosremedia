import "server-only";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { r2Client, r2Config } from "@/lib/r2";
import { createNewsletterAiImageKey, getPublicAssetUrl } from "@/lib/r2-upload";

export const NEWSLETTER_IMAGE_MODEL = "gpt-image-1.5";
export const NEWSLETTER_IMAGE_SIZE = "1536x1024";
export const NEWSLETTER_IMAGE_QUALITY = "medium";

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { code?: string | null; message?: string; type?: string };
};

export function cleanImagePrompt(value: unknown) {
  const prompt = typeof value === "string" ? value.trim() : "";
  if (prompt.length < 12 || prompt.length > 2_000) {
    throw new Error("Describe the image in 12 to 2,000 characters.");
  }
  return prompt;
}

export function cleanImageAltText(value: unknown) {
  const altText = typeof value === "string" ? value.trim() : "";
  if (altText.length < 3 || altText.length > 300) {
    throw new Error("Add concise alt text between 3 and 300 characters.");
  }
  return altText;
}

export function imageProviderError(status: number, payload: OpenAiImageResponse) {
  const code = payload.error?.code || payload.error?.type || "";
  const message = payload.error?.message || "";
  if (status === 401) return "The OpenAI API key was rejected. Update OPENAI_API_KEY, then try again.";
  if (status === 403) return "The OpenAI project cannot generate images. Verify the organization and API project permissions.";
  if (status === 429 && (code === "insufficient_quota" || /quota|billing|credit/i.test(message))) {
    return "OpenAI image generation has no available credits. Check billing and project budget.";
  }
  if (status === 429) return "OpenAI is rate limiting image generation. Wait a moment, then try again.";
  if (code === "content_policy_violation" || /safety|policy/i.test(message)) {
    return "The image prompt did not meet OpenAI safety requirements. Revise the prompt and try again.";
  }
  if (code === "model_not_found" || /model.*(access|exist|found)/i.test(message)) {
    return "gpt-image-1.5 is unavailable to this OpenAI project. Verify model access and organization status.";
  }
  if (status >= 500) return "OpenAI image generation is temporarily unavailable. Try again in a few minutes.";
  return "OpenAI rejected the image request. Revise the prompt or check the API project settings.";
}

export async function generateNewsletterImage(input: {
  prompt: unknown;
  altText: unknown;
  actorId: string;
}) {
  const prompt = cleanImagePrompt(input.prompt);
  const altText = cleanImageAltText(input.altText);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("AI image generation is not configured.");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "helios-studio/1.0",
    },
    body: JSON.stringify({
      model: NEWSLETTER_IMAGE_MODEL,
      prompt: `Create an original, refined editorial image for Helios Real Estate Media newsletter use. No logos, watermarks, readable text, invented property claims, or identifiable people. Keep the composition useful beneath email copy and maintain a cinematic, natural, premium photographic feel.\n\nCreative direction: ${prompt}`,
      size: NEWSLETTER_IMAGE_SIZE,
      quality: NEWSLETTER_IMAGE_QUALITY,
      output_format: "webp",
      output_compression: 88,
      n: 1,
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const payload = await response.json() as OpenAiImageResponse;
  if (!response.ok) {
    console.error("OpenAI rejected Newsletter Studio image generation", {
      status: response.status,
      code: payload.error?.code || payload.error?.type || "unknown",
    });
    throw new Error(imageProviderError(response.status, payload));
  }
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI returned no image data.");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    throw new Error("OpenAI returned an invalid image.");
  }

  const storageKey = createNewsletterAiImageKey();
  await r2Client.send(new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: storageKey,
    Body: bytes,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const publicUrl = getPublicAssetUrl(storageKey);
  try {
    return await prisma.newsletterImageAsset.create({
      data: {
        storageKey,
        publicUrl,
        prompt,
        altText,
        attribution: "AI-generated with OpenAI gpt-image-1.5",
        model: NEWSLETTER_IMAGE_MODEL,
        quality: NEWSLETTER_IMAGE_QUALITY,
        width: 1536,
        height: 1024,
        fileSize: bytes.length,
        createdById: input.actorId,
      },
    });
  } catch (error) {
    try {
      await r2Client.send(new DeleteObjectCommand({ Bucket: r2Config.bucketName, Key: storageKey }));
    } catch (cleanupError) {
      console.error("Unable to remove orphaned Newsletter Studio image:", { storageKey, cleanupError });
    }
    console.error("Newsletter AI image asset record failed:", { storageKey, error });
    throw new Error("The image was generated but could not be added to the gallery.");
  }
}
