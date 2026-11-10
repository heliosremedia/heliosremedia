export type InquiryEmailEnvironment = {
  [key: string]: string | undefined;
  RESEND_API_KEY?: string;
  INQUIRY_EMAIL_FROM?: string;
  PORTAL_EMAIL_FROM?: string;
  CAMPAIGN_EMAIL_FROM?: string;
  INQUIRY_NOTIFICATION_EMAIL?: string;
  HELIOS_ADMIN_EMAIL?: string;
};

function value(raw: string | undefined, key: string) {
  let result = raw?.trim() || "";
  const unquote = (text: string) => /^(".*"|'.*')$/.test(text) ? text.slice(1, -1).trim() : text;
  result = unquote(result);
  if (result.startsWith(`${key}=`)) result = result.slice(key.length + 1).trim();
  return unquote(result);
}

function validMailbox(address: string, allowDisplayName = false) {
  if (/[\r\n]/.test(address)) return false;
  const mailbox = allowDisplayName ? address.match(/^[^<>]*<([^<>]+)>$/)?.[1] || address : address;
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(mailbox);
}

export function resolveInquiryEmailConfig(environment: InquiryEmailEnvironment) {
  const apiKey = value(environment.RESEND_API_KEY, "RESEND_API_KEY");
  const from = value(environment.INQUIRY_EMAIL_FROM, "INQUIRY_EMAIL_FROM") ||
    value(environment.PORTAL_EMAIL_FROM, "PORTAL_EMAIL_FROM") ||
    value(environment.CAMPAIGN_EMAIL_FROM, "CAMPAIGN_EMAIL_FROM");
  const to = value(environment.INQUIRY_NOTIFICATION_EMAIL, "INQUIRY_NOTIFICATION_EMAIL") ||
    value(environment.HELIOS_ADMIN_EMAIL, "HELIOS_ADMIN_EMAIL");
  const senderIssues: string[] = [];
  if (!apiKey) senderIssues.push("Email provider credentials are missing.");
  if (!from) senderIssues.push("A verified sender address is missing.");
  else if (!validMailbox(from, true)) senderIssues.push("The sender address is invalid.");
  const issues = [...senderIssues];
  if (!to) issues.push("A notification recipient is missing.");
  else if (!validMailbox(to)) issues.push("The notification recipient address is invalid.");
  return { apiKey, from, to, senderIssues, issues, senderReady: senderIssues.length === 0, notificationReady: issues.length === 0 };
}
