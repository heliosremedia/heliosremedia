export const LOCATION_FIELD_LIMITS = {
  city: 100,
  state: 100,
  county: 140,
  slug: 120,
  seoTitle: 160,
  seoDescription: 320,
  heroLead: 320,
  introduction: 1400,
  marketTitle: 240,
  marketCopy: 1400,
  serviceArea: 500,
  ctaHeadline: 240,
  featureImageAlt: 240,
  detail: 240,
  customDirection: 1200,
} as const;

export type EditableLocationField =
  | "heroLead"
  | "introduction"
  | "marketTitle"
  | "marketCopy"
  | "ctaHeadline"
  | "seoTitle"
  | "seoDescription"
  | "featureImageAlt";

export const AI_LOCATION_FIELDS: EditableLocationField[] = [
  "heroLead", "introduction", "marketTitle", "marketCopy", "ctaHeadline",
  "seoTitle", "seoDescription", "featureImageAlt",
];

export function splitParagraphs(value: string) {
  return value.split(/\r?\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

export function locationFieldError(field: keyof typeof LOCATION_FIELD_LIMITS, value: string) {
  const limit = LOCATION_FIELD_LIMITS[field];
  return value.length > limit ? `Must be ${limit.toLocaleString()} characters or fewer.` : null;
}

function fitAiField(value: string, limit: number) {
  const normalized = value
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
  if (normalized.length <= limit) return normalized;

  const withinLimit = normalized.slice(0, limit + 1);
  const sentenceEnd = Math.max(
    withinLimit.lastIndexOf(". "),
    withinLimit.lastIndexOf("! "),
    withinLimit.lastIndexOf("? "),
  );
  if (sentenceEnd >= Math.floor(limit * 0.65)) return withinLimit.slice(0, sentenceEnd + 1).trim();

  const wordEnd = withinLimit.slice(0, limit).lastIndexOf(" ");
  return withinLimit.slice(0, wordEnd > 0 ? wordEnd : limit).trim().replace(/[,:;]+$/, "");
}

export function normalizeAiDraft(value: unknown, hasImage: boolean) {
  if (!value || typeof value !== "object") throw new Error("INVALID_AI_DRAFT");
  const record = value as Record<string, unknown>;
  const fields = Object.fromEntries(AI_LOCATION_FIELDS.flatMap((field) => {
    if (field === "featureImageAlt" && !hasImage) return [];
    const raw = typeof record[field] === "string" ? record[field] : "";
    const limitKey = field as keyof typeof LOCATION_FIELD_LIMITS;
    const fitted = fitAiField(raw, LOCATION_FIELD_LIMITS[limitKey]);
    return fitted ? [[field, fitted]] : [];
  }));
  if (!Object.keys(fields).length) throw new Error("INVALID_AI_DRAFT");
  return fields as Partial<Record<EditableLocationField, string>>;
}
