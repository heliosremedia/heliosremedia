export const EMAIL_TEMPLATE_KEYS = ["SIGNATURE", "EDITORIAL_LIGHT", "OFFER_SPOTLIGHT", "PERSONAL_LETTER"] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATES: Array<{ key: EmailTemplateKey; name: string; description: string; swatch: string }> = [
  { key: "SIGNATURE", name: "Helios Signature", description: "Dark, cinematic, and unmistakably Helios.", swatch: "#121211" },
  { key: "EDITORIAL_LIGHT", name: "Editorial Light", description: "Warm ivory for thoughtful updates and appreciation.", swatch: "#f2ede3" },
  { key: "OFFER_SPOTLIGHT", name: "Offer Spotlight", description: "A polished promotional layout with stronger emphasis.", swatch: "#df6b2b" },
  { key: "PERSONAL_LETTER", name: "Personal Letter", description: "A quiet, relationship-first note from the team.", swatch: "#f7f4ed" },
];

export function normalizeEmailTemplateKey(value: unknown): EmailTemplateKey {
  return typeof value === "string" && EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey)
    ? value as EmailTemplateKey
    : "SIGNATURE";
}

export function cleanPastedEmailText(value: string) {
  return value
    .replace(/^```(?:markdown|md|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/^[•●▪]\s*/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#d96b2b;text-decoration:underline">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");
}

export function renderFormattedEmailBody(body: string, options?: { textColor?: string; mutedColor?: string; headingColor?: string }) {
  const textColor = options?.textColor ?? "#d7d1c8";
  const mutedColor = options?.mutedColor ?? textColor;
  const headingColor = options?.headingColor ?? textColor;
  const source = cleanPastedEmailText(body);
  const blocks = source ? source.split(/\n{2,}/) : [];
  return blocks.map((block) => {
    const lines = block.split("\n");
    const heading = lines[0]?.match(/^(#{1,3})\s+(.+)$/);
    if (heading && lines.length === 1) {
      const size = heading[1].length === 1 ? 28 : heading[1].length === 2 ? 23 : 19;
      return `<h2 style="margin:30px 0 14px;color:${headingColor};font-family:Georgia,serif;font-size:${size}px;font-weight:400;line-height:1.25">${inlineMarkdown(heading[2])}</h2>`;
    }
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul style="margin:0 0 22px;padding-left:22px;color:${mutedColor};font-size:16px;line-height:1.75">${lines.map((line) => `<li style="margin:0 0 7px">${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) {
      return `<ol style="margin:0 0 22px;padding-left:22px;color:${mutedColor};font-size:16px;line-height:1.75">${lines.map((line) => `<li style="margin:0 0 7px">${inlineMarkdown(line.replace(/^\d+[.)]\s+/, ""))}</li>`).join("")}</ol>`;
    }
    if (lines.length === 1 && /^-{3,}$/.test(lines[0].trim())) return '<hr style="border:0;border-top:1px solid rgba(128,128,128,.28);margin:30px 0">';
    return `<p style="margin:0 0 20px;color:${textColor};font-size:16px;line-height:1.75">${lines.map(inlineMarkdown).join("<br>")}</p>`;
  }).join("");
}

