export const HOMEPAGE_CURATION_SECTION_IDS = [
  "homepage-navigation",
  "homepage-media",
  "featured-project",
  "our-work",
  "homepage-structure",
] as const;

export type HomepageCurationSectionId =
  (typeof HOMEPAGE_CURATION_SECTION_IDS)[number];

export type HomepageCurationPreferences = {
  order: HomepageCurationSectionId[];
  collapsed: HomepageCurationSectionId[];
};

export const DEFAULT_HOMEPAGE_CURATION_PREFERENCES: HomepageCurationPreferences = {
  order: [...HOMEPAGE_CURATION_SECTION_IDS],
  collapsed: ["homepage-navigation"],
};

export function normalizeHomepageCurationPreferences(
  value: unknown,
): HomepageCurationPreferences {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const requestedOrder = Array.isArray(record.order) ? record.order : [];
  const requestedCollapsed = Array.isArray(record.collapsed)
    ? record.collapsed
    : DEFAULT_HOMEPAGE_CURATION_PREFERENCES.collapsed;
  const validIds = new Set<string>(HOMEPAGE_CURATION_SECTION_IDS);
  const order = requestedOrder.filter(
    (id, index): id is HomepageCurationSectionId =>
      typeof id === "string" &&
      validIds.has(id) &&
      requestedOrder.indexOf(id) === index,
  );
  for (const id of HOMEPAGE_CURATION_SECTION_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  const collapsed = requestedCollapsed.filter(
    (id, index): id is HomepageCurationSectionId =>
      typeof id === "string" &&
      validIds.has(id) &&
      requestedCollapsed.indexOf(id) === index,
  );
  return { order, collapsed };
}

/** New writes must be complete; normalization remains only for historical reads. */
export function validHomepageLayout(value: unknown): value is HomepageCurationPreferences {
 if (!value || typeof value !== 'object') return false;
 const { order, collapsed } = value as HomepageCurationPreferences;
 const valid = (list: unknown): list is HomepageCurationSectionId[] => Array.isArray(list) && list.every(id => HOMEPAGE_CURATION_SECTION_IDS.includes(id)) && new Set(list).size === list.length;
 return valid(order) && order.length === HOMEPAGE_CURATION_SECTION_IDS.length && valid(collapsed);
}
