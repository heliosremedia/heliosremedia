// Browser-only acknowledgement helpers. Receipts establish curation state, not public visibility.
export function sameIds(actual: string[], expected: string[]) { return actual.length === expected.length && actual.every((id, i) => id === expected[i]); }
export function sameMembers(actual: string[], expected: string[]) { return sameIds([...actual].sort(), [...expected].sort()); }
export function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
export function normalized(value: unknown) { return typeof value === 'string' ? value.trim() || null : value; }
/** Merge only acknowledged fields whose local value has not changed since admission. */
export function mergeDraft<T extends { id: string }>(current: T, submitted: T, acknowledged: T): T {
 const result = { ...current };
 for (const key of Object.keys(acknowledged) as (keyof T)[]) if (JSON.stringify(current[key]) === JSON.stringify(submitted[key])) result[key] = acknowledged[key];
 return result;
}
