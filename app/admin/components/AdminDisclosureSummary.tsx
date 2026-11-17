import type { ReactNode } from "react";

/** First child of a native details element. No state, click handler or nested button:
 * the browser owns keyboard activation/open state and keeps form children mounted. */
export default function AdminDisclosureSummary({ children }: { children: ReactNode }) {
  return <summary className="admin-disclosure-summary">
    <span className="admin-disclosure-label">{children}</span>
    <span className="admin-disclosure-indicator" aria-hidden="true">
      <span className="admin-disclosure-plus">+</span>
      <span className="admin-disclosure-minus">−</span>
    </span>
  </summary>;
}
