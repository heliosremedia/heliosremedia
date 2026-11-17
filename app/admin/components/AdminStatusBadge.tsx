import type { ReactNode } from "react";

export type AdminStatusTone = "neutral" | "success" | "warning" | "error";

/** Static state, not an announcement. Callers retain truthful domain-specific labels. */
export default function AdminStatusBadge({ tone = "neutral", children }: {
  tone?: AdminStatusTone;
  children: ReactNode;
}) {
  return <span className={`admin-status-badge admin-status-${tone}`}>{children}</span>;
}
