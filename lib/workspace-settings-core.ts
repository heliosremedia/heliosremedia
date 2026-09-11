// The caller supplies a trusted workspace resolver, never a query-string ID.
export async function loadWorkspaceSettings<T, F>(
  enabled: boolean,
  resolveWorkspace: () => Promise<string>,
  read: (where: { id: string } | { workspaceId: string }) => Promise<T | null>,
  legacyDefaults: F,
): Promise<T | F> {
  if (!enabled) return (await read({ id: "default" })) ?? legacyDefaults;
  const workspaceId = await resolveWorkspace();
  if (!workspaceId.trim()) throw new Error("Workspace settings require a workspace.");
  const settings = await read({ workspaceId });
  if (!settings) throw new Error("Site settings are not configured for this workspace.");
  return settings;
}
