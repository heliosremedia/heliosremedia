import "server-only";

type NewsletterNotificationKind =
  | "DRAFT_READY"
  | "GENERATION_FAILED"
  | "MISSED_APPROVAL"
  | "SEND_COMPLETED"
  | "SEND_FAILED";

const notificationCopy: Record<NewsletterNotificationKind, { subject: string; heading: string }> = {
  DRAFT_READY: { subject: "Your Helios newsletter is ready for review", heading: "Newsletter ready for review" },
  GENERATION_FAILED: { subject: "Helios newsletter generation needs attention", heading: "Newsletter generation failed" },
  MISSED_APPROVAL: { subject: "Helios newsletter missed approval", heading: "Approval deadline missed" },
  SEND_COMPLETED: { subject: "Helios newsletter send completed", heading: "Newsletter delivered" },
  SEND_FAILED: { subject: "Helios newsletter delivery needs attention", heading: "Newsletter delivery failed" },
};

const escape = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character] ?? character);

export async function sendNewsletterAdminNotification(input: {
  kind: NewsletterNotificationKind;
  editionLabel: string;
  detail: string;
  reviewUrl?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CAMPAIGN_EMAIL_FROM?.trim() || process.env.INQUIRY_EMAIL_FROM?.trim() || process.env.PORTAL_EMAIL_FROM?.trim();
  const to = process.env.NEWSLETTER_NOTIFICATION_EMAIL?.trim() || process.env.INQUIRY_NOTIFICATION_EMAIL?.trim();
  if (!apiKey || !from || !to) return { delivered: false, reason: "NOT_CONFIGURED" as const };

  const copy = notificationCopy[input.kind];
  const reviewUrl = input.reviewUrl ? (() => {
    try {
      const parsed = new URL(input.reviewUrl);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
    } catch { return null; }
  })() : null;
  const action = reviewUrl
    ? `<p style="margin:26px 0 0"><a href="${escape(reviewUrl)}" style="display:inline-block;background:#d6682d;color:#fff;padding:13px 20px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Open Newsletter Studio</a></p>`
    : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: copy.subject,
      html: `<div style="margin:0;background:#0b0b0b;padding:40px 20px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto"><p style="margin:0 0 20px;color:#d6682d;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">Helios Newsletter Studio</p><h1 style="margin:0;color:#f4f0e9;font-family:Georgia,serif;font-size:34px;font-weight:400">${escape(copy.heading)}</h1><p style="margin:18px 0 0;color:#d7d1c8;font-size:16px;line-height:1.7">${escape(input.editionLabel)}</p><p style="margin:12px 0 0;color:#96918a;font-size:14px;line-height:1.7">${escape(input.detail)}</p>${action}</div></div>`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    console.error("Resend rejected Newsletter Studio notification", { status: response.status, kind: input.kind });
    return { delivered: false, reason: "PROVIDER_REJECTED" as const };
  }
  return { delivered: true as const };
}
