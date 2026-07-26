import "server-only";

import sanitizeHtml from "sanitize-html";
import { getSiteUrl } from "@/lib/site";
import { renderNewsletterCta } from "./presentation";
import { renderNewsletterImage } from "./email-images";

type RenderableBlock = {
  type: string;
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLink?: string | null;
  imageIsVideo?: boolean | null;
  linkUrl?: string | null;
  buttonLabel?: string | null;
};

const escape = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character] ?? character);

function url(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? escape(parsed.toString()) : null;
  } catch { return null; }
}

function body(value: string | null | undefined) {
  return sanitizeHtml(value ?? "", {
    allowedTags: ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li"],
    allowedAttributes: {},
  });
}

function renderBlock(block: RenderableBlock) {
  if (block.type === "DIVIDER") return `<tr><td style="padding:18px 42px"><div style="border-top:1px solid #ded8ce"></div></td></tr>`;
  if (block.type === "SPACER") return `<tr><td height="28" style="height:28px;line-height:28px">&nbsp;</td></tr>`;
  const link = url(block.linkUrl);
  const heading = block.heading ? `<h2 style="margin:0 0 16px;color:#171614;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:400">${escape(block.heading)}</h2>` : "";
  const eyebrow = block.eyebrow ? `<p style="margin:0 0 12px;color:#c85f28;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:.16em;text-transform:uppercase">${escape(block.eyebrow)}</p>` : "";
  const copy = block.body ? `<div style="color:#54504a;font-size:16px;line-height:1.75">${body(block.body)}</div>` : "";
  const artwork = renderNewsletterImage(block);
  const button = link && block.buttonLabel ? renderNewsletterCta(link, escape(block.buttonLabel)) : "";
  return `${artwork}<tr><td style="padding:34px 42px">${eyebrow}${heading}${copy}${button}</td></tr>`;
}

export function renderNewsletterEmail(input: {
  previewText?: string | null;
  blocks: RenderableBlock[];
  unsubscribeToken: string;
  businessName?: string;
  businessAddress?: string | null;
}) {
  const unsubscribeUrl = `${getSiteUrl()}/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`;
  const preview = input.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(input.previewText)}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#ece7de">${preview}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#ece7de"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#f8f5ef"><tr><td style="padding:28px 42px;background:#11110f;color:#f8f5ef;font-family:Arial,sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase">${escape(input.businessName || "Helios Real Estate Media")}</td></tr>${input.blocks.map(renderBlock).join("")}<tr><td style="padding:30px 42px;background:#11110f;color:#8f8b84;font-family:Arial,sans-serif;font-size:11px;line-height:1.7"><p style="margin:0">You are receiving this email because you are a Helios client.</p>${input.businessAddress ? `<p style="margin:5px 0 0">${escape(input.businessAddress)}</p>` : ""}<p style="margin:12px 0 0"><a href="${escape(unsubscribeUrl)}" style="color:#d6d0c8">Unsubscribe from marketing emails</a></p></td></tr></table></td></tr></table></body></html>`;
}
