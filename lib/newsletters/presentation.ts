export const NEWSLETTER_CTA = {
  backgroundColor: "#c85f28",
  color: "#ffffff",
  textDecoration: "none",
} as const;

export const NEWSLETTER_CTA_EMAIL_STYLE =
  "display:inline-block;background-color:#c85f28;color:#ffffff;text-decoration:none;padding:13px 22px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase";

export function renderNewsletterCta(link: string, label: string) {
  return `<p style="margin:24px 0 0"><a href="${link}" style="${NEWSLETTER_CTA_EMAIL_STYLE}">${label}</a></p>`;
}

export function shouldExecuteNewsletterJob(seriesStatus: string) {
  return seriesStatus === "ACTIVE";
}

export function testEmailSubject(subject: string) {
  return `[TEST] ${subject.replace(/^\[TEST\]\s*/i, "")}`;
}
