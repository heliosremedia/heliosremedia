// Browser revision metadata is supplied by the authenticated page, never public host input.
export type SettingsRevision = {
  id: string;
  workspaceId: string;
  storedWorkspaceId: string | null;
  updatedAt: string | null;
};
export type SettingsScope = "full" | "homepage-navigation" | "homepage-structure";

export function canonicalRevision(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
