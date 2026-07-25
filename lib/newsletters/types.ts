export const NEWSLETTER_EDITION_STATUSES = [
  "AWAITING_GENERATION", "GENERATING", "DRAFT_GENERATED", "NEEDS_REVIEW",
  "APPROVED", "SCHEDULED", "SENDING", "SENT", "PAUSED", "MISSED_APPROVAL",
  "GENERATION_FAILED", "SEND_FAILED", "PARTIALLY_SENT", "CANCELLED",
] as const;

export type NewsletterEditionStatus = (typeof NEWSLETTER_EDITION_STATUSES)[number];
export type WeekOrdinal = "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST";
export type RecurrenceRule =
  | { kind: "DAY_OF_MONTH"; dayOfMonth: number; localTime: string }
  | { kind: "NTH_WEEKDAY"; ordinal: WeekOrdinal; weekday: number; localTime: string };

export type GenerationRule =
  | { mode: "MANUAL" }
  | { mode: "DAYS_BEFORE_SEND"; daysBeforeSend: number; localTime?: string }
  | { mode: "RECURRENCE"; recurrence: RecurrenceRule };

export const NEWSLETTER_BLOCK_TYPES = [
  "HERO", "OPENING_NOTE", "FEATURED_STORY", "PORTFOLIO_SPOTLIGHT",
  "HELPFUL_TIP", "SERVICE_SPOTLIGHT", "EVENT_ANNOUNCEMENT", "IMAGE",
  "CALL_TO_ACTION", "DIVIDER", "SPACER", "CLOSING_NOTE",
] as const;
export type NewsletterBlockType = (typeof NEWSLETTER_BLOCK_TYPES)[number];

export type NewsletterBlockOutput = {
  type: NewsletterBlockType;
  internalLabel?: string;
  heading?: string;
  eyebrow?: string;
  body?: string;
  imageUrl?: string;
  altText?: string;
  link?: string;
  buttonLabel?: string;
  alignment?: "LEFT" | "CENTER";
  sourceIds: string[];
};

export type NewsletterGenerationOutput = {
  subject: string;
  subjectAlternatives: string[];
  previewText: string;
  blocks: NewsletterBlockOutput[];
  warnings: string[];
};

export type RecipientSelection = {
  mode: "ALL" | "GROUPS" | "INDIVIDUALS" | "GROUPS_AND_INDIVIDUALS";
  groupIds: string[];
  clientIds: string[];
};

export type EligibleRecipient = {
  id: string;
  displayName: string;
  email: string;
  normalizedEmail: string;
};
