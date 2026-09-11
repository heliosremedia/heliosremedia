/** Reject identifiable foreign storage references without fetching a URL. */
export function filmPosterMatchesWorkspace(workspaceId: string, projectId: string, value: string | null) {
  if (!value) return true;
  try {
    if (value.startsWith("//") || value.includes("\\")) return false;
    const url = new URL(value, "https://assets.invalid/");
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const path = decodeURIComponent(url.pathname);
    const company = path.match(/(?:^|\/)workspaces\/([^/]+)\//)?.[1]
      ?? path.match(/(?:^|\/)site\/photo-comparison\/([^/]+)\//)?.[1];
    const project = path.match(/(?:^|\/)projects\/([^/]+)\//)?.[1];
    return (!company || company === workspaceId) && (!project || project === projectId);
  } catch { return false; }
}
