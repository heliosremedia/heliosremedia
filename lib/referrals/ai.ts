export type ReferralCampaignDraft = {
  publicTitle: string;
  campaignConcept: string;
  referralOfferSuggestions: string[];
  invitationSubject: string;
  invitationBody: string;
  followUpBody: string;
  landingHeadline: string;
  landingBody: string;
  referralConfirmation: string;
  advocateThankYou: string;
  rewardNotification: string;
  termsSummary: string;
  suggestedAudience: string;
  suggestedFollowUpDays: number;
  warnings: string[];
};

function required(value: unknown, name: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`AI returned an invalid ${name}.`);
  return value.trim();
}

export function validateReferralCampaignDraft(value: unknown): ReferralCampaignDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI output is not a referral campaign draft.");
  const draft = value as Record<string, unknown>;
  const offers = Array.isArray(draft.referralOfferSuggestions)
    ? draft.referralOfferSuggestions.map(item => required(item, "offer suggestion", 500)).slice(0, 5)
    : [];
  const warnings = Array.isArray(draft.warnings)
    ? draft.warnings.map(item => required(item, "warning", 500)).slice(0, 10)
    : [];
  const timing = Number(draft.suggestedFollowUpDays);
  return {
    publicTitle: required(draft.publicTitle, "title", 180),
    campaignConcept: required(draft.campaignConcept, "concept", 2_000),
    referralOfferSuggestions: offers,
    invitationSubject: required(draft.invitationSubject, "invitation subject", 180),
    invitationBody: required(draft.invitationBody, "invitation body", 12_000),
    followUpBody: required(draft.followUpBody, "follow-up body", 12_000),
    landingHeadline: required(draft.landingHeadline, "landing headline", 240),
    landingBody: required(draft.landingBody, "landing body", 8_000),
    referralConfirmation: required(draft.referralConfirmation, "confirmation", 2_000),
    advocateThankYou: required(draft.advocateThankYou, "thank-you", 4_000),
    rewardNotification: required(draft.rewardNotification, "reward notification", 4_000),
    termsSummary: required(draft.termsSummary, "terms summary", 4_000),
    suggestedAudience: required(draft.suggestedAudience, "audience suggestion", 2_000),
    suggestedFollowUpDays: Number.isInteger(timing) ? Math.max(2, Math.min(60, timing)) : 7,
    warnings,
  };
}

function outputText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const payload = result as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output ?? []).flatMap(item => item.content ?? []).map(item => typeof item.text === "string" ? item.text : "").join("");
}

export async function generateReferralCampaignDraft(input: {
  brief: string;
  verifiedBusiness: {
    businessName: string;
    brandVoice: string;
    audience: string;
    services: string[];
  };
  existingConfiguration?: Record<string, unknown>;
  action: "GENERATE" | "REWRITE" | "SHORTEN" | "MORE_PERSONAL" | "MORE_PROFESSIONAL" | "REGENERATE";
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Referral AI is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_REFERRAL_MODEL?.trim() || process.env.OPENAI_NEWSLETTER_MODEL?.trim() || "gpt-5-mini",
      instructions: [
        `You are the referral campaign assistant for ${input.verifiedBusiness.businessName}.`,
        `Brand voice: ${input.verifiedBusiness.brandVoice}. Audience: ${input.verifiedBusiness.audience}.`,
        `Verified services: ${input.verifiedBusiness.services.join(", ") || "No service list provided"}.`,
        "Use only the verified business details, administrator brief, and existing configuration.",
        "Never invent discounts, reward values, services, client history, transactions, testimonials, deadlines, legal terms, or performance claims.",
        "If a commercial term is not supplied, use an editable placeholder and add a warning.",
        "Never approve, schedule, send, enroll a client, issue a reward, or change a referral status.",
        "Preserve manual content unless the requested action explicitly asks to replace it.",
      ].join("\n"),
      input: JSON.stringify({ action: input.action, brief: input.brief, existingConfiguration: input.existingConfiguration ?? {} }),
      text: {
        format: {
          type: "json_schema", name: "helios_referral_campaign", strict: true,
          schema: {
            type: "object", additionalProperties: false,
            required: ["publicTitle", "campaignConcept", "referralOfferSuggestions", "invitationSubject", "invitationBody", "followUpBody", "landingHeadline", "landingBody", "referralConfirmation", "advocateThankYou", "rewardNotification", "termsSummary", "suggestedAudience", "suggestedFollowUpDays", "warnings"],
            properties: {
              publicTitle: { type: "string" }, campaignConcept: { type: "string" },
              referralOfferSuggestions: { type: "array", items: { type: "string" }, maxItems: 5 },
              invitationSubject: { type: "string" }, invitationBody: { type: "string" },
              followUpBody: { type: "string" }, landingHeadline: { type: "string" },
              landingBody: { type: "string" }, referralConfirmation: { type: "string" },
              advocateThankYou: { type: "string" }, rewardNotification: { type: "string" },
              termsSummary: { type: "string" }, suggestedAudience: { type: "string" },
              suggestedFollowUpDays: { type: "integer", minimum: 2, maximum: 60 },
              warnings: { type: "array", items: { type: "string" }, maxItems: 10 },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenAI rejected referral generation (${response.status}).`);
  const output = outputText(await response.json());
  if (!output) throw new Error("OpenAI returned an empty referral campaign draft.");
  return validateReferralCampaignDraft(JSON.parse(output) as unknown);
}
