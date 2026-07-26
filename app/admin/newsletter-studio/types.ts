export type NewsletterStatus =
  | "AWAITING_GENERATION" | "GENERATING" | "DRAFT_GENERATED" | "NEEDS_REVIEW"
  | "APPROVED" | "SCHEDULED" | "SENDING" | "SENT" | "PAUSED"
  | "MISSED_APPROVAL" | "GENERATION_FAILED" | "SEND_FAILED" | "PARTIALLY_SENT" | "CANCELLED";

export type BlockType =
  | "HERO" | "OPENING_NOTE" | "FEATURED_STORY" | "PORTFOLIO_SPOTLIGHT"
  | "HELPFUL_TIP" | "SERVICE_SPOTLIGHT" | "EVENT_ANNOUNCEMENT" | "IMAGE"
  | "CALL_TO_ACTION" | "DIVIDER" | "SPACER" | "CLOSING_NOTE";

export type NewsletterBlock = {
  id: string; type: BlockType; label: string; eyebrow?: string; heading?: string;
  body?: string; imageUrl?: string; altText?: string; link?: string;
  buttonLabel?: string; alignment?: "left" | "center"; provenance?: string[];
  aiGenerated?: boolean; manuallyEdited?: boolean;
  imageLink?: string; imageIsVideo?: boolean;
  imageSelection?: {
    mode: "AUTO" | "SOURCE" | "GALLERY" | "AI" | "CUSTOM" | "NONE";
    candidateId?: string; assetId?: string; assetSource?: "PORTFOLIO" | "BLOG" | "AI";
    sourceLabel?: string; attribution?: string;
  };
  imageCandidates?: Array<{
    id: string; url: string; thumbnailUrl?: string; altText?: string; label: string;
    role: string; destinationUrl?: string; isVideo?: boolean; width?: number; height?: number;
  }>;
};

export type NewsletterGalleryImage = {
  id: string; assetId: string; source: "PORTFOLIO" | "BLOG" | "AI";
  url: string; thumbnailUrl?: string; label: string; altText: string;
  attribution: string; destinationUrl?: string; width?: number | null; height?: number | null;
};

export type NewsletterEdition = {
  id: string; seriesId: string; seriesName: string; subject: string; previewText: string;
  status: NewsletterStatus; generationAt?: string | null; intendedSendAt?: string | null;
  groupNames: string[]; eligibleCount: number; excludedCount: number; warnings: string[];
  publishableNotes: string; internalNotes: string; blocks: NewsletterBlock[];
};

export type NewsletterSeries = {
  id: string; name: string; description: string; active: boolean; groupIds: string[];
  individualRecipientIds: string[]; senderName: string; replyTo: string;
  brandInstructions: string; goals: string; defaultCta: string; timezone: string;
  generationRule: string; sendRule: string; nextGenerationAt?: string | null;
  nextSendAt?: string | null;
};

export type NewsletterDashboardData = {
  nextEdition: NewsletterEdition | null; editions: NewsletterEdition[];
  series: NewsletterSeries[]; groups: Array<{ id: string; name: string; count: number }>;
};
