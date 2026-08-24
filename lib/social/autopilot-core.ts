import { createHash } from "node:crypto";

export const AUTOPILOT_PLATFORMS = ["FACEBOOK", "INSTAGRAM"] as const;
export const DEFAULT_AUTOPILOT_MIX = { PORTFOLIO_SPOTLIGHT: 2, EDUCATIONAL: 1, BRAND_OR_SERVICE: 1, TIMELY_OR_COMMUNITY: 0 } as const;

export function socialAutopilotEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.SOCIAL_AI_AUTOPILOT_ENABLED === "true";
}

export function approvedQueueBridgeEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.SOCIAL_AI_APPROVED_QUEUE_ENABLED === "true";
}

export function startOfSocialWeek(value: Date, timeZone = "America/Denver") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const local = new Date(`${map.year}-${map.month}-${map.day}T12:00:00Z`);
  local.setUTCDate(local.getUTCDate() - ((weekdays.indexOf(map.weekday) + 6) % 7));
  local.setUTCHours(0, 0, 0, 0);
  return local;
}

export const endOfSocialWeek = (weekStart: Date) => new Date(weekStart.getTime() + 7 * 86_400_000 - 1);
export const autopilotRunKey = (workspaceId: string, weekStart: Date, version = 1) => `social-autopilot:${workspaceId}:${weekStart.toISOString()}:v${version}`;
export const autopilotInputDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const mayEnterExistingQueue = (input: { variantStatus: string; rejectedAt?: Date | null }) => input.variantStatus === "APPROVED" && !input.rejectedAt;
export const sanitizeAutopilotError = (error: unknown) => (error instanceof Error ? error.message : "Autopilot generation failed.").replace(/(?:access|refresh|page)[-_ ]?token[^\s]*/gi, "credential").slice(0, 500);

