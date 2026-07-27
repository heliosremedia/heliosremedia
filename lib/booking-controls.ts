export type BookingModeValue = "ONLINE" | "UNAVAILABLE" | "PAUSED";

export function resolveBookingDestination(mode: BookingModeValue, configuredUrl: string | null) {
  if (mode !== "ONLINE") return { kind: "status" as const, href: "/book" };
  if (!configuredUrl) return { kind: "status" as const, href: "/book" };
  try {
    const parsed = new URL(configuredUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return { kind: "status" as const, href: "/book" };
    return { kind: "handoff" as const, href: parsed.toString() };
  } catch { return { kind: "status" as const, href: "/book" }; }
}

export function movePinnedItem(items: string[], item: string, direction: -1 | 1) {
  const index = items.indexOf(item); const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
