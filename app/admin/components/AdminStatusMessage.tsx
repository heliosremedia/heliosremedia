import type { ReactNode } from "react";
import type { AdminStatusTone } from "./AdminStatusBadge";

/** For operation feedback, not permanent badges or delivery guarantees. */
export default function AdminStatusMessage({ tone = "neutral", children, className = "" }: {
  tone?: AdminStatusTone;
  children: ReactNode;
  className?: string;
}) {
  return <p role={tone === "error" ? "alert" : "status"} aria-atomic="true" className={`admin-status admin-status-${tone} ${className}`.trim()}>{children}</p>;
}
