/** Shared, browser-safe configuration for the existing anonymous Google Form. */
export const FEEDBACK_SURVEY = {
  id: "client-experience-2026",
  title: "Client experience survey",
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc48jKJTI2cg28g1W_tnZ83nGMOd-EKQvhMHTEFHICjtwuqQA/viewform",
  resultsUrl: "https://docs.google.com/forms/d/12A9z_V6EDtuZlMVi8xzvg_F6wq30ojlYNe1DEQMDkX0/edit#responses",
  originalCampaignId: "cmw9mxgiz00eu08l9d2ah46fd",
  anonymousNotice: "This form is anonymous. Helios cannot identify who has responded, so your selected audience may include clients who already completed it.",
  alreadyCompletedText: "If you’ve already shared your feedback, thank you! There’s no need to complete the survey again.",
} as const;

export const FEEDBACK_MODES = ["ORIGINAL", "ALL", "GROUPS", "INDIVIDUALS"] as const;
export type FeedbackAudienceMode = (typeof FEEDBACK_MODES)[number];
export const FEEDBACK_TEMPLATE_KEY = "PERSONAL_LETTER";
export const FEEDBACK_DEFAULT_SUBJECT = "A quick reminder: help us make Helios even better";
export const FEEDBACK_DEFAULT_PREVIEW = "We’d love to hear about your experience with Helios.";
export const FEEDBACK_DEFAULT_BODY = "Hi {{FIRST_NAME}},\n\nWe’d love to hear what’s working well and what we could do better. Your feedback helps us make every shoot and delivery better for you.\n\nIf you have a few minutes, please share your experience in our short, anonymous survey. There’s a small thank-you waiting at the end.\n\nThank you for being part of Helios,\nThe Helios team";
export const FEEDBACK_REQUIRED_FOOTER = `[Share your feedback](${FEEDBACK_SURVEY.formUrl})\n\n${FEEDBACK_SURVEY.alreadyCompletedText}`;

export type FeedbackDraft = {
  subject: string;
  previewText: string;
  body: string;
  mode: FeedbackAudienceMode;
  groupIds: string[];
  clientIds: string[];
};
export type FeedbackSelection = {
  feedbackSurveyId: string;
  workspaceId: string;
  originalCampaignId: string;
  groupIds: string[];
  clientIds: string[];
};
export type FeedbackReminder = {
  id: string;
  subject: string;
  previewText: string;
  /** Editable copy only. The fixed survey link and acknowledgement are appended on the server. */
  body: string;
  mode: FeedbackAudienceMode;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  scheduledTimeZone: string | null;
  rowVersion: number;
  selection: FeedbackSelection;
  createdAt: string;
  sentAt: string | null;
  scheduleError: string | null;
};
export type FeedbackClient = { id: string; displayName: string; email: string; groupIds: string[]; isOriginalRecipient: boolean };
export type FeedbackDashboard = {
  survey: typeof FEEDBACK_SURVEY;
  clients: FeedbackClient[];
  groups: Array<{ id: string; name: string; count: number }>;
  originalCampaign: { id: string; subject: string; recipientCount: number; sentCount: number; sentAt: string | null; eligibleRecipientCount: number } | null;
  reminders: FeedbackReminder[];
  defaultTestEmail: string;
};

export function newFeedbackDraft(): FeedbackDraft {
  return { subject: FEEDBACK_DEFAULT_SUBJECT, previewText: FEEDBACK_DEFAULT_PREVIEW, body: FEEDBACK_DEFAULT_BODY, mode: "ORIGINAL", groupIds: [], clientIds: [] };
}

export function isFeedbackSelection(value: unknown): value is FeedbackSelection {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    "feedbackSurveyId" in value && value.feedbackSurveyId === FEEDBACK_SURVEY.id;
}

/** Always append a complete, trusted block, even when editable copy contains a partial link. */
export function feedbackEmailBody(body: string) {
  return `${feedbackEditableBody(body)}\n\n${FEEDBACK_REQUIRED_FOOTER}`.trim();
}
export function feedbackEditableBody(body: string) {
  let copy = body.trim();
  while (copy.endsWith(FEEDBACK_REQUIRED_FOOTER)) copy = copy.slice(0, -FEEDBACK_REQUIRED_FOOTER.length).trim();
  return copy;
}
export function feedbackAudience(clients: FeedbackClient[], selection: Pick<FeedbackDraft, "mode" | "groupIds" | "clientIds">) {
  const groupIds = new Set(selection.groupIds);
  const clientIds = new Set(selection.clientIds);
  const matches = clients.filter((client) => selection.mode === "ALL" ||
    (selection.mode === "ORIGINAL" && client.isOriginalRecipient) ||
    (selection.mode === "GROUPS" && client.groupIds.some((id) => groupIds.has(id))) ||
    (selection.mode === "INDIVIDUALS" && clientIds.has(client.id)));
  return [...new Map(matches.map((client) => [client.email.trim().toLowerCase(), client])).values()];
}

export class FeedbackError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.name = "FeedbackError"; this.status = status; }
}
export function feedbackUuid(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new FeedbackError("A valid operation ID is required. Refresh and try again.");
  }
  return value.toLowerCase();
}
export function feedbackRowVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new FeedbackError("Refresh this reminder before changing it.", 409);
  return value as number;
}
export function assertFeedbackOrigin(request: Request) {
  // Browser writes must supply the exact origin; absent/null origins fail closed.
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new FeedbackError("Open Feedback in this Studio before making changes.", 403);
  }
}
