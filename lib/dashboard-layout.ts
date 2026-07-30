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
  rows: DashboardCardId[][];
  collapsed: DashboardCardId[];
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  order: [...DASHBOARD_CARD_IDS],
  rows: DASHBOARD_CARD_IDS.map((id) => [id]),
  collapsed: [],
};

export function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const valid = new Set<string>(DASHBOARD_CARD_IDS);
  const sourceOrder = Array.isArray(record.order) ? record.order : [];
  const order = sourceOrder.filter((id, index): id is DashboardCardId =>
    typeof id === "string" && valid.has(id) && sourceOrder.indexOf(id) === index);
  for (const id of DASHBOARD_CARD_IDS) if (!order.includes(id)) order.push(id);
  const seen = new Set<DashboardCardId>();
  const sourceRows = Array.isArray(record.rows) ? record.rows : [];
  const rows = sourceRows.flatMap((value) => {
    if (!Array.isArray(value)) return [];
    const row = value.filter((id): id is DashboardCardId =>
      typeof id === "string" && valid.has(id) && !seen.has(id as DashboardCardId)).slice(0, 2);
    row.forEach((id) => seen.add(id));
    return row.length ? [row] : [];
  });
  for (const id of order) if (!seen.has(id)) rows.push([id]);
  const flattened = rows.flat();
  const sourceCollapsed = Array.isArray(record.collapsed) ? record.collapsed : [];
  const collapsed = sourceCollapsed.filter((id, index): id is DashboardCardId =>
    typeof id === "string" && valid.has(id) && sourceCollapsed.indexOf(id) === index);
  return { order: flattened, rows, collapsed };
}
