import "server-only";

import { getSiteUrl } from "@/lib/site";

function escape(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function paragraphs(value: string) {
  return value.trim().split(/\n{2,}/).map(paragraph =>
    `<p style="margin:0 0 20px;color:#ded8cf;font-family:Arial,sans-serif;font-size:16px;line-height:1.75">${escape(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
}

export function personalizeReferralCopy(value: string, input: {
  firstName: string;
  referralUrl: string;
  referralCode: string;
  campaignTitle: string;
}) {
  return value
    .replaceAll("{{first_name}}", input.firstName)
    .replaceAll("{{referral_link}}", input.referralUrl)
    .replaceAll("{{referral_code}}", input.referralCode)
    .replaceAll("{{campaign_title}}", input.campaignTitle);
}

export function renderReferralInvitationEmail(input: {
  body: string;
  previewText?: string | null;
  unsubscribeToken: string;
  referralUrl: string;
  referralCode: string;
  campaignTitle: string;
}) {
  const unsubscribeUrl = `${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;
  const preview = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(input.previewText)}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0b0b0b">${preview}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0b0b0b"><tr><td align="center" style="padding:36px 14px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px"><tr><td style="padding:0 0 24px;color:#c85f28;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase">Helios Real Estate Media · Referral Studio</td></tr><tr><td style="border:1px solid #302d29;background:#121211;padding:40px 36px"><h1 style="margin:0 0 24px;color:#fff;font-family:Georgia,serif;font-size:30px;font-weight:400;line-height:1.2">${escape(input.campaignTitle)}</h1>${paragraphs(input.body)}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 18px"><tr><td bgcolor="#c85f28" style="background:#c85f28"><a href="${escape(input.referralUrl)}" style="display:inline-block;padding:14px 22px;color:#ffffff!important;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;text-decoration:none!important;text-transform:uppercase">Share a referral</a></td></tr></table><p style="margin:0;color:#8f8a82;font-family:Arial,sans-serif;font-size:12px;line-height:1.6">Referral code: <strong style="color:#ded8cf">${escape(input.referralCode)}</strong></p></td></tr><tr><td style="padding:24px 0;color:#777;font-family:Arial,sans-serif;font-size:11px;line-height:1.7">You are receiving this message because you are a Helios client. <a href="${escape(unsubscribeUrl)}" style="color:#aaa">Unsubscribe from marketing emails</a>.</td></tr></table></td></tr></table></body></html>`;
}
