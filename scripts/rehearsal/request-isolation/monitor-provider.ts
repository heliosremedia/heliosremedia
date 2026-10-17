/** Rehearsal-only provider. No network fallback and no real credential source. */
export async function syntheticMonitorFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (String(input) !== "https://api.uptimerobot.com/v3/monitors?limit=20"
    || new Headers(init?.headers).get("authorization") !== "Bearer packet52-synthetic-monitor-key") throw new Error("Unexpected synthetic monitor request");
  return Response.json({ data: [{ friendlyName: "Helios PRIVATE_PLATFORM_MONITOR", status: "up", responseTime: 987654321, recent_incident: "PRIVATE_PLATFORM_INCIDENT" }] });
}
