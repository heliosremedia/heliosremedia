import "server-only";

import { NEWSLETTER_BLOCK_TYPES } from "@/lib/newsletters/types";
import type {
  NewsletterBlockOutput,
  NewsletterGenerationOutput,
} from "@/lib/newsletters/types";

export type NewsletterSourceReference = {
  id: string;
  kind: string;
  label: string;
  excerpt: string;
  url?: string | null;
};

const BLOCK_TYPES = new Set<string>(NEWSLETTER_BLOCK_TYPES);

function requiredString(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`AI output contains an invalid ${field}.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max) {
    throw new Error(`AI output contains an invalid ${field}.`);
  }
  return value.trim() || null;
}

function stringArray(value: unknown, field: string, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`AI output contains an invalid ${field}.`);
  }
  return value.map((item) => requiredString(item, field, maxLength));
}

function safeUrl(value: unknown, field: string) {
  const result = optionalString(value, field, 2_000);
  if (!result) return null;
  const parsed = new URL(result);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`AI output contains an invalid ${field}.`);
  return parsed.toString();
}

export function validateGeneratedDraft(value: unknown, allowedSources: ReadonlySet<string>): NewsletterGenerationOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI output is not a newsletter draft.");
  const draft = value as Record<string, unknown>;
  if (!Array.isArray(draft.blocks) || draft.blocks.length < 1 || draft.blocks.length > 20) {
    throw new Error("AI output must contain between 1 and 20 newsletter blocks.");
  }
  const blocks = draft.blocks.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`AI block ${index + 1} is invalid.`);
    const block = item as Record<string, unknown>;
    const type = requiredString(block.type, "block type", 40);
    if (!BLOCK_TYPES.has(type)) throw new Error(`AI block ${index + 1} has an unsupported type.`);
    const sourceIds = stringArray(block.sourceIds, "source IDs", 20, 200);
    if (sourceIds.some((id) => !allowedSources.has(id))) {
      throw new Error(`AI block ${index + 1} cites an unapproved source.`);
    }
    return {
      type: type as NewsletterBlockOutput["type"],
      internalLabel: requiredString(block.internalLabel, "internal label", 120),
      eyebrow: optionalString(block.eyebrow, "eyebrow", 100) ?? undefined,
      heading: optionalString(block.heading, "heading", 240) ?? undefined,
      body: optionalString(block.body, "body", 8_000) ?? undefined,
      imageUrl: safeUrl(block.imageUrl, "image URL") ?? undefined,
      altText: optionalString(block.altText, "image alt text", 300) ?? undefined,
      link: safeUrl(block.link, "link URL") ?? undefined,
      buttonLabel: optionalString(block.buttonLabel, "button label", 100) ?? undefined,
      alignment: block.alignment === "CENTER" ? "CENTER" as const : "LEFT" as const,
      sourceIds,
    };
  });
  return {
    subject: requiredString(draft.subject, "subject", 180),
    subjectAlternatives: stringArray(draft.subjectAlternatives, "subject alternatives", 5, 180),
    previewText: requiredString(draft.previewText, "preview text", 300),
    blocks,
    warnings: stringArray(draft.warnings, "warnings", 20, 500),
  };
}

function outputText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const payload = result as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output ?? []).flatMap((item) => item.content ?? [])
    .map((content) => typeof content.text === "string" ? content.text : "").join("");
}

export async function generateNewsletterDraft(input: {
  brand: { businessName: string; voice: string; audience: string; writingGuidance: string };
  goals: string;
  contentNotes: string;
  internalNotes: string;
  approvedCallToAction: string;
  sources: NewsletterSourceReference[];
  signal?: AbortSignal;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Newsletter AI is not configured.");
  if (!input.sources.length) throw new Error("Add at least one verified content source before generating.");

  const sourceIds = new Set(input.sources.map((source) => source.id));
  if (sourceIds.size !== input.sources.length) throw new Error("Verified source IDs must be unique.");
  const model = process.env.OPENAI_NEWSLETTER_MODEL?.trim() || process.env.OPENAI_BLOG_MODEL?.trim() || "gpt-5-mini";
  const instructions = [
    `You are the editorial assistant for ${input.brand.businessName}.`,
    `Voice: ${input.brand.voice}. Audience: ${input.brand.audience}.`,
    `Writing guidance: ${input.brand.writingGuidance}.`,
    "Use only facts and URLs in VERIFIED_SOURCES or explicitly publishable CONTENT_NOTES.",
    "Never invent events, dates, offers, prices, facts, testimonials, claims, contact information, or links.",
    "INTERNAL_NOTES guide your work but must never appear in publishable copy.",
    "Every factual block must cite supporting sourceIds. If material is insufficient, create a shorter edition and add a warning.",
    "Return editable blocks, not HTML. AI never approves, schedules, or sends an edition.",
  ].join("\n");
  const requestBody = {
    model,
    instructions,
    input: JSON.stringify({
      goals: input.goals,
      contentNotes: input.contentNotes,
      internalNotes: input.internalNotes,
      approvedCallToAction: input.approvedCallToAction,
      verifiedSources: input.sources,
    }),
    text: {
      format: {
        type: "json_schema",
        name: "helios_newsletter_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["subject", "subjectAlternatives", "previewText", "blocks", "warnings"],
          properties: {
            subject: { type: "string" },
            subjectAlternatives: { type: "array", items: { type: "string" }, maxItems: 5 },
            previewText: { type: "string" },
            warnings: { type: "array", items: { type: "string" }, maxItems: 20 },
            blocks: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "type", "internalLabel", "eyebrow", "heading", "body", "imageUrl",
                  "altText", "link", "buttonLabel", "alignment", "sourceIds",
                ],
                properties: {
                  type: { type: "string", enum: NEWSLETTER_BLOCK_TYPES },
                  internalLabel: { type: "string" },
                  eyebrow: { type: ["string", "null"] },
                  heading: { type: ["string", "null"] },
                  body: { type: ["string", "null"] },
                  imageUrl: { type: ["string", "null"] },
                  altText: { type: ["string", "null"] },
                  link: { type: ["string", "null"] },
                  buttonLabel: { type: ["string", "null"] },
                  alignment: { type: "string", enum: ["LEFT", "CENTER"] },
                  sourceIds: { type: "array", items: { type: "string" }, maxItems: 20 },
                },
              },
            },
          },
        },
      },
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const timeout = AbortSignal.timeout(60_000);
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal,
      });
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (retryable && attempt === 0) { lastError = new Error(`OpenAI temporarily unavailable (${response.status}).`); continue; }
        const rejection = new Error(`OpenAI rejected newsletter generation (${response.status}).`);
        rejection.name = retryable ? "OpenAIUnavailableError" : "NonRetryableAIError";
        throw rejection;
      }
      const text = outputText(await response.json());
      if (!text) throw new Error("OpenAI returned an empty newsletter draft.");
      return validateGeneratedDraft(JSON.parse(text) as unknown, sourceIds);
    } catch (error) {
      lastError = error;
      if (
        attempt > 0 ||
        (error instanceof Error && (
          error.name === "NonRetryableAIError" ||
          /invalid|unsupported|unapproved/i.test(error.message)
        ))
      ) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Newsletter generation failed.");
}
