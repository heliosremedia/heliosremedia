import { createHash } from "node:crypto";

export const PORTFOLIO_EVENT_NAMES = [
  "PORTFOLIO_VIEW",
  "PROJECT_VIEW",
  "PORTFOLIO_CARD_CLICK",
  "PORTFOLIO_FILTER_USE",
  "GALLERY_IMAGE_OPEN",
  "VIDEO_START",
  "VIDEO_PROGRESS_25",
  "VIDEO_PROGRESS_50",
  "VIDEO_PROGRESS_75",
  "VIDEO_COMPLETE",
  "PROJECT_SHARE",
  "CTA_CLICK",
  "OUTBOUND_LINK_CLICK",
] as const;

export type PortfolioEventName = (typeof PORTFOLIO_EVENT_NAMES)[number];

export type PortfolioEventInput = {
  eventName: PortfolioEventName;
  eventId: string;
  projectId?: string;
  channel?: string;
  target?: string;
  metadata?: Record<string, string | number | boolean>;
};

const allowedChannels = new Set([
  "facebook", "linkedin", "x", "email", "copy", "native",
  "portfolio", "service", "gallery", "video", "cta", "outbound",
]);
const eventNames = new Set<string>(PORTFOLIO_EVENT_NAMES);

function cleanText(value: unknown, max = 100) {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
  return clean || undefined;
}

export function parsePortfolioEvent(value: unknown): PortfolioEventInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!eventNames.has(String(input.eventName))) return null;
  const eventId = cleanText(input.eventId, 80);
  if (!eventId || !/^[a-zA-Z0-9_-]{8,80}$/.test(eventId)) return null;
  const projectId = cleanText(input.projectId, 64);
  const channel = cleanText(input.channel, 32)?.toLowerCase();
  if (channel && !allowedChannels.has(channel)) return null;
  const target = cleanAnalyticsTarget(input.target);
  const metadata: Record<string, string | number | boolean> = {};
  if (input.metadata && typeof input.metadata === "object") {
    for (const [key, raw] of Object.entries(input.metadata as Record<string, unknown>).slice(0, 8)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) continue;
      if (/email|name|token|secret|auth|phone/i.test(key)) continue;
      if (typeof raw === "boolean" || (typeof raw === "number" && Number.isFinite(raw))) metadata[key] = raw;
      if (typeof raw === "string" && !raw.includes("@")) metadata[key] = cleanText(raw, 80) ?? "";
    }
  }
  return {
    eventName: String(input.eventName) as PortfolioEventName,
    eventId,
    ...(projectId ? { projectId } : {}),
    ...(channel ? { channel } : {}),
    ...(target ? { target } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

export function cleanAnalyticsTarget(value: unknown) {
  const text = cleanText(value, 500);
  if (!text) return undefined;
  try {
    const url = new URL(text, "https://helios.invalid");
    if (url.origin === "https://helios.invalid") return url.pathname.slice(0, 160);
    return text;
  } catch {
    return text.startsWith("#") ? text.slice(0, 120) : undefined;
  }
}

export function normalizeReferrer(value: string | null) {
  if (!value) return { referrerHost: null, trafficSource: "direct" };
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "").slice(0, 160);
    const source =
      /google|bing|duckduckgo|yahoo/.test(host) ? "organic-search" :
      /facebook|instagram|linkedin|tiktok|x\.com|twitter/.test(host) ? "social" :
      /heliosrealestatemedia\.com/.test(host) ? "internal" : "referral";
    return { referrerHost: host, trafficSource: source };
  } catch {
    return { referrerHost: null, trafficSource: "unknown" };
  }
}

export function classifyDevice(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";
  if (/bot|crawler|spider|preview/.test(value)) return "automated";
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|iphone|android/.test(value)) return "mobile";
  return "desktop";
}

export function analyticsEventKey(workspaceId: string, sessionId: string, eventId: string) {
  return createHash("sha256").update(`${workspaceId}:${sessionId}:${eventId}`).digest("hex");
}

export function normalizedHostname(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function selectWorkspaceForHost(
  requestHost: string | null,
  settings: Array<{ workspaceId: string | null; websiteUrl: string | null }>,
) {
  const configured = settings.filter(
    (item): item is { workspaceId: string; websiteUrl: string | null } => Boolean(item.workspaceId),
  );
  const host = normalizedHostname(requestHost?.split(":")[0]);
  if (host) {
    const matches = configured.filter(item => normalizedHostname(item.websiteUrl) === host);
    if (matches.length === 1) return matches[0].workspaceId;
    if (matches.length > 1) return null;
  }
  return configured.length === 1 ? configured[0].workspaceId : null;
}
