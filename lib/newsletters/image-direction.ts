type DirectionContext = {
  label?: string | null;
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
  editionTheme?: string | null;
};

function concise(value: string | null | undefined, max = 220) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildNewsletterImageDirection(context: DirectionContext) {
  const subject = concise(context.heading || context.eyebrow || context.label, 120);
  const supporting = concise(context.body, 260);
  const theme = concise(context.editionTheme, 120);
  if (!subject && !supporting && !theme) return "";
  return [
    `Subject: editorial visual inspired by ${subject || theme || "the selected newsletter block"}.`,
    supporting ? `Context: ${supporting}.` : "",
    theme && theme !== subject ? `Edition theme: ${theme}.` : "",
    "Setting: refined, authentic real-estate media environment; do not invent a specific property or location.",
    "Mood and lighting: warm, premium, natural, cinematic light.",
    "Composition: clean landscape editorial frame with comfortable negative space for email copy.",
    "Avoid: logos, readable text, watermarks, identifiable people, invented events, addresses, or property claims.",
  ].filter(Boolean).join("\n");
}
