export function parseLegacyContributorIdentity(displayName: string, existingTitle?: string | null) {
  if (existingTitle?.trim()) return { status: "unchanged" as const, displayName, title: existingTitle.trim() };
  const parts = displayName.split(" - ");
  if (parts.length !== 2) return {
    status: displayName.includes(" - ") ? "review" as const : "unchanged" as const,
    displayName, title: null,
  };
  const [name, title] = parts.map(value => value.trim());
  if (!name || !title) return { status: "review" as const, displayName, title: null };
  return { status: "migratable" as const, displayName: name, title };
}
