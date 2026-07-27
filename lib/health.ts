export type InternalHealth = { publicSite: boolean; bookingRoute: boolean; bookingDestination: boolean | null };

export function publicHealthResponse(health: InternalHealth, now = new Date()) {
  const service = health.publicSite && health.bookingRoute ? "operational" : "degraded";
  return {
    status: service,
    timestamp: now.toISOString(),
  };
}
