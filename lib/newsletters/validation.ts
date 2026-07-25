import {
  NEWSLETTER_BLOCK_TYPES,
  type NewsletterBlockOutput,
  type NewsletterGenerationOutput,
  type RecipientSelection,
  type RecurrenceRule,
} from "./types";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string, max: number, required = false) {
  if (value == null && !required) return undefined;
  if (typeof value !== "string") throw new Error(`${name} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) throw new Error(`${name} is invalid.`);
  return clean;
}

function stringArray(value: unknown, name: string, maxItems: number, itemMax: number) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${name} is invalid.`);
  return [...new Set(value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > itemMax) throw new Error(`${name} is invalid.`);
    return item.trim();
  }))];
}

export function validateRecurrenceRule(value: unknown): RecurrenceRule {
  const input = object(value);
  const localTime = text(input.localTime, "Local time", 5, true)!;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error("Local time is invalid.");
  if (input.kind === "DAY_OF_MONTH") {
    if (!Number.isInteger(input.dayOfMonth) || Number(input.dayOfMonth) < 1 || Number(input.dayOfMonth) > 31) {
      throw new Error("Day of month must be between 1 and 31.");
    }
    return { kind: "DAY_OF_MONTH", dayOfMonth: Number(input.dayOfMonth), localTime };
  }
  const ordinals = ["FIRST", "SECOND", "THIRD", "FOURTH", "LAST"] as const;
  if (input.kind !== "NTH_WEEKDAY" || !ordinals.includes(input.ordinal as typeof ordinals[number]) ||
      !Number.isInteger(input.weekday) || Number(input.weekday) < 0 || Number(input.weekday) > 6) {
    throw new Error("Named weekday recurrence is invalid.");
  }
  return { kind: "NTH_WEEKDAY", ordinal: input.ordinal as typeof ordinals[number], weekday: Number(input.weekday), localTime };
}

export function validateRecipientSelection(value: unknown): RecipientSelection {
  const input = object(value);
  const modes = ["ALL", "GROUPS", "INDIVIDUALS", "GROUPS_AND_INDIVIDUALS"] as const;
  if (!modes.includes(input.mode as typeof modes[number])) throw new Error("Recipient mode is invalid.");
  const groupIds = stringArray(input.groupIds ?? [], "Group IDs", 100, 100);
  const clientIds = stringArray(input.clientIds ?? [], "Client IDs", 1000, 100);
  if ((input.mode === "GROUPS" || input.mode === "GROUPS_AND_INDIVIDUALS") && !groupIds.length) throw new Error("Choose a group.");
  if ((input.mode === "INDIVIDUALS" || input.mode === "GROUPS_AND_INDIVIDUALS") && !clientIds.length) throw new Error("Choose a recipient.");
  return { mode: input.mode as RecipientSelection["mode"], groupIds, clientIds };
}

function validateBlock(value: unknown): NewsletterBlockOutput {
  const input = object(value);
  if (!NEWSLETTER_BLOCK_TYPES.includes(input.type as NewsletterBlockOutput["type"])) throw new Error("Block type is invalid.");
  const sourceIds = stringArray(input.sourceIds, "Block source IDs", 25, 200);
  if (!sourceIds.length && !["DIVIDER", "SPACER"].includes(String(input.type))) {
    throw new Error("Generated content blocks require verified source provenance.");
  }
  const alignment = input.alignment === undefined ? undefined : input.alignment;
  if (alignment !== undefined && alignment !== "LEFT" && alignment !== "CENTER") throw new Error("Block alignment is invalid.");
  return {
    type: input.type as NewsletterBlockOutput["type"],
    internalLabel: text(input.internalLabel, "Block label", 100),
    heading: text(input.heading, "Heading", 180),
    eyebrow: text(input.eyebrow, "Eyebrow", 80),
    body: text(input.body, "Body", 10_000),
    imageCandidateId: text(input.imageCandidateId, "Image candidate ID", 300),
    altText: text(input.altText, "Alt text", 300),
    link: text(input.link, "Link", 2_000),
    buttonLabel: text(input.buttonLabel, "Button label", 80),
    alignment,
    sourceIds,
  };
}

export function validateGenerationOutput(value: unknown): NewsletterGenerationOutput {
  const input = object(value);
  if (!Array.isArray(input.blocks) || !input.blocks.length || input.blocks.length > 30) throw new Error("Newsletter blocks are invalid.");
  return {
    subject: text(input.subject, "Subject", 160, true)!,
    subjectAlternatives: stringArray(input.subjectAlternatives ?? [], "Subject alternatives", 5, 160),
    previewText: text(input.previewText, "Preview text", 180, true)!,
    blocks: input.blocks.map(validateBlock),
    warnings: stringArray(input.warnings ?? [], "Warnings", 20, 500),
  };
}
