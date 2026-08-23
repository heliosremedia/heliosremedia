import "server-only";

import { getSiteUrl } from "@/lib/site";
import { testEmailSubject } from "@/lib/newsletters/presentation";
import {
  sendEmail,
  sendEmailBatch,
  type DeliverySource,
} from "./providers/resend";
import { normalizeEmailTemplateKey, renderFormattedEmailBody, type EmailTemplateKey } from "./email-format";

export { EmailDeliveryError } from "./providers/resend";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function renderCampaignEmail(input: {
  body: string;
  previewText?: string | null;
  unsubscribeToken: string;
  templateKey?: EmailTemplateKey | string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  imageLink?: string | null;
}) {
  const templateKey = normalizeEmailTemplateKey(input.templateKey);
  const themes = {
    SIGNATURE: { outer: "#0b0b0b", card: "#121211", border: "#2c2a27", text: "#d7d1c8", muted: "#d7d1c8", heading: "#f5f1e8", footer: "#777", brand: "Helios Real Estate Media" },
    EDITORIAL_LIGHT: { outer: "#e8e2d7", card: "#f5f0e7", border: "#d8cfc0", text: "#4e4942", muted: "#5e5850", heading: "#201e1b", footer: "#756e65", brand: "The Helios Journal" },
    OFFER_SPOTLIGHT: { outer: "#0b0b0b", card: "#171411", border: "#d96b2b", text: "#e5ddd2", muted: "#e5ddd2", heading: "#fff8ef", footer: "#777", brand: "A Helios Client Exclusive" },
    PERSONAL_LETTER: { outer: "#e9e5dc", card: "#f8f5ee", border: "#d8d1c5", text: "#4f4a43", muted: "#5d574f", heading: "#24211d", footer: "#756e65", brand: "A note from Helios" },
  } as const;
  const theme = themes[templateKey];
  const paragraphs = renderFormattedEmailBody(input.body, { textColor: theme.text, mutedColor: theme.muted, headingColor: theme.heading });
  const unsubscribeUrl = `${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;
  const preview = input.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.previewText)}</div>`
    : "";
  const cardRadius = templateKey === "PERSONAL_LETTER" ? "0" : "3px";
  const accent = templateKey === "OFFER_SPOTLIGHT" ? "border-top:5px solid #d96b2b;" : "";
  const safeHttpsUrl = (value?: string | null) => { try { const parsed = new URL(value || ""); return parsed.protocol === "https:" ? parsed.toString() : null; } catch { return null; } };
  const imageUrl = safeHttpsUrl(input.imageUrl);
  const imageLink = safeHttpsUrl(input.imageLink);
  const image = imageUrl ? `<div style="margin:0 0 28px">${imageLink ? `<a href="${escapeHtml(imageLink)}" target="_blank">` : ""}<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(input.imageAlt || "")}" width="568" style="display:block;width:100%;max-width:568px;height:auto;border:0;border-radius:3px">${imageLink ? "</a>" : ""}${input.imageCaption ? `<p style="margin:9px 0 0;color:${theme.muted};font-size:11px;line-height:1.5">${escapeHtml(input.imageCaption)}</p>` : ""}</div>` : "";
  return `${preview}<div style="margin:0;background:${theme.outer};padding:40px 18px;font-family:Arial,sans-serif"><div style="max-width:${templateKey === "PERSONAL_LETTER" ? "600" : "640"}px;margin:auto"><p style="margin:0 0 28px;color:#df6b2b;font-size:11px;letter-spacing:.2em;text-transform:uppercase">${theme.brand}</p><div style="${accent}border:1px solid ${theme.border};border-radius:${cardRadius};background:${theme.card};padding:42px 36px">${image}${paragraphs}</div><p style="margin:26px 0 0;color:${theme.footer};font-size:11px;line-height:1.6">You are receiving this email because you are a Helios client.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:${theme.footer}">Unsubscribe from marketing emails</a></p></div></div>`;
}

export async function sendTestCampaign(input: {
  to: string;
  subject: string;
  html: string;
  source?: DeliverySource;
  operationId?: string;
}) {
  return sendEmail({
    to: input.to,
    subject: testEmailSubject(input.subject),
    html: input.html,
    source: input.source || "test",
    operationId: input.operationId,
  });
}

export async function sendCampaignBatch(input: {
  campaignId: string;
  messages: Array<{ to: string; subject: string; html: string; unsubscribeUrl?: string }>;
  from?: string | null;
  replyTo?: string | null;
  source?: Exclude<DeliverySource, "test">;
  revisionKey?: string;
}) {
  return sendEmailBatch({
    ...input,
    source: input.source || "campaign",
  });
}
