export const EMAIL_STUDIO_CARD_IDS = [
  "client-experience",
  "client-gatherings",
  "analytics-health",
  "webhook-health",
] as const;

export type EmailStudioCardId = (typeof EMAIL_STUDIO_CARD_IDS)[number];

export function emailStudioLayoutStorageKey(workspaceId: string, userId: string) {
  return `helios:email-studio:card-order:v1:${encodeURIComponent(workspaceId)}:${encodeURIComponent(userId)}`;
}

export function normalizeEmailStudioCardOrder(value: unknown): EmailStudioCardId[] {
  const requested = Array.isArray(value) ? value : [];
  const valid = new Set<string>(EMAIL_STUDIO_CARD_IDS);
  const order = requested.filter(
    (id, index): id is EmailStudioCardId =>
      typeof id === "string" && valid.has(id) && requested.indexOf(id) === index,
  );
  return [...order, ...EMAIL_STUDIO_CARD_IDS.filter((id) => !order.includes(id))];
}

/** Reorder only visible slots, retaining preferences for role-restricted cards. */
export function moveEmailStudioCard(
  order: readonly EmailStudioCardId[],
  visibleIds: readonly EmailStudioCardId[],
  id: EmailStudioCardId,
  targetIndex: number,
): EmailStudioCardId[] {
  const normalized = normalizeEmailStudioCardOrder(order);
  const visible = new Set(visibleIds);
  const nextVisible = normalized.filter((item) => visible.has(item));
  const sourceIndex = nextVisible.indexOf(id);
  if (sourceIndex < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= nextVisible.length) {
    return normalized;
  }
  nextVisible.splice(sourceIndex, 1);
  nextVisible.splice(targetIndex, 0, id);
  let index = 0;
  return normalized.map((item) => visible.has(item) ? nextVisible[index++] : item);
}

export function resetEmailStudioCardOrder(
  order: readonly EmailStudioCardId[],
  visibleIds: readonly EmailStudioCardId[],
) {
  const visible = new Set(visibleIds);
  const defaults = EMAIL_STUDIO_CARD_IDS.filter((id) => visible.has(id));
  let index = 0;
  return normalizeEmailStudioCardOrder(order).map((id) => visible.has(id) ? defaults[index++] : id);
}

type LayoutSnapshot = { order: EmailStudioCardId[]; storageAvailable: boolean };
type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

export const DEFAULT_EMAIL_STUDIO_LAYOUT: LayoutSnapshot = {
  order: [...EMAIL_STUDIO_CARD_IDS],
  storageAvailable: true,
};

/** A scoped external store keeps SSR stable and still works with blocked storage. */
export function createEmailStudioLayoutStore(
  storageKey: string,
  getStorage: () => LayoutStorage,
) {
  let snapshot: LayoutSnapshot | undefined;
  const listeners = new Set<() => void>();

  function read(): LayoutSnapshot {
    let raw: string | null;
    try {
      raw = getStorage().getItem(storageKey);
    } catch {
      return { order: [...EMAIL_STUDIO_CARD_IDS], storageAvailable: false };
    }
    let value: unknown;
    try { value = raw ? JSON.parse(raw) : null; } catch { value = null; }
    return { order: normalizeEmailStudioCardOrder(value), storageAvailable: true };
  }

  return {
    getSnapshot() {
      snapshot ??= read();
      return snapshot;
    },
    getServerSnapshot: () => DEFAULT_EMAIL_STUDIO_LAYOUT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    save(order: readonly EmailStudioCardId[]) {
      const next = normalizeEmailStudioCardOrder(order);
      let storageAvailable = true;
      try { getStorage().setItem(storageKey, JSON.stringify(next)); } catch { storageAvailable = false; }
      snapshot = { order: next, storageAvailable };
      listeners.forEach((listener) => listener());
      return storageAvailable;
    },
    refresh() {
      snapshot = read();
      listeners.forEach((listener) => listener());
    },
  };
}
