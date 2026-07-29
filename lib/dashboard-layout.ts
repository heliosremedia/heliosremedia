export const DASHBOARD_CARD_IDS = [
  "action-required",
  "todays-operations",
  "performance-snapshot",
  "recent-activity",
  "platform-health",
  "quick-actions",
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];
export type DashboardPreferences = {
  order: DashboardCardId[];
  collapsed: DashboardCardId[];
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  order: [...DASHBOARD_CARD_IDS],
  collapsed: [],
};

export function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const valid = new Set<string>(DASHBOARD_CARD_IDS);
  const sourceOrder = Array.isArray(record.order) ? record.order : [];
  const order = sourceOrder.filter((id, index): id is DashboardCardId =>
    typeof id === "string" && valid.has(id) && sourceOrder.indexOf(id) === index);
  for (const id of DASHBOARD_CARD_IDS) if (!order.includes(id)) order.push(id);
  const sourceCollapsed = Array.isArray(record.collapsed) ? record.collapsed : [];
  const collapsed = sourceCollapsed.filter((id, index): id is DashboardCardId =>
    typeof id === "string" && valid.has(id) && sourceCollapsed.indexOf(id) === index);
  return { order, collapsed };
}
