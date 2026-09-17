// Ephemeral copies for the settings editors currently mounted on this page only.
// Registration happens in client effects; no browser persistence or server draft storage.
const readers = new Map<object, () => unknown>();
const listeners = new Set<() => void>();
let snapshot = "[]";
export function refreshSettingsCopies() {
  snapshot = JSON.stringify([...readers.values()].map(read => read()), null, 2);
  listeners.forEach(listener => listener());
}
export function registerSettingsCopy(key: object, read: () => unknown) {
  readers.set(key, read); refreshSettingsCopies();
  return () => { readers.delete(key); refreshSettingsCopies(); };
}
export function subscribeSettingsCopies(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const readSettingsCopies = () => snapshot;
export const emptySettingsCopies = () => "[]";
