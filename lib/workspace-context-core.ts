export type WorkspaceContextSource =
  | "session"
  | "host"
  | "job"
  | "webhook"
  | "platform-support";

export type WorkspaceContext = {
  workspaceId: string;
  source: WorkspaceContextSource;
  requestId: string;
  actorId?: string;
  role?: string;
};

export function normalizeWorkspaceHostname(input: string | null | undefined) {
  const candidate = input?.trim();
  if (!candidate) return null;

  try {
    const hasScheme = candidate.includes("://");
    if (!hasScheme && /[/?#]/.test(candidate)) return null;
    const parsed = new URL(hasScheme ? candidate : `https://${candidate}`);
    if (parsed.username || parsed.password) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return hostname || null;
  } catch {
    return null;
  }
}

export function tenantContextEnabled(value = process.env.STUDIO_V2_TENANT_CONTEXT_ENABLED) {
  return value?.trim().toLowerCase() === "true";
}

export function isLocalWorkspaceHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
