export type MonitorTone = "ONLINE" | "DEGRADED" | "OFFLINE" | "UNKNOWN" | "NOT_CONFIGURED";

export function normalizeMonitorStatus(status: unknown): MonitorTone {
  const value = String(status ?? "").toLowerCase();
  if (["up", "online", "2"].includes(value)) return "ONLINE";
  if (["down", "offline", "9"].includes(value)) return "OFFLINE";
  if (["paused", "seems_down", "degraded", "8"].includes(value)) return "DEGRADED";
  return "UNKNOWN";
}
