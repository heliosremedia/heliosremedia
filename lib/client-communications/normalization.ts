export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  return digits || null;
}
