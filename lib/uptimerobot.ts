import "server-only";
import { normalizeMonitorStatus, type MonitorTone } from "./uptimerobot-core";

export type { MonitorTone } from "./uptimerobot-core";
export type MonitorSummary = {
  tone: MonitorTone;
  stale: boolean;
  monitorName: string | null;
  lastSuccessfulCheck: string | null;
  lastAttemptedCheck: string | null;
  responseTimeMs: number | null;
  uptimePercent: number | null;
  recentIncident: string | null;
  recoveryTime: string | null;
};

let cache: { value: MonitorSummary; expiresAt: number } | null = null;
const empty = (tone: MonitorTone): MonitorSummary => ({ tone, stale: false, monitorName: null, lastSuccessfulCheck: null, lastAttemptedCheck: null, responseTimeMs: null, uptimePercent: null, recentIncident: null, recoveryTime: null });

export async function getPublicMonitorSummary(fetcher: typeof fetch = fetch): Promise<MonitorSummary> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const key = process.env.UPTIMEROBOT_API_KEY?.trim();
  if (!key) return empty("NOT_CONFIGURED");
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetcher("https://api.uptimerobot.com/v3/monitors?limit=20", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`UptimeRobot request failed (${response.status}).`);
    const payload = await response.json() as Record<string, unknown>;
    const nested = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : null;
    const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(nested?.monitors) ? nested.monitors : Array.isArray(payload.monitors) ? payload.monitors : [];
    const monitor = rows.find((item) => item && typeof item === "object" && /helios|public|website/i.test(String((item as Record<string, unknown>).friendlyName || (item as Record<string, unknown>).friendly_name || (item as Record<string, unknown>).name || ""))) as Record<string, unknown> | undefined;
    if (!monitor) throw new Error("The Helios public monitor was not returned.");
    const responseTime = Number(monitor.responseTime ?? monitor.response_time ?? monitor.average_response_time);
    const uptimeBuckets = monitor.lastDayUptimes && typeof monitor.lastDayUptimes === "object" ? (monitor.lastDayUptimes as { histogram?: Array<{ uptime?: number }> }).histogram : [];
    const uptime = Number(monitor.uptimeRatio ?? monitor.uptimePercentage ?? monitor.uptime_ratio ?? monitor.uptime_percentage ?? uptimeBuckets?.at(-1)?.uptime);
    const incident = monitor.lastIncident && typeof monitor.lastIncident === "object" ? monitor.lastIncident as Record<string, unknown> : null;
    const value: MonitorSummary = {
      tone: normalizeMonitorStatus(monitor.status),
      stale: false,
      monitorName: String(monitor.friendlyName || monitor.friendly_name || monitor.name || "Helios public website"),
      lastSuccessfulCheck: normalizeMonitorStatus(monitor.status) === "ONLINE" ? String(monitor.lastSuccessfulCheck || monitor.last_successful_check || monitor.lastCheck || monitor.last_check || attemptedAt) : null,
      lastAttemptedCheck: String(monitor.lastCheck || monitor.last_check || attemptedAt),
      responseTimeMs: Number.isFinite(responseTime) ? responseTime : null,
      uptimePercent: Number.isFinite(uptime) ? uptime : null,
      recentIncident: incident ? String(incident.reason || "Recent incident") : typeof monitor.recent_incident === "string" ? monitor.recent_incident : null,
      recoveryTime: incident && Number.isFinite(Number(incident.duration)) ? `${Number(incident.duration)} seconds` : typeof monitor.recovery_time === "string" ? monitor.recovery_time : null,
    };
    cache = { value, expiresAt: now + 60_000 };
    return value;
  } catch {
    if (cache) return { ...cache.value, stale: true, lastAttemptedCheck: attemptedAt };
    return { ...empty("UNKNOWN"), lastAttemptedCheck: attemptedAt };
  }
}

export function webhookReady() {
  return Boolean(process.env.UPTIMEROBOT_WEBHOOK_SECRET?.trim());
}
