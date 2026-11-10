/** Invitation copy supports only this explicit, non-AI recipient substitution. */
export const EVENT_FIRST_NAME_TOKEN = "{{FIRST_NAME}}";
export const EVENT_PREVIEW_FIRST_NAME = "Alex";
export const EVENT_FIRST_NAME_MAX_LENGTH = 80;

function singleLine(value: string) {
  return value
    .replace(/[\p{Cc}\p{Zl}\p{Zp}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function eventRecipientFirstName(value?: string | null) {
  const name = typeof value === "string" ? singleLine(value) : "";
  return Array.from(name).slice(0, EVENT_FIRST_NAME_MAX_LENGTH).join("").trim() || "there";
}

/** Work on copy, never on a rendered document or any URL/image/token fields. */
export function personalizeEventText(template: string, firstName: string) {
  // A literal token inside a pasted URL is not recipient copy. Keep the URL intact.
  return template.replace(/(?:[a-z][a-z\d+.-]*:\/\/|mailto:)[^\s<>"']+|\{\{FIRST_NAME\}\}/gi,
    token => token === EVENT_FIRST_NAME_TOKEN ? firstName : token);
}

export function personalizeEventCopy(copy: { subject: string; body: string }, recipientFirstName?: string | null) {
  const firstName = eventRecipientFirstName(recipientFirstName);
  return {
    subject: Array.from(singleLine(personalizeEventText(copy.subject, firstName))).slice(0, 200).join(""),
    body: personalizeEventText(copy.body, firstName),
  };
}
