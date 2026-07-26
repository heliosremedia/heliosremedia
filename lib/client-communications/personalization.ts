export const PERSONALIZATION_VARIABLES = [
  "FIRST_NAME", "LAST_NAME", "FULL_NAME", "EMAIL", "PHONE",
] as const;

export type PersonalizationRecipient = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email: string;
  phone?: string | null;
};

const tokenPattern = /\{\{([A-Za-z0-9_]+)\}\}/g;

export function findUnsupportedVariables(...templates: Array<string | null | undefined>) {
  const supported = new Set<string>(PERSONALIZATION_VARIABLES);
  return [...new Set(templates.flatMap((template) =>
    [...(template ?? "").matchAll(tokenPattern)]
      .map((match) => match[1])
      .filter((name) => !supported.has(name)),
  ))];
}

export function renderPersonalizedText(template: string, recipient: PersonalizationRecipient) {
  const firstName = recipient.firstName?.trim() || "";
  const values: Record<(typeof PERSONALIZATION_VARIABLES)[number], string> = {
    FIRST_NAME: firstName || "there",
    LAST_NAME: recipient.lastName?.trim() || "",
    FULL_NAME: recipient.fullName?.trim() || firstName || recipient.email || "there",
    EMAIL: recipient.email,
    PHONE: recipient.phone?.trim() || "",
  };
  return template
    .replace(tokenPattern, (token, name: string) =>
      Object.hasOwn(values, name) ? values[name as keyof typeof values] : token)
    .replace(/[ \t]+([,.;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}

export function renderPersonalizedEmail(input: {
  subject: string;
  previewText?: string | null;
  body: string;
  recipient: PersonalizationRecipient;
}) {
  return {
    subject: renderPersonalizedText(input.subject, input.recipient),
    previewText: renderPersonalizedText(input.previewText ?? "", input.recipient),
    body: renderPersonalizedText(input.body, input.recipient),
  };
}
