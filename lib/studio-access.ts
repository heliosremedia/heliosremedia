import type { AdminSession } from "./auth/session";
import { tenantContextEnabled } from "./workspace-context-core.ts";

/** Server-only rollout decision. Membership/session authority must be refreshed first. */
export function studioEnabledFor(session: { workspaceId: string; role: AdminSession["role"] }) {
  return tenantContextEnabled()
    && process.env.STUDIO_V2_SHELL_ENABLED?.trim().toLowerCase() === "true"
    && ["OWNER", "ADMIN"].includes(session.role)
    && (process.env.STUDIO_V2_SHELL_WORKSPACE_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean).includes(session.workspaceId);
}
