/** Shared, static invitation styles. Safe to import in client components. */
export const EVENT_TEMPLATE_KEYS = ["CLASSIC", "CHRISTMAS", "NEW_YEAR", "THANKSGIVING", "HALLOWEEN", "EASTER", "SUMMER", "CELEBRATION"] as const;
export type EventTemplateKey = typeof EVENT_TEMPLATE_KEYS[number];
export type EventTheme = {
  key: EventTemplateKey;
  label: string;
  description: string;
  motif: string;
  background: string;
  surface: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  heading: string;
  buttonText: string;
};

export const EVENT_THEMES: readonly EventTheme[] = [
  { key: "CLASSIC", label: "Helios Classic", description: "Signature charcoal and warm copper.", motif: "YOU'RE INVITED", background: "#0b0b0b", surface: "#121211", border: "#2c2a27", accent: "#df6b2b", text: "#d7d1c8", muted: "#b9b1a6", heading: "#f5f1e8", buttonText: "#16110c" },
  { key: "CHRISTMAS", label: "Christmas", description: "Evergreen, cranberry, and a touch of gold.", motif: "MERRY & BRIGHT", background: "#e9eee8", surface: "#fffdf7", border: "#cddace", accent: "#9a293a", text: "#33463a", muted: "#5c6d61", heading: "#193f2b", buttonText: "#ffffff" },
  { key: "NEW_YEAR", label: "New Year", description: "Midnight blue and champagne gold.", motif: "CHEERS TO NEW BEGINNINGS", background: "#101626", surface: "#182338", border: "#3d4960", accent: "#e7c785", text: "#e7eaf0", muted: "#b7c0d1", heading: "#fff2d6", buttonText: "#172136" },
  { key: "THANKSGIVING", label: "Thanksgiving", description: "Autumn terracotta and warm harvest cream.", motif: "GATHER WITH GRATITUDE", background: "#f1e7d9", surface: "#fffaf1", border: "#ddc4a7", accent: "#a34826", text: "#514133", muted: "#76604c", heading: "#67341e", buttonText: "#ffffff" },
  { key: "HALLOWEEN", label: "Halloween", description: "Pumpkin orange and mysterious midnight purple.", motif: "A SPOOKTACULAR GATHERING", background: "#21182b", surface: "#30223d", border: "#5c456c", accent: "#ffb465", text: "#f0e4f5", muted: "#cbbbd5", heading: "#ffdcab", buttonText: "#2b1837" },
  { key: "EASTER", label: "Easter", description: "Fresh spring greens and soft lavender.", motif: "A FRESH REASON TO GATHER", background: "#eeeaf5", surface: "#fffdf8", border: "#d5cbe5", accent: "#617245", text: "#4e465b", muted: "#71667f", heading: "#604c78", buttonText: "#ffffff" },
  { key: "SUMMER", label: "Summer Gathering", description: "Sunshine yellow and coastal teal.", motif: "GOOD COMPANY, SUNNY DAYS", background: "#e7f2ef", surface: "#fffdf3", border: "#bfd8cf", accent: "#08736f", text: "#294b49", muted: "#536f69", heading: "#115b56", buttonText: "#ffffff" },
  { key: "CELEBRATION", label: "Celebration", description: "Festive plum with soft rose accents.", motif: "LET'S CELEBRATE", background: "#f0e8f0", surface: "#fffafd", border: "#dec9dc", accent: "#784179", text: "#503b50", muted: "#735f72", heading: "#603264", buttonText: "#ffffff" },
];

export function normalizeEventTemplateKey(value: unknown): EventTemplateKey {
  return EVENT_TEMPLATE_KEYS.includes(value as EventTemplateKey) ? value as EventTemplateKey : "CLASSIC";
}

export function getEventTheme(value: unknown): EventTheme {
  return EVENT_THEMES.find(theme => theme.key === normalizeEventTemplateKey(value))!;
}

/** Only stable, first-party raster URLs. No tracking query strings, redirects, or SVGs. */
export function safeEventImageUrl(value: unknown, allowedBaseUrls: readonly (string | null | undefined)[]): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return null;
  try {
    const image = new URL(raw);
    if (image.protocol !== "https:" || image.username || image.password || image.search || image.hash || !/\.(?:jpe?g|png)$/i.test(image.pathname)) return null;
    const allowed = allowedBaseUrls.some(base => {
      if (!base) return false;
      try {
        const root = new URL(base.trim());
        const prefix = `${root.pathname.replace(/\/+$/, "")}/`;
        return root.protocol === "https:" && !root.username && !root.password && !root.search && !root.hash && image.origin === root.origin && image.pathname.startsWith(prefix);
      } catch { return false; }
    });
    return allowed ? image.toString() : null;
  } catch { return null; }
}

/** Website links are optional, explicit HTTPS destinations, never script/data URLs. */
export function safeEventVenueUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000 || /[\u0000-\u0020\u007f\\]/.test(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export type EventEmailStage = "INITIAL" | "FOLLOW_UP" | "REMINDER";
export type EventEmailContent = Partial<Record<EventEmailStage, {subject: string; body: string}>>;

export function normalizeEventEmailContent(value: unknown): EventEmailContent {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Email copy must contain the invitation, follow-up, and reminder messages.");
  const content: EventEmailContent = {};
  for (const stage of ["INITIAL", "FOLLOW_UP", "REMINDER"] as const) {
    const entry = (value as Record<string, unknown>)[stage];
    if (entry == null) continue;
    if (typeof entry !== "object" || Array.isArray(entry)) throw new Error("Enter valid email subject and message text.");
    const fields = entry as Record<string, unknown>;
    const subject = typeof fields.subject === "string" ? fields.subject.trim() : "";
    const body = typeof fields.body === "string" ? fields.body.trim() : "";
    if (subject.length > 200 || body.length > 10000) throw new Error("Email subjects must be 200 characters or fewer, and messages 10,000 characters or fewer.");
    if (/[\r\n\u0000]/.test(subject)) throw new Error("Email subjects must be a single line.");
    content[stage] = { subject, body };
  }
  return content;
}

export function getEventEmailCopy(event: {title: string; description: string; emailContent?: unknown}, stage: string) {
  const selected: EventEmailStage = stage === "FOLLOW_UP" || stage === "REMINDER" ? stage : "INITIAL";
  const defaults = {
    INITIAL: {subject: `You're invited: ${event.title}`, body: `${event.title}\n\n${event.description}`},
    FOLLOW_UP: {subject: `RSVP reminder: ${event.title}`, body: `We'd love to see you at ${event.title}. If you haven't decided yet, please let us know if you can join us.\n\n${event.description}`},
    REMINDER: {subject: `Event reminder: ${event.title}`, body: `We're looking forward to seeing you at ${event.title}! Here are the details to help you plan your visit.\n\n${event.description}`},
  };
  // Pre-migration events retain their previously scheduled prose until edited as a draft.
  if (event.emailContent === null) defaults[selected].body = `${event.title}\n\n${event.description}`;
  let overrides: EventEmailContent = {};
  try { overrides = normalizeEventEmailContent(event.emailContent); } catch { /* Old or invalid saved copy falls back safely. */ }
  return { subject: overrides[selected]?.subject || defaults[selected].subject, body: overrides[selected]?.body || defaults[selected].body };
}
