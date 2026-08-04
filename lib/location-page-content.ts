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

export function normalizeAiDraft(value: unknown, hasImage: boolean) {
  if (!value || typeof value !== "object") throw new Error("INVALID_AI_DRAFT");
  const record = value as Record<string, unknown>;
  const fields = Object.fromEntries(AI_LOCATION_FIELDS.flatMap((field) => {
    if (field === "featureImageAlt" && !hasImage) return [];
    const raw = typeof record[field] === "string" ? record[field].trim() : "";
    if (!raw) return [];
    if (raw.includes("—")) throw new Error("INVALID_AI_DRAFT");
    const limitKey = field as keyof typeof LOCATION_FIELD_LIMITS;
    if (raw.length > LOCATION_FIELD_LIMITS[limitKey]) throw new Error("INVALID_AI_DRAFT");
    return [[field, raw]];
  }));
  if (!Object.keys(fields).length) throw new Error("INVALID_AI_DRAFT");
  return fields as Partial<Record<EditableLocationField, string>>;
}
