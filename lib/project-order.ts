export type ProjectOrderItem = { id: string };

export function moveSelectedProjects<T extends ProjectOrderItem>(
  items: readonly T[],
  selectedIds: ReadonlySet<string>,
  targetId: string,
) {
  const moving = items.filter((item) => selectedIds.has(item.id));
  if (!moving.length || selectedIds.has(targetId)) return [...items];
  const remaining = items.filter((item) => !selectedIds.has(item.id));
  const targetIndex = remaining.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return [...items];
  return [...remaining.slice(0, targetIndex), ...moving, ...remaining.slice(targetIndex)];
}

export function moveSelectedProjectsByBoundary<T extends ProjectOrderItem>(
  items: readonly T[],
  selectedIds: ReadonlySet<string>,
  direction: "up" | "down" | "top" | "bottom",
) {
  const moving = items.filter((item) => selectedIds.has(item.id));
  const remaining = items.filter((item) => !selectedIds.has(item.id));
  if (!moving.length) return [...items];
  if (direction === "top") return [...moving, ...remaining];
  if (direction === "bottom") return [...remaining, ...moving];

  const firstIndex = items.findIndex((item) => selectedIds.has(item.id));
  const lastIndex = items.findLastIndex((item) => selectedIds.has(item.id));
  if (direction === "up") {
    if (firstIndex <= 0) return [...items];
    const target = items[firstIndex - 1];
    return moveSelectedProjects(items, selectedIds, target.id);
  }
  if (lastIndex < 0 || lastIndex >= items.length - 1) return [...items];
  const after = items[lastIndex + 1];
  const without = items.filter((item) => !selectedIds.has(item.id));
  const afterIndex = without.findIndex((item) => item.id === after.id);
  return [...without.slice(0, afterIndex + 1), ...moving, ...without.slice(afterIndex + 1)];
}
